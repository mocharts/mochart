// New demos authored for the showcase (the gaps the demo-data gallery demos
// don't cover). Configs use the same vocabulary as the shipped demo JSON;
// datasets are small, handwritten, and deterministic.

import type { DataObject, DemoConfig, RandomConfig } from '@mochart/demo-data';

/**
 * A complete generic random spec (the generic generator trusts its shape, so
 * every field must be present) with per-demo overrides merged in.
 */
export function makeGenericRandom(overrides: {
  categoryCount?: number;
  categoryDate?: Partial<RandomConfig['category']['date']> & { enabled?: boolean };
  categoryNumber?: Partial<RandomConfig['category']['number']>;
  seriesMin?: number;
  seriesMax?: number;
} = {}): RandomConfig {
  return {
    category: {
      count: overrides.categoryCount ?? 12,
      order: { sort: true },
      missing: { probability: 0 },
      reuse: { globalFraction: 0.5, stepFraction: 0.5 },
      number: {
        min: overrides.categoryNumber?.min ?? -100,
        max: overrides.categoryNumber?.max ?? 100,
        interval: overrides.categoryNumber?.interval ?? 1
      },
      string: { minLength: 3, maxLength: 10 },
      date: {
        min: overrides.categoryDate?.min ?? '2026-01-01',
        max: overrides.categoryDate?.max ?? '2026-12-31',
        interval: overrides.categoryDate?.interval ?? 1,
        intervalUnit: overrides.categoryDate?.intervalUnit ?? 'day'
      }
    },
    series: {
      number: { min: overrides.seriesMin ?? 0, max: overrides.seriesMax ?? 500, round: true, limitToAxisConfig: true },
      missing: { probability: 0 },
      reuse: { global: false, step: true }
    }
  };
}

// ---------------------------------------------------------------------------
// Date/time axis
// ---------------------------------------------------------------------------

export const timeSeriesConfig: DemoConfig = {
  version: '1.0.0',
  title: { text: 'Sessions, March 2026' },
  categoryAxis: {
    property: 'date',
    valueLabel: 'Date',
    type: 'date',
    scale: 'linear',
    dateUTC: true,
    title: { text: 'Date' },
    tickLabel: { format: '%b %d' },
    valueFormat: '%B %d',
    gridLine: { visible: true }
  },
  valueAxes: [
    { id: 'VA0', base: 0, min: 0, title: { text: 'Sessions' }, gridLine: { visible: true } }
  ],
  series: [
    { axis: 'VA0', property: 'sessions', title: 'Sessions', renderer: 'area' },
    { axis: 'VA0', property: 'visitors', title: 'Unique visitors', renderer: 'line' }
  ]
};

export const timeSeriesData: DataObject[] = [
  { date: '2026-03-01T00:00:00Z', sessions: 182, visitors: 121 },
  { date: '2026-03-03T00:00:00Z', sessions: 264, visitors: 178 },
  { date: '2026-03-05T00:00:00Z', sessions: 241, visitors: 152 },
  { date: '2026-03-07T00:00:00Z', sessions: 128, visitors: 89 },
  { date: '2026-03-09T00:00:00Z', sessions: 305, visitors: 214 },
  { date: '2026-03-11T00:00:00Z', sessions: 356, visitors: 243 },
  { date: '2026-03-13T00:00:00Z', sessions: 289, visitors: 197 },
  { date: '2026-03-15T00:00:00Z', sessions: 176, visitors: 118 },
  { date: '2026-03-17T00:00:00Z', sessions: 312, visitors: 208 },
  { date: '2026-03-19T00:00:00Z', sessions: 384, visitors: 262 },
  { date: '2026-03-21T00:00:00Z', sessions: 341, visitors: 226 },
  { date: '2026-03-23T00:00:00Z', sessions: 219, visitors: 149 },
  { date: '2026-03-25T00:00:00Z', sessions: 398, visitors: 274 },
  { date: '2026-03-27T00:00:00Z', sessions: 421, visitors: 291 },
  { date: '2026-03-29T00:00:00Z', sessions: 366, visitors: 247 },
  { date: '2026-03-31T00:00:00Z', sessions: 302, visitors: 203 }
];

export const timeSeriesRandom = makeGenericRandom({
  categoryCount: 16,
  categoryDate: { min: '2026-03-01', max: '2026-03-31', interval: 2, intervalUnit: 'day' },
  seriesMin: 50,
  seriesMax: 450
});

// ---------------------------------------------------------------------------
// Stacked labels: a small dataset so every segment's label has room (its
// random spec is derived from these rows, like every reused entry's)
// ---------------------------------------------------------------------------

export const stackedLabelsData: DataObject[] = [
  { categoryNL: 1, value1: 12, value2: 8, value3: 5 },
  { categoryNL: 2, value1: 15, value2: 6, value3: 9 },
  { categoryNL: 4, value1: 9, value2: 11, value3: 7 },
  { categoryNL: 5, value1: 18, value2: 7, value3: 4 },
  { categoryNL: 7, value1: 11, value2: 13, value3: 8 },
  { categoryNL: 8, value1: 14, value2: 9, value3: 12 },
  { categoryNL: 10, value1: 8, value2: 12, value3: 6 },
  { categoryNL: 12, value1: 16, value2: 10, value3: 9 }
];

// ---------------------------------------------------------------------------
// Easing: a fixed axis so every seed step is a pure value change
// ---------------------------------------------------------------------------

