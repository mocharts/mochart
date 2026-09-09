import { describe, it, expect } from 'vitest';

import { getRotationGrid, rotationConfigs } from '../src/rotationConfigs';

// The column arithmetic (and its 400px minimum) lived in all six ports.
describe('getRotationGrid', () => {
  it('fits as many 400px-or-wider square columns as the container allows', () => {
    expect(getRotationGrid(1200)).toEqual({ cols: 3, colWidth: 400 });
    expect(getRotationGrid(1000)).toEqual({ cols: 2, colWidth: 500 });
  });

  it('keeps one column below the minimum rather than shrinking further', () => {
    expect(getRotationGrid(390)).toEqual({ cols: 1, colWidth: 390 });
  });

  it('reports a zero cell for an unmeasured container, which the ports read as nothing to lay out', () => {
    expect(getRotationGrid(0)).toEqual({ cols: 1, colWidth: 0 });
  });

  it('floors the cell size, so a full row of cells never overruns the container', () => {
    const { cols, colWidth } = getRotationGrid(1001);
    expect(cols * colWidth).toBeLessThanOrEqual(1001);
  });

  it('has configs to lay out', () => {
    expect(rotationConfigs.length).toBeGreaterThan(0);
  });
});
