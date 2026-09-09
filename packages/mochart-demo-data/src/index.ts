import demosJson from './demos.json';

import type { DataObject, Demo, DemoConfig, DemoData, DemoManifestEntry, DemoRandomConfig } from './types';

export type {
  DataObject, Demo, DemoConfig, DemoData, DemoRandomConfig,
  ErrorBarsRandomConfig, HeatmapRandomConfig, HistogramRandomConfig, PieRandomConfig,
  RandomConfig, WalkRandomConfig, WaterfallRandomConfig
} from './types';

type ModuleMap = Record<string, unknown>;

const configModules = import.meta.glob('./config/*.json', { eager: true, import: 'default' }) as ModuleMap;
const testConfigModules = import.meta.glob('./config/test/*.json', { eager: true, import: 'default' }) as ModuleMap;
const dataModules = import.meta.glob('./data/*.json', { eager: true, import: 'default' }) as ModuleMap;
const randomModules = import.meta.glob('./random/*.json', { eager: true, import: 'default' }) as ModuleMap;

function getModule(modules: ModuleMap, dir: string, file: string): unknown {
  const mod = modules[dir + file];
  if (mod === undefined) {
    throw new Error('demo file not found: ' + dir + file);
  }
  return mod;
}

const { demos, testDemos } = demosJson as { demos: DemoManifestEntry[]; testDemos: DemoManifestEntry[] };

// deep copies: nested config sections and data objects must never be shared
// module-level singletons, or one consumer's in-place edit poisons the rest
function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildDemo(entry: DemoManifestEntry, configModuleMap: ModuleMap, configDir: string): Demo {
  const { id, title, description, notes, config, data, random, generator } = entry;
  return {
    id,
    title,
    description,
    notes,
    config: deepCopy(getModule(configModuleMap, configDir, config) as DemoConfig),
    data: deepCopy(getModule(dataModules, './data/', data) as DataObject[]),
    random: deepCopy(getModule(randomModules, './random/', random) as DemoRandomConfig),
    generator
  };
}

const demoIds: string[] = [];
const testDemoIds: string[] = [];
const demoObjectMap: Record<string, Demo> = {};

// one map for both groups, so a repeated id would drop a demo while its id still lists twice
function addDemo(entry: DemoManifestEntry, configModuleMap: ModuleMap, configDir: string, ids: string[]): void {
  const demo = buildDemo(entry, configModuleMap, configDir);
  if (demoObjectMap[demo.id] !== undefined) {
    throw new Error('duplicate demo id: ' + demo.id);
  }
  ids.push(demo.id);
  demoObjectMap[demo.id] = demo;
}

demos.forEach(entry => addDemo(entry, configModules, './config/', demoIds));
testDemos.forEach(entry => addDemo(entry, testConfigModules, './config/test/', testDemoIds));

const demoData: DemoData = {
  demoIds,
  demoObjectMap,
  testDemoIds
};

export default demoData;
