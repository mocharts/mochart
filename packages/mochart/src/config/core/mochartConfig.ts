import { NONE } from './constants';
import { filterConfig, filterConfigs, getConfigKey } from './configUtils';
import { deepClone, deepMerge, deepMergeAll, withoutUndefined } from './deepMerge';
import { getDefaults } from '../defaults/mochartConfig';
import type { ConfigValidation, MochartConfig } from '../../types/config';

type ConfigRecord = Record<string, unknown>;

export const sectionKeyAllMap: Record<string, string> = {
  linearGradients: 'linearGradientDefaults',
  patterns: 'patternDefaults',
  radialGradients: 'radialGradientDefaults',
  valueAxes: 'valueAxisDefaults',
  series: 'seriesDefaults',
  seriesGroups: 'seriesGroupDefaults',
  seriesStacks: 'seriesStackDefaults'
};

function isObject(v: unknown): v is ConfigRecord {
  return v !== null && v !== undefined && typeof v === "object";
}

const configsToIdMap = <T>(configs: ConfigRecord[], value: (config: ConfigRecord) => T): Record<string, T> => {
  const map: Record<string, T> = Object.create(null); // null proto: ids like "constructor" must not hit Object.prototype
  if (Array.isArray(configs)) {
    for (const config of configs) {
      const key = getConfigKey(config.id);
      if (key !== null) {
        map[key] = value(config);
      }
    }
  }
  return map;
};

function isInteger(v: unknown): v is number {
  return v !== undefined && (typeof v === "number" || v instanceof Number) && isFinite(v as number) && (v as number) % 1 === 0;
}

function isString(v: unknown): v is string {
  return v !== undefined && (typeof v === "string" || v instanceof String);
}

function getOrder(v: unknown): number {
  return isInteger(v) ? v : 0;
}

const orderComparator = (a: unknown, b: unknown): number => (isObject(a) && isObject(b)) ? (getOrder(a.order) - getOrder(b.order)) : (isObject(a) ? -1 : (isObject(b) ? 1 : 0));

const configsToOrderedList = (configs: ConfigRecord[]): ConfigRecord[] => {
  if (Array.isArray(configs)) {
    const ordered = configs.slice();
    ordered.sort(orderComparator);
    return ordered;
  }
  return [];
};

const addToIdMap = (idMap: Record<string, ConfigRecord[]>, configs: ConfigRecord[], key: string): void => {
  if (Array.isArray(configs)) {
    for (const config of configs) {
      const reference = config[key];
      if (isObject(config) && typeof reference === 'string' && reference !== NONE && idMap[reference] !== undefined) {
        idMap[reference]!.push(config);
      }
    }
  }
};

const assignConfigReferences = (configs: ConfigRecord[], referenceKey: string, referenceName: string, configMap: Record<string, ConfigRecord>, configDescriptor: string): void => {
  if (Array.isArray(configs)) {
    for (const config of configs) {
      if (isObject(config) && config[referenceKey] !== undefined) {
        if (config[referenceName] !== undefined) {
          console.warn('mochartConfig.' + configDescriptor + '[' + getConfigKey(config.id) + '] had a ' + referenceName + ' property that will be overriden');
        }
        const key = getConfigKey(config[referenceKey]);
        config[referenceName] = key !== null ? configMap[key] : undefined;
      }
    }
  }
};

const assignConfigListReferences = (configs: ConfigRecord[], referenceName: string, configListMap: Record<string, ConfigRecord[]>, configDescriptor: string): void => {
  if (Array.isArray(configs)) {
    for (const config of configs) {
      if (isObject(config)) {
        if (config[referenceName] !== undefined) {
          console.warn('mochartConfig.' + configDescriptor + '[' + getConfigKey(config.id) + '] had a ' + referenceName + ' property that will be overriden');
        }
        const key = getConfigKey(config.id);
        config[referenceName] = key !== null ? configListMap[key] : undefined;
      }
    }
  }
};

