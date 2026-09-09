// jsdom ships no types, and @types/jsdom is not worth a dependency for one constructor.
declare module 'jsdom' {
  export type DOMWindow = Window & typeof globalThis;
  export class JSDOM {
    constructor(html?: string, options?: { pretendToBeVisual?: boolean });
    readonly window: DOMWindow;
  }
}
