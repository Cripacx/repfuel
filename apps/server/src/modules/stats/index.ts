/**
 * Stats-/Read-Model-Modul: modulübergreifende Lesezugriffe (Datenexport).
 * Greift ausschließlich auf die öffentlichen Service-Schnittstellen zu.
 */
import type { FastifyInstance } from 'fastify';
import type { AuthGuards, ProfileService } from '../auth/index.js';
import type { IngestService, WeightService } from '../health/index.js';
import type { MealService } from '../nutrition/index.js';
import type { RoutineService, WorkoutService } from '../workout/index.js';
import { computeActivityStats } from './services/activity.js';

export interface StatsModuleOptions {
  guards: AuthGuards;
  profileService: ProfileService;
  routineService: RoutineService;
  workoutService: WorkoutService;
  mealService: MealService;
  weightService: WeightService;
  ingestService: IngestService;
  appVersion: string;
}

export async function registerStatsModule(
  app: FastifyInstance,
  opts: StatsModuleOptions,
): Promise<void> {
  await app.register(
    async (instance) => {
      instance.addHook('preHandler', opts.guards.requireAuth);

      /** Trainingsaktivität: Tagesreihe für die Heatmap plus Serien-Kennzahlen. */
      instance.get('/stats/activity', async (req) => {
        const workouts = await opts.workoutService.list(req.sessionUser!.id, { limit: 10000 });
        return {
          activity: computeActivityStats(
            workouts.map((w) => ({
              startedAt: new Date(w.startedAt),
              finishedAt: w.finishedAt ? new Date(w.finishedAt) : null,
            })),
            new Date(),
          ),
        };
      });

      /** Vollständiger Datenexport des eingeloggten Nutzers als JSON. */
      instance.get('/export', async (req, reply) => {
        const userId = req.sessionUser!.id;
        const [profile, routines, workouts, meals, bodyWeight, healthMetrics] = await Promise.all([
          opts.profileService.get(userId),
          opts.routineService.list(userId),
          opts.workoutService.list(userId, { limit: 10000 }),
          opts.mealService.list(userId, { limit: 100000 }),
          opts.weightService.list(userId, { limit: 100000 }),
          opts.ingestService.exportAll(userId),
        ]);
        reply.header(
          'content-disposition',
          `attachment; filename="repfuel-export-${new Date().toISOString().slice(0, 10)}.json"`,
        );
        return {
          exportedAt: new Date().toISOString(),
          appVersion: opts.appVersion,
          user: { id: userId, username: req.sessionUser!.username },
          profile,
          routines,
          workouts,
          meals,
          bodyWeight,
          healthMetrics,
        };
      });
    },
    { prefix: '/api/v1' },
  );
}
