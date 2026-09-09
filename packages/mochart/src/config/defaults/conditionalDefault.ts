import { deepMerge } from '../core/deepMerge';

export interface ConditionalDefaultRule<C, E, T> {
  condition: { bivarianceHack(config: C, extraArg: E): boolean }['bivarianceHack'];
  suffix: string | null;
  default: T;
  defaultText?: string | null;
}

/** A resolved conditional default: call it to pick the first matching rule. */
export type ConditionalDefaultFunction<T = unknown> = (() => T) & { rules?: ConditionalDefaultRule<any, any, T>[] };

/** A tree of conditional defaults; branches nest the way the config does, so a default can target a nested path. */
export interface ConditionalDefaults {
  [key: string]: ConditionalDefaultFunction<any> | ConditionalDefaults;
}

export type ActualDefaults<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? ReturnType<T[K]> : ActualDefaults<T[K]>;
};

export function conditionalDefault<C, E, T>(rules: ConditionalDefaultRule<NoInfer<C>, NoInfer<E>, T>[], configWithRegularDefaults: C, extraArg: E): (() => T) & { rules?: ConditionalDefaultRule<C, E, T>[] } {
  const conditionalFunction: (() => T) & { rules?: ConditionalDefaultRule<C, E, T>[] } = () => rules.find(rule => rule.condition(configWithRegularDefaults, extraArg))!.default;
  conditionalFunction.rules = rules;
  return conditionalFunction;
}

function evaluateDefault(value: unknown): unknown {
  if (typeof value === 'function') {
    return evaluateDefault((value as ConditionalDefaultFunction)());
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return getActualDefaults(value as ConditionalDefaults);
  }
  return value;
}

/** Evaluate a conditional-defaults tree into plain values; the result is deep-merged over the regular defaults. */
export function getActualDefaults<T extends ConditionalDefaults>(conditionalDefaults: T): ActualDefaults<T> {
  const keys = Object.keys(conditionalDefaults);
  const actualDefaults = {} as Record<string, unknown>;
  for (const key of keys) {
    actualDefaults[key] = evaluateDefault((conditionalDefaults as ConditionalDefaults)[key]);
  }
  return actualDefaults as ActualDefaults<T>;
}

/** Merge the config over the regular defaults, evaluate the conditional defaults against it, and layer those over the regular defaults. */
export function resolveDefaults<T extends object, A extends unknown[]>(
  regularDefaults: object,
  getConditionalDefaults: (configWithRegularDefaults: T, ...args: A) => ConditionalDefaults,
  config: object,
  ...args: A
): Partial<T> {
  const configWithRegularDefaults = deepMerge(regularDefaults, config) as T;
  const conditionalDefaults = getActualDefaults(getConditionalDefaults(configWithRegularDefaults, ...args));
  return deepMerge(regularDefaults, conditionalDefaults) as Partial<T>;
}

export const defaultRule = { condition: () => true, suffix: null };
