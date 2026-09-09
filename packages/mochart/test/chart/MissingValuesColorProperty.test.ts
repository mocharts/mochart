/**
 * Regression: a missingValueMode 'connect' bar series with a colorProperty must color each bar from its
 * raw category index — the renderer used the compacted position index, so after a skipped gap every
 * later bar read the wrong category's color (heatmap grids with missing cells hit this).
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { installSvgMeasurementShims } from '../components/svgShims';
import { installFakeFrameClock, runFrames, mountContainer } from '../components/helpers';
import { getCssSelector } from '../../src/utils/ChartDom';

let mochart: typeof import('../../src');

beforeAll(async () => {
  installSvgMeasurementShims();
  installFakeFrameClock();
  mochart = await import('../../src');
});

describe('missingValueMode connect bar series with a colorProperty', () => {
  it('colors bars after a skipped category from their own color values', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
      valueAxes: [{ id: 'va' }],
      series: [{
        axis: 'va', property: 'value', renderer: 'bar', missingValueMode: 'connect',
        colorProperty: 'heat',
        colorScale: { interpolation: 'rgb', min: '#000000', max: '#ffffff' }
      }]
    });
    // The middle category has no value, so positions compact to two bars while
    // the color values stay indexed 0..2.
    const data = [
      { label: 'a', value: 5, heat: 0 },
      { label: 'b' },
      { label: 'c', value: 9, heat: 100 }
    ];
    const container = mountContainer();
    const chart = createChart(container, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(data),
      width: 300,
      height: 200
    });
    runFrames();

    expect(container.innerHTML).not.toContain('NaN');
    const fills = Array.from(container.querySelectorAll('path[fill^="rgb"]')).map((path) => path.getAttribute('fill'));
    expect(fills).toContain('rgb(0, 0, 0)');
    expect(fills).toContain('rgb(255, 255, 255)');

    chart.destroy();
  });

  // Regression: a row with a value but no color value fed undefined into the
  // color scale, painting the bar an invalid rgb(NaN, NaN, NaN).
  it('falls back to the series color for a bar whose color value is missing', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
      valueAxes: [{ id: 'va' }],
      series: [{
        axis: 'va', property: 'value', renderer: 'bar',
        colorProperty: 'heat',
        colorScale: { interpolation: 'rgb', min: '#000000', max: '#ffffff' }
      }]
    });
    const data = [
      { label: 'a', value: 5, heat: 0 },
      { label: 'b', value: 7 },
      { label: 'c', value: 9, heat: 100 }
    ];
    const container = mountContainer();
    const chart = createChart(container, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(data),
      width: 300,
      height: 200
    });
    runFrames();

    expect(container.innerHTML).not.toContain('NaN');
    const fills = Array.from(container.querySelectorAll(getCssSelector('seriesBar'))).map((path) => path.getAttribute('fill'));
    expect(fills).toHaveLength(3);
    expect(fills[0]).toBe('rgb(0, 0, 0)');
    expect(fills[2]).toBe('rgb(255, 255, 255)');
    // the color-less bar gets the default colorScale.missing neutral gray
    expect(fills[1]).toBe('#cccccc');

    chart.destroy();
  });

  it('uses an explicit colorScale.missing color for a bar without a color value', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
      valueAxes: [{ id: 'va' }],
      series: [{
        axis: 'va', property: 'value', renderer: 'bar',
        colorProperty: 'heat',
        colorScale: { interpolation: 'rgb', min: '#000000', max: '#ffffff', missing: '#ff00ff' }
      }]
    });
    expect(mochartConfig.validation.valid).toBe(true);
    const data = [
      { label: 'a', value: 5, heat: 0 },
      { label: 'b', value: 7 },
      { label: 'c', value: 9, heat: 100 }
    ];
    const container = mountContainer();
    const chart = createChart(container, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(data),
      width: 300,
      height: 200
    });
    runFrames();

    const fills = Array.from(container.querySelectorAll(getCssSelector('seriesBar'))).map((path) => path.getAttribute('fill'));
    expect(fills[1]).toBe('#ff00ff');

    chart.destroy();
  });

  it('falls back to the series fill for a bar without a color value when missing is null', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
      valueAxes: [{ id: 'va' }],
      series: [{
        axis: 'va', property: 'value', renderer: 'bar',
        colorProperty: 'heat',
        colorScale: { interpolation: 'rgb', min: '#000000', max: '#ffffff', missing: null },
        shapeStyle: { normal: { fillColor: '#336699', strokeColor: '#336699' } }
      }]
    });
    expect(mochartConfig.validation.valid).toBe(true);
    const data = [
      { label: 'a', value: 5, heat: 0 },
      { label: 'b', value: 7 },
      { label: 'c', value: 9, heat: 100 }
    ];
    const container = mountContainer();
    const chart = createChart(container, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(data),
      width: 300,
      height: 200
    });
    runFrames();

    const fills = Array.from(container.querySelectorAll(getCssSelector('seriesBar'))).map((path) => path.getAttribute('fill'));
    expect(fills[1]).toBe('#336699');

    chart.destroy();
  });

  it('renders every bar with the series color when no row has a color value', () => {
    const { createChart, enhanceConfig, ArrayOfObjectsDataProvider } = mochart;
    const mochartConfig = enhanceConfig({
      version: '1.0.0',
      categoryAxis: { property: 'label', type: 'string', scale: 'ordinal' },
      valueAxes: [{ id: 'va' }],
      series: [{
        axis: 'va', property: 'value', renderer: 'bar',
        colorProperty: 'heat',
        colorScale: { interpolation: 'rgb', min: '#000000', max: '#ffffff' }
      }]
    });
    // the color property is configured but absent from every row: the color
    // domain is [null, null]
    const data = [
      { label: 'a', value: 5 },
      { label: 'b', value: 7 }
    ];
    const container = mountContainer();
    const chart = createChart(container, {
      mochartConfig,
      dataProvider: new ArrayOfObjectsDataProvider(data),
      width: 300,
      height: 200
    });
    runFrames();

    expect(container.innerHTML).not.toContain('NaN');
    const fills = Array.from(container.querySelectorAll(getCssSelector('seriesBar'))).map((path) => path.getAttribute('fill'));
    expect(fills).toHaveLength(2);
    // with no color values at all, every bar shows the missing color
    expect(fills[0]).toBe('#cccccc');
    expect(fills[1]).toBe('#cccccc');

    chart.destroy();
  });
});
