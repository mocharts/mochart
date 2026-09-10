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
      number: { min: overrides.seriesMin ?? 0, max: overrides.seriesMax ?? 500, round: true, limitToAxisConfig: false },
      missing: { probability: 0 },
      reuse: { global: false, step: true }
    }
  };
}

// ---------------------------------------------------------------------------
// Date/time axis: readings logged at uneven times on a linear date scale
// ---------------------------------------------------------------------------

export const timeSeriesConfig: DemoConfig = {
  version: '1.0.0',
  title: { text: 'Sensor Readings, Uneven Sampling' },
  categoryAxis: {
    property: 'time',
    valueLabel: 'Logged',
    type: 'date',
    scale: 'linear',
    dateUTC: true,
    title: { text: 'Time logged' },
    tickLabel: { format: '%b %-d %H:%M' },
    valueFormat: '%b %-d, %H:%M',
    gridLine: { visible: true }
  },
  valueAxes: [
    { id: 'VA0', min: 0, max: 100, gridLine: { visible: true } }
  ],
  seriesDefaults: { axis: 'VA0', renderer: 'line', marker: { shape: 'circle' } },
  series: [
    { property: 'temperature', title: 'Temperature (C)' },
    { property: 'humidity', title: 'Humidity (%)' }
  ]
};

// Bursts of readings a quarter to a few hours apart, then gaps of a day or
// more: on the linear scale the bursts bunch up and the gaps stay open.
export const timeSeriesData: DataObject[] = [
  { time: '2026-03-03T06:00:00Z', temperature: 18, humidity: 62 },
  { time: '2026-03-03T07:30:00Z', temperature: 21, humidity: 58 },
  { time: '2026-03-03T09:00:00Z', temperature: 24, humidity: 55 },
  { time: '2026-03-03T10:00:00Z', temperature: 26, humidity: 51 },
  { time: '2026-03-04T18:00:00Z', temperature: 23, humidity: 64 },
  { time: '2026-03-04T18:45:00Z', temperature: 22, humidity: 66 },
  { time: '2026-03-04T20:00:00Z', temperature: 19, humidity: 71 },
  { time: '2026-03-06T02:00:00Z', temperature: 12, humidity: 84 },
  { time: '2026-03-06T02:30:00Z', temperature: 12, humidity: 86 },
  { time: '2026-03-06T03:15:00Z', temperature: 11, humidity: 88 },
  { time: '2026-03-06T05:00:00Z', temperature: 13, humidity: 83 },
  { time: '2026-03-06T11:00:00Z', temperature: 22, humidity: 60 },
  { time: '2026-03-07T08:00:00Z', temperature: 17, humidity: 69 },
  { time: '2026-03-07T09:00:00Z', temperature: 20, humidity: 63 }
];

// Quarter-hour slots across the same four days: a random pick of fourteen of
// them is uneven by nature, so every seed keeps the point of the demo.
export const timeSeriesRandom = makeGenericRandom({
  categoryCount: 14,
  categoryDate: { min: '2026-03-03T00:00:00Z', max: '2026-03-07T12:00:00Z', interval: 15, intervalUnit: 'minute' },
  seriesMin: 5,
  seriesMax: 95
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
// Legend placement and styling
// ---------------------------------------------------------------------------

export const legendConfig: DemoConfig = {
  version: '1.0.0',
  title: { text: 'Regional Revenue' },
  categoryAxis: { property: 'quarter', valueLabel: 'Quarter', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', title: { text: 'Revenue ($k)' }, min: 0, gridLine: { visible: true } }],
  seriesDefaults: { axis: 'VA0', renderer: 'line' },
  series: [
    { property: 'north', title: 'North America' },
    { property: 'emea', title: 'Europe, Middle East and Africa' },
    { property: 'apac', title: 'Asia Pacific' },
    { property: 'latam', title: 'Latin America' }
  ],
  legend: {
    position: 'top',
    align: 'right',
    alignedToAxes: false,
    margin: { top: 0, right: 0, bottom: 8, left: 0 },
    padding: { top: 2, right: 6, bottom: 2, left: 6 },
    backgroundStyle: {
      strokeColor: 'currentColor',
      strokeOpacity: 0.25,
      strokeWidth: 1,
      fillColor: 'currentColor',
      fillOpacity: 0.04
    },
    item: {
      margin: { top: 1, right: 4, bottom: 1, left: 4 },
      padding: { top: 2, right: 4, bottom: 2, left: 4 },
      textStyle: { fillColor: 'currentColor', fillOpacity: 0.85 }
    },
    icon: { size: 10, spacing: 6 },
    strikeThroughFiltered: true,
    truncation: { enabled: true, text: '…' }
  }
};

export const legendData: DataObject[] = [
  { quarter: 'Q1', north: 420, emea: 310, apac: 180, latam: 95 },
  { quarter: 'Q2', north: 455, emea: 335, apac: 210, latam: 110 },
  { quarter: 'Q3', north: 470, emea: 320, apac: 245, latam: 120 },
  { quarter: 'Q4', north: 510, emea: 360, apac: 270, latam: 140 }
];

export const legendRandom = makeGenericRandom({ categoryCount: 4, seriesMin: 80, seriesMax: 520 });

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
