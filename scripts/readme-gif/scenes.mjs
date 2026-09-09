// Scenes for the README recordings. Each scene mounts one chart and then drives it
// through a scripted sequence of data and config updates; the page waits on the
// durations below, so keep them in sync with the animation config of each scene.
//
// A scene calls begin() once its mount animation has settled; recording starts
// there, and every scene ends on the data it started with, so the GIF loops
// without a jump. Scenes take the theme so the dark recording can brighten the
// series colours against GitHub's dark background.

const PHASE = 1000; // ms per animation phase; each scene's animation config repeats it
const HOLD = 700;   // ms to rest on a settled state before the next update

const animation = {
  initialDuration: PHASE,
  expansionDuration: PHASE,
  valueChangeDuration: PHASE,
  contractionDuration: PHASE
};

const size = { width: 800, height: 450 };

const darkColors = ['#6ea8dc', '#f28c9a', '#5cbf6a', '#e3d35c', '#7fd8f2', '#c85aa0', '#cfcfcf'];

function colorPalette(theme) {
  if (theme !== 'dark') {
    return {};
  }
  const state = { strokeColors: darkColors, fillColors: darkColors };
  const palette = { normal: state, focused: state, defocused: state };
  return { shape: palette, marker: palette, label: palette };
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

function rows(properties, values) {
  return values.map((row, index) => {
    const entry = { month: months[index] ?? `M${index + 1}` };
    properties.forEach((property, propertyIndex) => {
      entry[property] = row[propertyIndex];
    });
    return entry;
  });
}

// --- stacked: values grow past the axis, a category joins, then everything settles back ---

const stackedProperties = ['north', 'south', 'west'];
const stackedStart = rows(stackedProperties, [
  [12, 8, 6], [14, 9, 7], [11, 12, 8], [16, 10, 9], [13, 11, 12], [15, 13, 10]
]);
const stackedGrown = rows(stackedProperties, [
  [22, 14, 9], [26, 15, 12], [20, 21, 14], [30, 17, 15], [24, 19, 22], [28, 23, 18]
]);
const stackedExtended = [...stackedGrown, { month: 'Jul', north: 32, south: 24, west: 20 }];

const stacked = {
  ...size,
  config: (theme) => ({
    version: '1.0.0',
    animation,
    colorPalette: colorPalette(theme),
    title: { text: 'Revenue by region' },
    legend: { visible: true },
    categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', valueLabel: 'Month' },
    valueAxes: [{ id: 'va', min: 0 }],
    seriesStacks: [{ id: 'stack', axis: 'va' }],
    seriesDefaults: { renderer: 'bar', axis: 'va', stack: 'stack', marker: { shape: null } },
    series: [
      { property: 'north', title: 'North' },
      { property: 'south', title: 'South' },
      { property: 'west', title: 'West' }
    ]
  }),
  data: stackedStart,
  async run({ wait, begin, setData }) {
    await wait(PHASE);                 // mount animation, not recorded
    begin();
    await wait(HOLD);
    setData(stackedGrown);             // expansion + value change
    await wait(PHASE * 2 + HOLD);
    setData(stackedExtended);          // category joins: expansion + value change
    await wait(PHASE * 2 + HOLD);
    setData(stackedStart);             // value change + contraction on both axes
    await wait(PHASE * 2 + HOLD);
  }
};

// --- mixed: bars and a line, a series arrives through a config change and leaves again ---

const mixedProperties = ['orders', 'returns', 'margin'];
const mixedStart = rows(mixedProperties, [
  [40, 6, 31], [52, 9, 35], [47, 7, 33], [61, 12, 38], [58, 10, 41], [66, 11, 44]
]);
const mixedShift = rows(mixedProperties, [
  [48, 8, 36], [44, 12, 30], [63, 9, 42], [55, 14, 37], [72, 11, 47], [69, 15, 45]
]);

const mixedSeries = [
  { property: 'orders', title: 'Orders', renderer: 'bar' },
  { property: 'returns', title: 'Returns', renderer: 'bar' }
];
const marginSeries = { property: 'margin', title: 'Margin', renderer: 'line', axis: 'pct', marker: { shape: 'circle' } };

const mixedConfig = (theme, series, valueAxes) => ({
  version: '1.0.0',
  animation,
  colorPalette: colorPalette(theme),
  title: { text: 'Orders and margin' },
  legend: { visible: true },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal', valueLabel: 'Month' },
  valueAxes,
  seriesGroups: [{ id: 'group' }],
  seriesDefaults: { axis: 'va', group: 'group', stack: null, marker: { shape: null } },
  series
});

const mixed = {
  ...size,
  config: (theme) => mixedConfig(theme, mixedSeries, [{ id: 'va', min: 0 }]),
  data: mixedStart,
  async run({ wait, begin, theme, setData, setConfig }) {
    await wait(PHASE);
    begin();
    await wait(HOLD);
    setConfig(mixedConfig(theme, [...mixedSeries, marginSeries], [{ id: 'va', min: 0 }, { id: 'pct', min: 0, side: 'end' }]));
    await wait(PHASE * 2 + HOLD);      // series transition on a second axis
    setData(mixedShift);
    await wait(PHASE * 2 + HOLD);
    setData(mixedStart);
    await wait(PHASE * 2 + HOLD);
    setConfig(mixedConfig(theme, mixedSeries, [{ id: 'va', min: 0 }]));
    await wait(PHASE * 2 + HOLD);
  }
};

// --- window: an area chart whose category window slides, so the staged category zoom shows ---

function windowRows(offset, count) {
  const out = [];
  for (let index = 0; index < count; index += 1) {
    const day = offset + index;
    const base = 40 + 18 * Math.sin(day / 2.4) + 9 * Math.cos(day / 1.3);
    out.push({ day: `D${day}`, load: Math.round(base), peak: Math.round(base + 12 + 6 * Math.sin(day)) });
  }
  return out;
}

const windowStart = windowRows(1, 10);
const windowSlid = windowRows(6, 10);
const windowFar = windowRows(12, 10);

const window_ = {
  ...size,
  config: (theme) => ({
    version: '1.0.0',
    animation,
    colorPalette: colorPalette(theme),
    title: { text: 'Server load, sliding window' },
    legend: { visible: true },
    categoryAxis: { property: 'day', type: 'string', scale: 'ordinal', valueLabel: 'Day' },
    valueAxes: [{ id: 'va', min: 0 }],
    seriesDefaults: { axis: 'va', stack: null, marker: { shape: 'circle' } },
    series: [
      { property: 'peak', title: 'Peak', renderer: 'line' },
      { property: 'load', title: 'Load', renderer: 'area' }
    ]
  }),
  data: windowStart,
  async run({ wait, begin, setData }) {
    await wait(PHASE);
    begin();
    await wait(HOLD);
    setData(windowSlid);
    await wait(PHASE * 3 + HOLD);      // category zoom out, tween, zoom in
    setData(windowFar);
    await wait(PHASE * 3 + HOLD);
    setData(windowStart);
    await wait(PHASE * 3 + HOLD);
  }
};

export const scenes = { stacked, mixed, window: window_ };
