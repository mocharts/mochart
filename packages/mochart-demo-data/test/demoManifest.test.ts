// the manifest and the JSON it references are asserted into their types, so nothing but these checks reads their real shape
import { describe, it, expect } from 'vitest';

import demoData from '../src';
import demosJson from '../src/demos.json';
import type { DemoManifestEntry } from '../src/types';

const { demos, testDemos } = demosJson as { demos: DemoManifestEntry[]; testDemos: DemoManifestEntry[] };

// keys only: the loaders are never called, so this lists the files without parsing them
const fileNames = (modules: Record<string, unknown>): string[] =>
  Object.keys(modules).map(path => path.slice(path.lastIndexOf('/') + 1));

const configFiles = fileNames(import.meta.glob('../src/config/*.json'));
const testConfigFiles = fileNames(import.meta.glob('../src/config/test/*.json'));
const dataFiles = fileNames(import.meta.glob('../src/data/*.json'));
const randomFiles = fileNames(import.meta.glob('../src/random/*.json'));

const groups = [
  { name: 'demos', entries: demos, configFiles },
  { name: 'testDemos', entries: testDemos, configFiles: testConfigFiles }
];

const requiredKeys = ['id', 'title', 'config', 'data', 'random'] as const;
const optionalStringKeys = ['description', 'notes', 'generator'] as const;
const knownKeys = new Set<string>([...requiredKeys, ...optionalStringKeys, 'goldenCategoryShift']);

describe('the demos manifest', () => {
  it('gives every demo its own id, in both groups and across them', () => {
    const ids = [...demos, ...testDemos].map(entry => entry.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    expect(Object.keys(demoData.demoObjectMap)).toHaveLength(demoData.demoIds.length + demoData.testDemoIds.length);
  });

  it('references a config, data, and random file that exists for every entry', () => {
    const missing: string[] = [];
    for (const group of groups) {
      group.entries.forEach((entry, index) => {
        const where = group.name + '[' + index + '] (' + entry.id + ')';
        if (!group.configFiles.includes(entry.config)) missing.push(where + ': config ' + entry.config);
        if (!dataFiles.includes(entry.data)) missing.push(where + ': data ' + entry.data);
        if (!randomFiles.includes(entry.random)) missing.push(where + ': random ' + entry.random);
      });
    }
    expect(missing).toEqual([]);
  });

  it('leaves no file unreferenced', () => {
    const referenced = (key: 'config' | 'data' | 'random', entries: DemoManifestEntry[]) =>
      new Set(entries.map(entry => entry[key]));
    const configReferences = referenced('config', demos);
    const testConfigReferences = referenced('config', testDemos);
    const dataReferences = referenced('data', [...demos, ...testDemos]);
    const randomReferences = referenced('random', [...demos, ...testDemos]);

    expect(configFiles.filter(file => !configReferences.has(file))).toEqual([]);
    expect(testConfigFiles.filter(file => !testConfigReferences.has(file))).toEqual([]);
    expect(dataFiles.filter(file => !dataReferences.has(file))).toEqual([]);
    expect(randomFiles.filter(file => !randomReferences.has(file))).toEqual([]);
  });

  it('writes every entry in the shape the manifest type declares', () => {
    const problems: string[] = [];
    for (const group of groups) {
      group.entries.forEach((entry, index) => {
        const record = entry as unknown as Record<string, unknown>;
        const where = group.name + '[' + index + '] (' + String(record['id']) + ')';
        for (const key of requiredKeys) {
          if (typeof record[key] !== 'string' || record[key] === '') problems.push(where + ': ' + key + ' must be a non-empty string');
        }
        for (const key of optionalStringKeys) {
          if (record[key] !== undefined && (typeof record[key] !== 'string' || record[key] === '')) {
            problems.push(where + ': ' + key + ' must be a non-empty string when present');
          }
        }
        if (record['goldenCategoryShift'] !== undefined && typeof record['goldenCategoryShift'] !== 'number') {
          problems.push(where + ': goldenCategoryShift must be a number when present');
        }
        for (const key of Object.keys(record)) {
          if (!knownKeys.has(key)) problems.push(where + ': unknown key ' + key);
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it('builds every entry into a demo with its config, data, and random config', () => {
    for (const id of [...demoData.demoIds, ...demoData.testDemoIds]) {
      const demo = demoData.demoObjectMap[id];
      expect(demo.config).toBeTypeOf('object');
      expect(Array.isArray(demo.data)).toBe(true);
      expect(demo.random).toBeTypeOf('object');
    }
  });
});
