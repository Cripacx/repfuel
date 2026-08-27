/**
 * Interner Event-Bus zwischen Modulen. In-process, aber mit einer API, die
 * 1:1 auf Redis-Pub/Sub abbildbar ist (topic + JSON-Payload), damit einzelne
 * Module später ohne Umbau der Aufrufer extrahiert werden können.
 */
export type EventHandler<T> = (payload: T) => void | Promise<void>;

export interface EventBus {
  publish<T>(topic: string, payload: T): Promise<void>;
  subscribe<T>(topic: string, handler: EventHandler<T>): () => void;
}

export function createInProcessEventBus(onError?: (err: unknown, topic: string) => void): EventBus {
  const handlers = new Map<string, Set<EventHandler<unknown>>>();

  return {
    async publish<T>(topic: string, payload: T): Promise<void> {
      const subs = handlers.get(topic);
      if (!subs) return;
      for (const handler of subs) {
        try {
          await handler(payload);
        } catch (err) {
          onError?.(err, topic);
        }
      }
    },
    subscribe<T>(topic: string, handler: EventHandler<T>): () => void {
      let subs = handlers.get(topic);
      if (!subs) {
        subs = new Set();
        handlers.set(topic, subs);
      }
      subs.add(handler as EventHandler<unknown>);
      return () => {
        subs.delete(handler as EventHandler<unknown>);
      };
    },
  };
}
