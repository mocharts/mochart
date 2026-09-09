import { createChart } from '@mochart/core';
import { forwardRef, useImperativeHandle } from 'react';
import { useChartHost } from './useChartHost.js';
import type { ChartProps, ChartRef } from './types.js';

/**
 * React wrapper around mochart's `createChart`: takes an enhanced config
 * (`mochartConfig`) and a data provider. Omit `width`/`height` to have the
 * chart track the container div's size. `ref` receives a `ChartRef` with
 * `refresh()`.
 */
// forwardRef, not the React 19 ref prop: React 18 hosts strip ref from props
const Chart = forwardRef<ChartRef, ChartProps>(function Chart(props, ref) {
  const { className, style, dataTestId, ...chartProps } = props;
  const { containerRef, refresh, placeholderPortals } = useChartHost(createChart, chartProps);
  useImperativeHandle(ref, () => ({ refresh }), [refresh]);
  // explicit size props win over the container style, like in the other bindings
  const containerStyle = { ...style };
  if (props.width !== undefined) {
    containerStyle.width = props.width;
  }
  if (props.height !== undefined) {
    containerStyle.height = props.height;
  }
  return (
    <>
      <div ref={containerRef} className={className} style={containerStyle} data-testid={dataTestId} />
      {placeholderPortals}
    </>
  );
});

export default Chart;