export const easingConfig: DemoConfig = {
  version: '1.0.0',
  title: { text: 'Monthly Orders' },
  categoryAxis: {
    property: 'month',
    valueLabel: 'Month',
    type: 'number',
    scale: 'ordinal'
  },
  valueAxes: [
    { id: 'VA0', min: 0, max: 100, gridLine: { visible: true } }
  ],
  seriesDefaults: { axis: 'VA0', renderer: 'bar' },
  series: [
    { property: 'orders', title: 'Orders' }
  ],
  animation: {
    enabled: true,
    valueChangeDuration: 1500,
    focusDuration: 600,
    easing: 'sineInOut',
    focusEasing: 'sineInOut'
  }
};

export const easingData: DataObject[] = [
  { month: 1, orders: 95 },
  { month: 2, orders: 15 },
  { month: 3, orders: 60 },
  { month: 4, orders: 25 },
  { month: 5, orders: 80 },
  { month: 6, orders: 10 }
];

export const easingRandom = makeGenericRandom({
  categoryCount: 6,
  categoryNumber: { min: 1, max: 6, interval: 1 },
  seriesMin: 5,
  seriesMax: 95
});

// ---------------------------------------------------------------------------
// Focus styles (normal / focused / defocused style states)
// ---------------------------------------------------------------------------

export const focusStylesConfig: DemoConfig = {
  version: '1.0.0',
  title: { text: 'Quarterly Output by Plant' },
  categoryAxis: {
    property: 'quarter',
    valueLabel: 'Quarter',
    type: 'string',
    scale: 'ordinal'
  },
  valueAxes: [
    { id: 'VA0', base: 0, min: 0, gridLine: { visible: true } }
  ],
  seriesDefaults: {
    axis: 'VA0',
    renderer: 'bar',
    // The whole demo is these three states: hover a bar or a legend entry and
    // the focused series thickens its outline while the rest fade right back.
    shapeStyle: {
      normal: { fillOpacity: 0.85, strokeOpacity: 1 },
      focused: { fillOpacity: 1, strokeOpacity: 1, strokeWidth: 2 },
      defocused: { fillOpacity: 0.15, strokeOpacity: 0.25 }
    }
  },
  series: [
    { property: 'north', title: 'North plant' },
    { property: 'south', title: 'South plant' },
    { property: 'east', title: 'East plant' }
  ]
};

export const focusStylesData: DataObject[] = [
  { quarter: 'Q1 25', north: 214, south: 162, east: 98 },
  { quarter: 'Q2 25', north: 236, south: 148, east: 121 },
  { quarter: 'Q3 25', north: 198, south: 173, east: 133 },
  { quarter: 'Q4 25', north: 261, south: 189, east: 152 },
  { quarter: 'Q1 26', north: 247, south: 205, east: 168 },
  { quarter: 'Q2 26', north: 279, south: 217, east: 181 }
];

export const focusStylesRandom = makeGenericRandom({ categoryCount: 6, seriesMin: 60, seriesMax: 300 });

// ---------------------------------------------------------------------------
// currentColor chrome
// ---------------------------------------------------------------------------

export const currentColorConfig: DemoConfig = {
  version: '1.0.0',
  title: { text: 'Ink Follows the Page' },
  categoryAxis: {
    property: 'day',
    valueLabel: 'Day',
    type: 'string',
    scale: 'ordinal'
  },
  valueAxes: [
    { id: 'VA0', base: 0, min: 0, gridLine: { visible: true } }
  ],
  series: [
    {
      axis: 'VA0',
      property: 'ink',
      title: 'currentColor bars',
      renderer: 'bar',
      shapeStyle: {
        normal: { fillColor: 'currentColor', strokeColor: 'currentColor', fillOpacity: 0.3, strokeOpacity: 0.85 }
      }
    },
    {
      axis: 'VA0',
      property: 'accent',
      title: 'Accent line',
      renderer: 'line'
    }
  ]
};

export const currentColorData: DataObject[] = [
  { day: 'Mon', ink: 84, accent: 52 },
  { day: 'Tue', ink: 117, accent: 74 },
  { day: 'Wed', ink: 96, accent: 88 },
  { day: 'Thu', ink: 132, accent: 79 },
  { day: 'Fri', ink: 154, accent: 101 },
  { day: 'Sat', ink: 68, accent: 63 },
  { day: 'Sun', ink: 49, accent: 45 }
];

export const currentColorRandom = makeGenericRandom({ categoryCount: 7, seriesMin: 30, seriesMax: 180 });

// ---------------------------------------------------------------------------
// Editor playground (config & validation)
// ---------------------------------------------------------------------------

export const editorConfig: DemoConfig = {
  version: '1.0.0',
  title: { text: 'Edit Me' },
  categoryAxis: {
    property: 'month',
    valueLabel: 'Month',
    type: 'string',
    scale: 'ordinal'
  },
  valueAxes: [
    { id: 'VA0', base: 0, min: 0, title: { text: 'Units' }, gridLine: { visible: true } }
  ],
  series: [
    { axis: 'VA0', property: 'planned', title: 'Planned', renderer: 'bar' },
    { axis: 'VA0', property: 'actual', title: 'Actual', renderer: 'line' }
  ]
};

export const editorData: DataObject[] = [
  { month: 'Jan', planned: 120, actual: 132 },
  { month: 'Feb', planned: 140, actual: 128 },
  { month: 'Mar', planned: 155, actual: 161 },
  { month: 'Apr', planned: 150, actual: 147 },
  { month: 'May', planned: 170, actual: 183 },
  { month: 'Jun', planned: 185, actual: 179 }
];

export const editorRandom = makeGenericRandom({ categoryCount: 6, seriesMin: 80, seriesMax: 250 });
