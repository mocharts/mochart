import { defineComponent, h } from 'vue';
import { createChart } from '@mochart/core';
import { useChartHost } from './useChartHost.js';
import { chartProps } from './props.js';
import type { ChartRef } from './types.js';

/**
 * Vue wrapper around mochart's `createChart`: takes an enhanced config
 * (`mochartConfig`) and a data provider. Omit `width`/`height` to have the
 * chart track the container div's size. `class`/`style` fall through to the
 * container div. A template ref on the component exposes `refresh()`.
 */
const Chart = defineComponent({
  name: 'Chart',
  props: chartProps,
  // inheritAttrs off so the explicit size props can win over a fallthrough style
  inheritAttrs: false,
  setup(props, { attrs, expose }) {
    // dataTestId belongs to the container div, not the chart
    const { containerRef, refresh } = useChartHost(createChart, () => {
      const { dataTestId: _dataTestId, ...hostProps } = props;
      return hostProps;
    });
    expose({ refresh });
    return () => {
      const sizeStyle: Record<string, string> = {};
      if (typeof props.width === 'number') {
        sizeStyle.width = `${props.width}px`;
      }
      if (typeof props.height === 'number') {
        sizeStyle.height = `${props.height}px`;
      }
      const containerProps: Record<string, unknown> = {
        ...attrs,
        ref: containerRef,
        style: [attrs.style, sizeStyle]
      };
      // only override the fallthrough attr when the prop is actually set
      if (props.dataTestId !== undefined) {
        containerProps['data-testid'] = props.dataTestId;
      }
      return h('div', containerProps);
    };
  }
});

// SetupContext.expose does not reach the instance type, so the exposed surface is declared here
export default Chart as typeof Chart & { new (): ChartRef };
