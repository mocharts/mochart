// A date window sliding forward by five days — more than half its width — under
// the two category-domain modes. The default ('staged') zooms out over both
// windows and back in; 'auto' classifies the barely-overlapping change as a
// translation and slides the window during the value phase instead.
import type { MochartInputConfig } from '@mochart/core';

const durations = {
  expansionDuration: 900,
  valueChangeDuration: 900,
  contractionDuration: 900
};

const baseConfig: MochartInputConfig = {
  version: '1.0.0',
  categoryAxis: {
    property: 'date',
    type: 'date',
    scale: 'linear',
    dateUTC: true,
    tickLabel: { format: '%b %d' }
  },
  seriesDefaults: { renderer: 'line', marker: { shape: 'circle' } },
  series: [{ property: 'value', title: 'Value' }]
};

// categoryDomainChange defaults to 'staged', so the first config leaves it unset
export const config: MochartInputConfig = {
  ...baseConfig,
  title: { text: 'categoryDomainChange: staged (the default)' },
  animation: durations
};

export const slideConfig: MochartInputConfig = {
  ...baseConfig,
  title: { text: 'categoryDomainChange: auto' },
  animation: { ...durations, categoryDomainChange: 'auto' }
};

const day = (index: number) => new Date(Date.UTC(2026, 0, 1 + index)).toISOString();
const values = [12, 18, 15, 22, 19, 25, 21];

export const data = values.map((value, index) => ({ date: day(index), value }));

// the same seven values, five days later
export const altData = values.map((value, index) => ({ date: day(index + 5), value }));
