import { describe, expect, it } from 'vitest';
import { mapCodexEventLine } from './codex-events.js';

describe('mapCodexEventLine', () => {
  it('extracts the thread id from thread.started', () => {
    const result = mapCodexEventLine('{"type":"thread.started","thread_id":"t-123"}');
    expect(result.threadId).toBe('t-123');
    expect(result.chunks).toEqual([]);
  });

  it('maps completed agent messages to text deltas', () => {
    const result = mapCodexEventLine(
      '{"type":"item.completed","item":{"type":"agent_message","text":"Hallo!"}}',
    );
    expect(result.chunks).toEqual([{ type: 'text-delta', text: 'Hallo!' }]);
  });

  it('maps MCP tool calls to tool-call and tool-result chunks', () => {
    const started = mapCodexEventLine(
      '{"type":"item.started","item":{"type":"mcp_tool_call","server":"repfuel","tool":"get_profile","arguments":{}}}',
    );
    expect(started.chunks).toEqual([{ type: 'tool-call', toolName: 'get_profile', args: {} }]);

    const completed = mapCodexEventLine(
      '{"type":"item.completed","item":{"type":"mcp_tool_call","server":"repfuel","tool":"get_profile","status":"completed","result":{"kcalTarget":2000}}}',
    );
    expect(completed.chunks).toEqual([
      { type: 'tool-result', toolName: 'get_profile', result: { kcalTarget: 2000 } },
    ]);
  });

  it('maps turn.completed to done and failures to error', () => {
    expect(mapCodexEventLine('{"type":"turn.completed","usage":{}}').chunks).toEqual([
      { type: 'done' },
    ]);
    expect(
      mapCodexEventLine('{"type":"turn.failed","error":{"message":"rate limited"}}').chunks,
    ).toEqual([{ type: 'error', message: 'rate limited' }]);
    expect(mapCodexEventLine('{"type":"error","message":"boom"}').chunks).toEqual([
      { type: 'error', message: 'boom' },
    ]);
  });

  it('ignores reasoning, command items, unknown events, and non-JSON noise', () => {
    expect(
      mapCodexEventLine('{"type":"item.completed","item":{"type":"reasoning","text":"…"}}').chunks,
    ).toEqual([]);
    expect(mapCodexEventLine('{"type":"turn.started"}').chunks).toEqual([]);
    expect(mapCodexEventLine('npm notice: update available').chunks).toEqual([]);
    expect(mapCodexEventLine('').chunks).toEqual([]);
  });
});
