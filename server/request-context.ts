import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<{ userId: number }>();

export function runWithUser<T>(userId: number, callback: () => T): T {
  return storage.run({ userId }, callback);
}

export function currentUserId(fallback?: number): number {
  return storage.getStore()?.userId ?? fallback ?? 0;
}
