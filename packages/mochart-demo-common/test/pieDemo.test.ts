import { describe, it, expect } from 'vitest';

import { enhanceConfig } from '@mochart/core';

import demoData from '@mochart/demo-data';

import { getPieSlices, applyPieSliceValue, getPieStepCycle, getPieStepFilteredIds, applyReportedSeriesFilter, getPieSequenceSteps } from '../src/pieDemo';

const pieDemo = demoData.demoObjectMap['pie'];
const donutDemo = demoData.demoObjectMap['donut'];

describe('getPieSlices', () => {
  it('returns one slice per series with id, title and property', () => {
    const slices = getPieSlices(enhanceConfig(pieDemo.config));
    expect(slices).toHaveLength(6);
    expect(slices[0].property).toBe('slice0');
    expect(slices[0].title).toBe('Subscriptions');
    expect(slices.every(slice => typeof slice.id === 'string' && slice.id.length > 0)).toBe(true);
  });
});

describe('applyPieSliceValue', () => {
  it('sets the edited slice value', () => {
    const row = { ...pieDemo.data[0] };
    applyPieSliceValue(row, 'slice0', 999);
    expect(row['slice0']).toBe(999);
  });

  it('touches nothing else — shares are derived by the chart, not stored', () => {
    const slices = getPieSlices(enhanceConfig(donutDemo.config));
    const row = { ...donutDemo.data[0] };
    applyPieSliceValue(row, slices[0].property, 50);
    expect(Object.keys(row)).toEqual(Object.keys(donutDemo.data[0]));
    for (const slice of slices.slice(1)) {
      expect(row[slice.property]).toBe(donutDemo.data[0][slice.property]);
    }
  });
});

describe('getPieStepFilteredIds', () => {
  const ids = ['s0', 's1', 's2', 's3', 's4', 's5'];

  it('filters the last (step + chartIndex) mod cycle slices', () => {
    expect(getPieStepFilteredIds(ids, 0, 0)).toEqual({});
    expect(getPieStepFilteredIds(ids, 1, 0)).toEqual({ s5: true });
    expect(getPieStepFilteredIds(ids, 2, 1)).toEqual({ s3: true, s4: true, s5: true });
  });

  it('always keeps at least one slice', () => {
    for (let chartIndex = 0; chartIndex < 4; chartIndex++) {
      for (let step = -3; step < 12; step++) {
        const filtered = Object.keys(getPieStepFilteredIds(ids, chartIndex, step)).length;
        expect(ids.length - filtered).toBeGreaterThanOrEqual(1);
      }
    }
    const gaugeIds = ['a', 'b', 'c'];
    for (let step = 0; step < 5; step++) {
      expect(gaugeIds.length - Object.keys(getPieStepFilteredIds(gaugeIds, 0, step)).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('reaches a single remaining slice within the cycle', () => {
    expect(getPieStepFilteredIds(ids, 0, ids.length - 1)).toEqual({ s1: true, s2: true, s3: true, s4: true, s5: true });
  });

  it('matches getPieStepCycle', () => {
    expect(getPieStepCycle(ids)).toBe(ids.length);
    expect(getPieStepCycle([])).toBe(1);
  });
});

describe('getPieSequenceSteps', () => {
  it('filters down to one remaining, then restores to empty', () => {
    const steps = getPieSequenceSteps(['a', 'b', 'c', 'd']);
    expect(steps.map(step => Object.keys(step).sort().join(','))).toEqual([
      'd', 'c,d', 'b,c,d', 'c,d', 'd', ''
    ]);
  });

  it('is empty-ended and short for a three-slice gauge', () => {
    const steps = getPieSequenceSteps(['a', 'b', 'c']);
    expect(steps.map(step => Object.keys(step).sort().join(','))).toEqual(['c', 'b,c', 'c', '']);
  });
});

describe('applyReportedSeriesFilter', () => {
  it('keeps only the user delta when a stepped chart reports its union', () => {
    // chart shows step overlay {c,d}; the user filters "a" on that chart
    const next = applyReportedSeriesFilter({}, { c: true, d: true }, { c: true, d: true, a: true });
    expect(next).toEqual({ a: true });
  });

  it('removes a user filter the chart reports as unfiltered', () => {
    const next = applyReportedSeriesFilter({ a: true }, { a: true, d: true }, { d: true });
    expect(next).toEqual({});
  });

  it('treats unfiltering a step-only slice as no user filter change', () => {
    const next = applyReportedSeriesFilter({}, { d: true }, {});
    expect(next).toEqual({});
  });

  it('keeps a user filter that overlaps the step overlay', () => {
    // "d" is user-filtered AND step-filtered; toggling "a" must not drop it
    const next = applyReportedSeriesFilter({ d: true }, { c: true, d: true }, { c: true, d: true, a: true });
    expect(next).toEqual({ d: true, a: true });
  });

  it('acts as plain replacement when no overlay is shown', () => {
    const next = applyReportedSeriesFilter({ a: true }, { a: true }, { b: true });
    expect(next).toEqual({ b: true });
  });
});
