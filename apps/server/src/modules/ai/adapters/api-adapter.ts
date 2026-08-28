import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { stepCountIs, streamText, tool as aiTool, type LanguageModel, type ToolSet as AiToolSet } from 'ai';
import type {
  AIAdapter,
  AdapterStatus,
  AiProvider,
  ChatChunk,
  ChatMessageDto,
  ToolDefinition,
  ToolSet,
} from '@repfuel/shared';
import { buildSystemPrompt } from '../system-prompt.js';

export interface ApiAdapterConfig {
  provider: Exclude<AiProvider, 'none' | 'cli'>;
  apiKey: string | null;
  model: string;
  baseUrl: string | null;
}

/** Provider-neutraler Adapter über das Vercel AI SDK (API + Ollama, ein Codepfad). */
export function resolveModel(config: ApiAdapterConfig): LanguageModel {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropic({
        apiKey: config.apiKey ?? undefined,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })(config.model);
    case 'openai':
      return createOpenAI({
        apiKey: config.apiKey ?? undefined,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })(config.model);
    case 'openrouter':
      return createOpenAICompatible({
        name: 'openrouter',
        baseURL: config.baseUrl ?? 'https://openrouter.ai/api/v1',
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      }).chatModel(config.model);
    case 'ollama':
      return createOpenAICompatible({
        name: 'ollama',
        baseURL: config.baseUrl ?? 'http://localhost:11434/v1',
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      }).chatModel(config.model);
  }
}

function toAiTools(tools: ToolSet): AiToolSet {
  const result: AiToolSet = {};
  for (const [name, def] of Object.entries(tools)) {
    const typed = def as unknown as ToolDefinition<unknown>;
    result[name] = aiTool({
      description: typed.description,
      inputSchema: typed.inputSchema,
      execute: async (input: unknown) => typed.execute(input),
    });
  }
  return result;
}

/** Ollama: prüfen, ob das konfigurierte Modell Tool-Calling beherrscht. */
async function checkOllamaToolSupport(
  baseUrl: string,
  model: string,
): Promise<{ ok: boolean; message: string | null }> {
  try {
    const apiRoot = baseUrl.replace(/\/v1\/?$/, '');
    const res = await fetch(`${apiRoot}/api/show`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, message: `Ollama nicht erreichbar oder Modell unbekannt (HTTP ${res.status})` };
    }
    const info = (await res.json()) as { capabilities?: string[] };
    if (Array.isArray(info.capabilities) && !info.capabilities.includes('tools')) {
      return {
        ok: false,
        message: `Modell "${model}" unterstützt kein Tool-Calling — bitte ein Modell mit "tools"-Capability konfigurieren.`,
      };
    }
    return { ok: true, message: null };
  } catch {
    return { ok: false, message: 'Ollama nicht erreichbar' };
  }
}

export function createApiAdapter(config: ApiAdapterConfig): AIAdapter {
  return {
    async *chat(input): AsyncIterable<ChatChunk> {
      const model = resolveModel(config);
      const messages = input.messages.map((m: ChatMessageDto) => ({
        role: m.role,
        content: m.content,
      }));
      try {
        const result = streamText({
          model,
          system: buildSystemPrompt(input.userContext),
          messages,
          tools: toAiTools(input.tools),
          stopWhen: stepCountIs(8),
        });
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            yield { type: 'text-delta', text: part.text };
          } else if (part.type === 'tool-call') {
            yield { type: 'tool-call', toolName: part.toolName, args: part.input };
          } else if (part.type === 'tool-result') {
            yield { type: 'tool-result', toolName: part.toolName, result: part.output };
          } else if (part.type === 'error') {
            const err = part.error;
            yield {
              type: 'error',
              message: err instanceof Error ? err.message : 'AI provider error',
            };
            return;
          }
        }
      } catch (err) {
        yield { type: 'error', message: err instanceof Error ? err.message : 'AI provider error' };
      }
    },

    async healthCheck(): Promise<AdapterStatus> {
      const base: AdapterStatus = {
        provider: config.provider,
        configured: true,
        ok: true,
        model: config.model,
        message: null,
      };
      if (config.provider === 'ollama') {
        const check = await checkOllamaToolSupport(
          config.baseUrl ?? 'http://localhost:11434/v1',
          config.model,
        );
        return { ...base, ok: check.ok, message: check.message };
      }
      if (!config.apiKey) {
        return { ...base, ok: false, message: 'AI_API_KEY fehlt' };
      }
      return base;
    },
  };
}
