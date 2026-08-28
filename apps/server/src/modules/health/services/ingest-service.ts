import { createHash, randomBytes } from 'node:crypto';
import type {
  ApiTokenDto,
  CreatedApiTokenDto,
  HealthAutoExportPayload,
  HealthIngestResponse,
  HealthStatsResponse,
  SimpleHealthIngest,
} from '@repfuel/shared';
import { AppError } from '../../../core/errors.js';
import type { ApiTokenRepo } from '../repositories/api-token-repo.js';
import type { MetricRepo, MetricUpsert } from '../repositories/metric-repo.js';
import type { ApiTokenRow } from '../schema.js';
import { mapHealthAutoExport } from './hae-mapping.js';
import type { WeightService } from './weight-service.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Deterministische UUID für gespiegelte Gewichtseinträge (idempotent). */
export function mirrorWeightId(userId: string, measuredAt: Date, source: string): string {
  const hex = createHash('sha256')
    .update(`weight-mirror:${userId}:${measuredAt.toISOString()}:${source}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function toTokenDto(row: ApiTokenRow): ApiTokenDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

export interface IngestServiceDeps {
  metricRepo: MetricRepo;
  apiTokenRepo: ApiTokenRepo;
  weightService: WeightService;
}

export type IngestService = ReturnType<typeof createIngestService>;

export function createIngestService(deps: IngestServiceDeps) {
  async function applyEntries(
    userId: string,
    source: string,
    entries: { metric: string; value: number; measuredAt: Date }[],
    ignoredMetrics: string[],
  ): Promise<HealthIngestResponse> {
    const upserts: MetricUpsert[] = entries.map((e) => ({
      userId,
      metric: e.metric,
      value: e.value,
      measuredAt: e.measuredAt,
      source,
    }));
    const accepted = await deps.metricRepo.upsertMany(upserts);

    // Gewicht zusätzlich nach body_weight spiegeln (source verhindert
    // Kollisionen mit manuellen Einträgen; deterministische UUID = idempotent).
    let mirroredWeights = 0;
    for (const entry of entries) {
      if (entry.metric !== 'weight') continue;
      if (entry.value < 20 || entry.value > 500) continue;
      await deps.weightService.upsert(userId, mirrorWeightId(userId, entry.measuredAt, source), {
        weightKg: Math.round(entry.value * 100) / 100,
        measuredAt: entry.measuredAt.toISOString(),
      });
      mirroredWeights++;
    }

    return { accepted, ignoredMetrics, mirroredWeights };
  }

  return {
    // --- Token-Verwaltung (Session-Auth) ---

    async createToken(userId: string, name: string): Promise<CreatedApiTokenDto> {
      const token = `rf_${randomBytes(24).toString('base64url')}`;
      const row = await deps.apiTokenRepo.create({ userId, name, tokenHash: hashToken(token) });
      return { ...toTokenDto(row), token };
    },

    async listTokens(userId: string): Promise<ApiTokenDto[]> {
      return (await deps.apiTokenRepo.list(userId)).map(toTokenDto);
    },

    async revokeToken(userId: string, id: string): Promise<void> {
      const row = await deps.apiTokenRepo.revoke(userId, id);
      if (!row) throw new AppError('not_found', 'Token not found');
    },

    /** Bearer-Token → userId (Ingest-Auth, kein Session-Cookie). */
    async verifyToken(token: string): Promise<string | null> {
      if (!token.startsWith('rf_') || token.length > 128) return null;
      const row = await deps.apiTokenRepo.findByHash(hashToken(token));
      if (!row) return null;
      void deps.apiTokenRepo.touch(row.id);
      return row.userId;
    },

    // --- Ingest (Batch, idempotent) ---

    async ingestSimple(userId: string, payload: SimpleHealthIngest): Promise<HealthIngestResponse> {
      return applyEntries(
        userId,
        payload.source,
        payload.metrics.map((m) => ({
          metric: m.metric,
          value: m.value,
          measuredAt: new Date(m.measuredAt),
        })),
        [],
      );
    },

    async ingestHealthAutoExport(
      userId: string,
      payload: HealthAutoExportPayload,
    ): Promise<HealthIngestResponse> {
      const { mapped, ignoredMetrics } = mapHealthAutoExport(payload);
      return applyEntries(userId, 'apple_health', mapped, ignoredMetrics);
    },

    // --- Abfragen ---

    async stats(
      userId: string,
      query: { metric: string; from?: string; to?: string; limit: number },
    ): Promise<HealthStatsResponse> {
      const rows = await deps.metricRepo.list({
        userId,
        metric: query.metric,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        limit: query.limit,
      });
      return {
        metric: query.metric,
        entries: rows.map((r) => ({
          measuredAt: r.measuredAt.toISOString(),
          value: r.value,
          source: r.source,
        })),
      };
    },

    async exportAll(userId: string) {
      return (await deps.metricRepo.listAll(userId)).map((r) => ({
        metric: r.metric,
        value: r.value,
        measuredAt: r.measuredAt.toISOString(),
        source: r.source,
      }));
    },
  };
}