const assignConfigListIndexReferences = (configs: ConfigRecord[], referenceName: string, listReferenceName: string, configDescriptor: string): void => {
  if (Array.isArray(configs)) {
    for (const config of configs) {
      if (isObject(config)) {
        if (config[referenceName] !== undefined) {
          console.warn('mochartConfig.' + configDescriptor + '[' + getConfigKey(config.id) + '] had a ' + referenceName + ' property that will be overriden');
        }
        config[referenceName] = arrayToIdIndexMap(config[listReferenceName]);
      }
    }
  }
}

// a group lays its series out side by side, one sub-slot per stack (stack-mates share one) or per unstacked series
const assignGroupSubSlots = (groupConfigs: ConfigRecord[]): void => {
  if (Array.isArray(groupConfigs)) {
    for (const groupConfig of groupConfigs) {
      if (isObject(groupConfig)) {
        const subSlotIndicesById: Record<string, number> = Object.create(null);
        const subSlotIndicesByKey: Record<string, number> = Object.create(null);
        let subSlotCount = 0;
        for (const seriesConfig of Array.isArray(groupConfig.seriesConfigs) ? groupConfig.seriesConfigs as ConfigRecord[] : []) {
          if (isObject(seriesConfig) && isString(seriesConfig.id)) {
            const key = isString(seriesConfig.stack) && seriesConfig.stack !== NONE ? 'stack:' + seriesConfig.stack : 'series:' + seriesConfig.id;
            if (subSlotIndicesByKey[key] === undefined) {
              subSlotIndicesByKey[key] = subSlotCount++;
            }
            subSlotIndicesById[seriesConfig.id] = subSlotIndicesByKey[key];
          }
        }
        groupConfig.subSlotIndicesById = subSlotIndicesById;
        groupConfig.subSlotCount = subSlotCount;
      }
    }
  }
};

const arrayToIdIndexMap = (configs: unknown): Record<string, number> => {
  const map: Record<string, number> = Object.create(null);
  if (Array.isArray(configs)) {
    const count = configs.length;
    let i, config;
    for (i = 0; i < count; i++) {
      config = configs[i];
      if (isObject(config) && isString(config.id)) {
        map[config.id] = i;
      }
    }
  }
  return map;
}

function validateValidation(validation: unknown): asserts validation is ConfigValidation {
  if (!isObject(validation)) {
    throw new Error('mochartConfig validation must be an object: ');
  }
  const { valid, errors, warnings } = validation;
  if (!(valid === true || valid === false)) {
    throw new Error('mochartConfig validation.valid must be a boolean');
  }
  if (!Array.isArray(errors)) {
    throw new Error('mochartConfig validation.errors must be an array');
  }
  if (!Array.isArray(warnings)) {
    throw new Error('mochartConfig validation.warnings must be an array');
  }
}

// the *Defaults section still applies to an implicit entry, which is the only entry valueAxes ever has
const copyDefaultsList = (defaultsSection: unknown[], allSection: ConfigRecord): unknown[] =>
  defaultsSection.map(entry => isObject(entry) ? deepMerge<ConfigRecord>(entry, allSection) : entry);

