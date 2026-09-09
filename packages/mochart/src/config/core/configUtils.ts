import { deepMerge } from './deepMerge';

type ConfigRecord = Record<string, unknown>;

function isObject(v: unknown): v is ConfigRecord {
  return v !== null && v !== undefined && typeof v === "object";
}

/** Map key for an id or reference value; objects get null (the type validators report them) rather than a coercion that throws on a null-proto clone. */
export function getConfigKey(value: unknown): string | null {
  return typeof value === 'object' && value !== null ? null : String(value);
}

export function filterConfigs(configs: unknown): ConfigRecord[] {
  return Array.isArray(configs) ? configs.filter(filterConfig) : [];
}

export function filterConfig(config: unknown): config is ConfigRecord {
  return isObject(config) && config.ignore !== true
}

/** Built list sections drop ignored/non-object raw entries, so errors report at the filtered raw index. */
export function getRawIndices(sections: unknown[]): number[];
export function getRawIndices(sections: unknown): number[] | null;
export function getRawIndices(sections: unknown): number[] | null {
  if (!Array.isArray(sections)) {
    return null;
  }
  const rawIndices: number[] = [];
  for (let i = 0; i < sections.length; i++) {
    if (filterConfig(sections[i])) {
      rawIndices.push(i);
    }
  }
  return rawIndices;
}

export function configWithAll(config: unknown, allConfig: unknown): unknown {
  if (isObject(allConfig)) {
    if (Array.isArray(config)) {
      return config.map(aConfig => configWithAll(aConfig, allConfig));
    }
    else if (isObject(config)) {
      return deepMerge<ConfigRecord>(allConfig, config);
    }
    else {
      return { ...allConfig };
    }
  }
  else {
    return config;
  }
}
