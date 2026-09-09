// createHistogram bins raw values (Sturges' count, round edges) and returns
// chart-ready rows plus config fragments to spread into a chart config.
import { createHistogram } from '@mochart/core';
import type { MochartInputConfig } from '@mochart/core';

// 60 response-time samples (ms).
const samples = [
  62, 71, 78, 84, 91, 97,
  102, 104, 108, 111, 114, 117, 119, 121, 124, 126,
  128, 131, 133, 136, 138, 141, 143, 145, 147, 149,
  151, 153, 156, 158, 161, 164, 167, 170, 173, 176,
  179, 183, 186, 190, 193, 196, 199,
  202, 206, 211, 217, 222, 228, 233, 239, 244, 249,
  254, 261, 270, 281, 293, 305, 318
];

const histogram = createHistogram(samples, { seriesTitle: 'Requests' });

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Response Time Distribution' },
  categoryAxis: { ...histogram.categoryAxis, title: { text: 'Response time (ms)' } },
  valueAxes: [{ min: 0 }],
  series: [histogram.seriesConfig]
};

export const data = histogram.data;