/** A fully independent config with `defaults` merged in: the result shares no object with either argument. `defaults` is derived from the config when omitted; pass it to share one graph across calls or to use a custom graph. */
export function getConfigWithDefaults(configWithoutDefaults: unknown, defaults: ConfigRecord = getDefaults(configWithoutDefaults)): ConfigRecord {
  if (isObject(configWithoutDefaults)) {
    const config = { ...configWithoutDefaults };
    const sectionKeys = Object.keys(defaults);
    let allSection: ConfigRecord, configSection: unknown, defaultsSection: unknown, listCount: number, i: number, aConfig: unknown, allKey: string | undefined;
    for (const sectionKey of sectionKeys) {
      allKey = sectionKeyAllMap[sectionKey];
      const possibleAllSection = allKey ? config[allKey] : undefined;
      allSection = isObject(possibleAllSection) ? possibleAllSection : {};
      configSection = config[sectionKey];
      defaultsSection = defaults[sectionKey];
      if (Array.isArray(defaultsSection)) {
        if (Array.isArray(configSection)) {
          const filteredConfigSection = filterConfigs(configSection);
          listCount = filteredConfigSection.length;
          for (i = 0; i < listCount; i++) {
            aConfig = filteredConfigSection[i];
            if (isObject(aConfig) && isObject(defaultsSection[i])) {
              filteredConfigSection[i] = deepMergeAll<ConfigRecord>(defaultsSection[i], allSection, aConfig);
            }
          }
          // every entry ignored/non-object means the section was effectively not specified
          config[sectionKey] = listCount === 0 ? copyDefaultsList(defaultsSection, allSection) : filteredConfigSection;
        }
        else if (isObject(configSection)) {
          config[sectionKey] = filterConfig(configSection)
            ? [deepMergeAll<ConfigRecord>(isObject(defaultsSection[0]) ? defaultsSection[0] : {}, allSection, configSection)]
            : copyDefaultsList(defaultsSection, allSection);
        }
        else if (configSection === undefined) {
          config[sectionKey] = copyDefaultsList(defaultsSection, allSection);
        }
      }
      else if (isObject(defaultsSection)) {
        if (isObject(configSection)) {
          config[sectionKey] = deepMerge<ConfigRecord>(defaultsSection, configSection);
        }
        else if (configSection === undefined) {
          config[sectionKey] = withoutUndefined(defaultsSection);
        }
      }
    }
    return deepClone(config);
  }
  return {};
}

function areEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === b.length) {
      const count = a.length;
      let i;
      for (i = 0; i < count; i++) {
        if (!areEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }
  }
  else if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    if (areEqual(keys, Object.keys(b))) {
      for (const key of keys) {
        if (!areEqual(a[key], b[key])) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}

const isGroup = (value: unknown): value is ConfigRecord => isObject(value) && !Array.isArray(value);

function removeSectionDefaults(defaultSectionValue: unknown, allSection: ConfigRecord, configSection: unknown): unknown {
  if (isObject(configSection)) {
    const defaultSection = isObject(defaultSectionValue) ? defaultSectionValue : {};
    const sectionKeys = Object.keys(configSection);
    const newSection: ConfigRecord = {};
    for (const sectionKey of sectionKeys) {
      // the all-config overrides the default, so an entry value equal to the default is still load-bearing under it
      const effectiveDefault = allSection[sectionKey] !== undefined ? allSection[sectionKey] : defaultSection[sectionKey];
      const sectionValue = configSection[sectionKey];
      // a grouped key is a config of its own: strip its default-equal members instead of comparing the group whole
      if (isGroup(sectionValue) && isGroup(effectiveDefault)) {
        const allGroup = isGroup(allSection[sectionKey]) ? allSection[sectionKey] : {};
        const newGroup = removeSectionDefaults(defaultSection[sectionKey], allGroup, sectionValue) as ConfigRecord;
        if (Object.keys(newGroup).length > 0) {
          newSection[sectionKey] = newGroup;
        }
      }
      else if (!areEqual(effectiveDefault, sectionValue)) {
        newSection[sectionKey] = sectionValue;
      }
    }
    return newSection;
  }
  else {
    return configSection;
  }
}

/** The minimal config: a fully independent copy of `config` with every value that matches `defaults` (or the config's own `*Defaults` sections) removed. Inverse of `getConfigWithDefaults`; `defaults` is derived from the config when omitted. */
export function getConfigWithoutDefaults(config: unknown, defaults: ConfigRecord = getDefaults(config)): ConfigRecord {
  const minimal: ConfigRecord = {};
  if (isObject(config) && isObject(defaults)) {
    const sectionKeys = Object.keys(config);
    for (const sectionKey of sectionKeys) {
      const configSection = config[sectionKey];
      const allKey = sectionKeyAllMap[sectionKey];
      const allSectionValue = allKey && config[allKey] !== undefined ? config[allKey] : {};
      const allSection = isObject(allSectionValue) ? allSectionValue : {};
      if (configSection !== undefined) {
        const defaultsSection = defaults[sectionKey];
        if (defaultsSection !== undefined) {
          if (Array.isArray(configSection)) {
            const defaultSections = Array.isArray(defaultsSection) ? defaultsSection : [];
            // defaults are built from the filtered list, so pair against it (ignored entries drop, like getConfigWithDefaults)
            const filteredConfigSection = filterConfigs(configSection);
            const newSections: unknown[] = [];
            const count = filteredConfigSection.length;
            let i, newSection;
            for (i = 0; i < count; i++) {
              newSection = removeSectionDefaults(defaultSections[i], allSection, filteredConfigSection[i]);
              newSections.push(newSection);
            }
            // defaults-only sections (e.g. seriesStacks: []) stay out, like empty objects below
            if (newSections.length > 0) {
              minimal[sectionKey] = newSections;
            }
          }
          else if (isObject(configSection)) {
            const newSection = removeSectionDefaults(defaultsSection, allSection, configSection);
            if (isObject(newSection) && Object.keys(newSection).length > 0) {
              minimal[sectionKey] = newSection;
            }
          }
          else {
            minimal[sectionKey] = configSection;
          }
        }
        else {
          minimal[sectionKey] = configSection;
        }
      }
    }
  }
  return deepClone(minimal);
}

function applyAllConfig(configs: ConfigRecord[], allConfig: unknown): ConfigRecord[] {
  if (isObject(allConfig)) {
    // cloned so the built graph shares nothing with the caller's *Defaults sections
    const ownedAllConfig = deepClone(allConfig);
    if (Array.isArray(configs)) {
      configs = configs.map(config => isObject(config) ? deepMerge<ConfigRecord>(ownedAllConfig, config) : ownedAllConfig);
    }
  }
  return configs;
}

export default function buildMochartConfig(configWithoutDefaults: unknown, configDefaults: ConfigRecord = getDefaults(configWithoutDefaults), validation?: ConfigValidation): MochartConfig {
  if (validation === undefined) {
    validation = { valid: true, errors: [], warnings: [] };
  }
  else {
    validateValidation(validation);
  }

  if (!isObject(configWithoutDefaults)) {
    return {
      validation
    } as MochartConfig;
  }
  else if (configWithoutDefaults.validation !== undefined) {
    console.warn('mochartConfig had a validation property that will be overriden');
  }

  const config = getConfigWithDefaults(configWithoutDefaults, configDefaults);
  let valueAxisConfigs = config.valueAxes as ConfigRecord[];
  let seriesStackConfigs = config.seriesStacks as ConfigRecord[];
  let seriesGroupConfigs = config.seriesGroups as ConfigRecord[];
  let seriesConfigs = config.series as ConfigRecord[];
  let linearGradientConfigs = config.linearGradients as ConfigRecord[];
  let patternConfigs = config.patterns as ConfigRecord[];
  let radialGradientConfigs = config.radialGradients as ConfigRecord[];
  const { valueAxisDefaults, seriesStackDefaults, seriesGroupDefaults, seriesDefaults, linearGradientDefaults, patternDefaults, radialGradientDefaults } = configWithoutDefaults;

  valueAxisConfigs = applyAllConfig(valueAxisConfigs, valueAxisDefaults);
  seriesStackConfigs = applyAllConfig(seriesStackConfigs, seriesStackDefaults);
  seriesGroupConfigs = applyAllConfig(seriesGroupConfigs, seriesGroupDefaults);
  seriesConfigs = applyAllConfig(seriesConfigs, seriesDefaults);
  linearGradientConfigs = applyAllConfig(linearGradientConfigs, linearGradientDefaults);
  patternConfigs = applyAllConfig(patternConfigs, patternDefaults);
  radialGradientConfigs = applyAllConfig(radialGradientConfigs, radialGradientDefaults);

  const valueAxisConfigsById = configsToIdMap(valueAxisConfigs, value => value);
  const valueAxisConfigsOrdered = configsToOrderedList(valueAxisConfigs);
  const valueAxisSeriesConfigsById = configsToIdMap(valueAxisConfigs, () => []);

  const seriesStackConfigsById = configsToIdMap(seriesStackConfigs, value => value);
  const seriesStackSeriesConfigsById = configsToIdMap(seriesStackConfigs, () => []);

  const seriesGroupConfigsById = configsToIdMap(seriesGroupConfigs, value => value);
  const seriesGroupSeriesConfigsById = configsToIdMap(seriesGroupConfigs, () => []);

  const linearGradientConfigsById = configsToIdMap(linearGradientConfigs, value => value);
  const patternConfigsById = configsToIdMap(patternConfigs, value => value);
  const radialGradientConfigsById = configsToIdMap(radialGradientConfigs, value => value);

  const seriesConfigsById = configsToIdMap(seriesConfigs, value => value);
  const seriesConfigsOrdered = configsToOrderedList(seriesConfigs);

  addToIdMap(valueAxisSeriesConfigsById, seriesConfigsOrdered, 'axis');
  addToIdMap(seriesStackSeriesConfigsById, seriesConfigsOrdered, 'stack');
  addToIdMap(seriesGroupSeriesConfigsById, seriesConfigsOrdered, 'group');

  assignConfigReferences(seriesStackConfigs, 'axis', 'valueAxisConfig', valueAxisConfigsById, 'seriesStacks');
  assignConfigReferences(seriesConfigs, 'axis', 'valueAxisConfig', valueAxisConfigsById, 'series');
  assignConfigReferences(seriesConfigs, 'stack', 'seriesStackConfig', seriesStackConfigsById, 'series');
  assignConfigReferences(seriesConfigs, 'group', 'seriesGroupConfig', seriesGroupConfigsById, 'series');
  assignConfigReferences(seriesConfigs, 'gradient', 'linearGradientConfig', linearGradientConfigsById, 'series');
  assignConfigReferences(seriesConfigs, 'gradient', 'radialGradientConfig', radialGradientConfigsById, 'series');
  assignConfigReferences(seriesConfigs, 'pattern', 'patternConfig', patternConfigsById, 'series');

  assignConfigListReferences(valueAxisConfigs, 'seriesConfigs', valueAxisSeriesConfigsById, 'valueAxisConfigs');
  assignConfigListReferences(seriesStackConfigs, 'seriesConfigs', seriesStackSeriesConfigsById, 'seriesStacks');
  assignConfigListReferences(seriesGroupConfigs, 'seriesConfigs', seriesGroupSeriesConfigsById, 'seriesGroups');

  const valueAxisConfigIndicesById = arrayToIdIndexMap(valueAxisConfigsOrdered);
  const seriesConfigIndicesById = arrayToIdIndexMap(seriesConfigsOrdered);

  assignConfigListIndexReferences(valueAxisConfigs, 'seriesConfigIndicesById', 'seriesConfigs', 'valueAxisConfigs');
  assignConfigListIndexReferences(seriesStackConfigs, 'seriesConfigIndicesById', 'seriesConfigs', 'seriesStacks');
  assignConfigListIndexReferences(seriesGroupConfigs, 'seriesConfigIndicesById', 'seriesConfigs', 'seriesGroups');
  assignGroupSubSlots(seriesGroupConfigs);

  return {
    ...config,
    valueAxes: valueAxisConfigsOrdered,
    valueAxesById: valueAxisConfigsById,
    valueAxisIndicesById: valueAxisConfigIndicesById,
    seriesGroups: seriesGroupConfigs,
    seriesGroupsById: seriesGroupConfigsById,
    seriesStacks: seriesStackConfigs,
    seriesStacksById: seriesStackConfigsById,
    series: seriesConfigsOrdered,
    seriesById: seriesConfigsById,
    seriesIndicesById: seriesConfigIndicesById,
    validation,
  } as unknown as MochartConfig;
}

/** Either side may be null (a host loading); a config appearing or going away is structural. */
export function hasConfigStructureChange(configOld: MochartConfig | null, configNew: MochartConfig | null): boolean {
  if (!configOld || !configNew) {
    return configOld !== configNew;
  }
  const oldComplete = configOld.chart !== undefined && configOld.categoryAxis !== undefined;
  const newComplete = configNew.chart !== undefined && configNew.categoryAxis !== undefined;
  if (!oldComplete || !newComplete) {
    return oldComplete !== newComplete;
  }
  if (configOld.validation.valid !== configNew.validation.valid || !configNew.validation.valid) {
    return true;
  }
  if (configOld.id !== configNew.id) {
    return true;
  }
  if (configOld.chart.type !== configNew.chart.type) {
    return true;
  }
  const { categoryAxis: categoryAxisConfig } = configOld;
  const { categoryAxis: newCategoryAxisConfig } = configNew;
  if (categoryAxisConfig.property !== newCategoryAxisConfig.property ||
      categoryAxisConfig.keyProperty !== newCategoryAxisConfig.keyProperty ||
      categoryAxisConfig.type !== newCategoryAxisConfig.type ||
      categoryAxisConfig.scale !== newCategoryAxisConfig.scale ||
      categoryAxisConfig.dateUTC !== newCategoryAxisConfig.dateUTC) {
    return true;
  }

  const { valueAxes: valueAxisConfigs } = configOld;
  const { valueAxes: newValueAxisConfigs } = configNew;
  if (valueAxisConfigs.length !== newValueAxisConfigs.length) {
    return true;
  }
  for (let valueAxisIndex = 0; valueAxisIndex < valueAxisConfigs.length; valueAxisIndex++) {
    const valueAxisConfig = valueAxisConfigs[valueAxisIndex];
    const newValueAxisConfig = newValueAxisConfigs[valueAxisIndex];
    if (valueAxisConfig.id !== newValueAxisConfig.id) {
      return true;
    }
  }

  const { seriesStacks: seriesStackConfigs } = configOld;
  const { seriesStacks: newSeriesStackConfigs } = configNew;
  if (seriesStackConfigs.length !== newSeriesStackConfigs.length) {
    return true;
  }
  for (let seriesStackIndex = 0; seriesStackIndex < seriesStackConfigs.length; seriesStackIndex++) {
    const seriesStackConfig = seriesStackConfigs[seriesStackIndex];
    const newSeriesStackConfig = newSeriesStackConfigs[seriesStackIndex];
    if (seriesStackConfig.id !== newSeriesStackConfig.id ||
        seriesStackConfig.axis !== newSeriesStackConfig.axis) {
      return true;
    }
  }

  const { series: seriesConfigs } = configOld;
  const { series: newSeriesConfigs } = configNew;
  if (seriesConfigs.length !== newSeriesConfigs.length) {
    return true;
  }

  for (let seriesIndex = 0; seriesIndex < seriesConfigs.length; seriesIndex++) {
    const seriesConfig = seriesConfigs[seriesIndex];
    const newSeriesConfig = newSeriesConfigs[seriesIndex];
    if (seriesConfig.id !== newSeriesConfig.id ||
        seriesConfig.property !== newSeriesConfig.property ||
        seriesConfig.rangeProperty !== newSeriesConfig.rangeProperty ||
        seriesConfig.errorLowProperty !== newSeriesConfig.errorLowProperty ||
        seriesConfig.errorHighProperty !== newSeriesConfig.errorHighProperty ||
        seriesConfig.markerProperty !== newSeriesConfig.markerProperty ||
        seriesConfig.colorProperty !== newSeriesConfig.colorProperty ||
        seriesConfig.labelProperty !== newSeriesConfig.labelProperty ||
        seriesConfig.tooltipProperty !== newSeriesConfig.tooltipProperty ||
        seriesConfig.axis !== newSeriesConfig.axis ||
        seriesConfig.stack !== newSeriesConfig.stack ||
        seriesConfig.group !== newSeriesConfig.group) {
      return true;
    }
  }
  return false;
}

