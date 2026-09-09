import { ErrorHandler, Injectable, inject } from '@angular/core';

/**
 * Angular routes component errors to the global ErrorHandler rather than any
 * subtree boundary, so the error tabs register listeners here and the app
 * provides DemoErrorHandler (main/index.ts) to fan errors out to them.
 */
@Injectable({ providedIn: 'root' })
export class DemoErrorService {
  private readonly listeners = new Set<() => void>();

  register(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  notify(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}

@Injectable()
export class DemoErrorHandler implements ErrorHandler {
  private readonly errors = inject(DemoErrorService);

  handleError(error: unknown): void {
    console.error(error);
    this.errors.notify();
  }
}
