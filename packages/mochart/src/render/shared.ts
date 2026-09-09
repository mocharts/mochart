function isObject(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (!isObject(a) || !isObject(b)) {
    return false;
  }
  const aValues = a as Record<string, unknown>;
  const bValues = b as Record<string, unknown>;
  for (const key in aValues) {
    if (!(key in bValues)) {
      return false;
    }
  }
  for (const key in bValues) {
    if (aValues[key] !== bValues[key]) {
      return false;
    }
  }
  return true;
}

// Deferred callbacks (measure hooks, setState callbacks) run once the outermost
// mount/update finishes, so measurement code always reads committed DOM.
let commitQueue: (() => void)[] = [];
let workDepth = 0;

export function enqueue(callback: () => void): void {
  commitQueue.push(callback);
}

function flushCommitQueue(): void {
  while (commitQueue.length > 0) {
    const callbacks = commitQueue;
    commitQueue = [];
    for (const callback of callbacks) {
      callback();
    }
  }
}

export function beginWork(): void {
  workDepth++;
}

export function endWork(): void {
  workDepth--;
  if (workDepth === 0) {
    flushCommitQueue();
  }
}
