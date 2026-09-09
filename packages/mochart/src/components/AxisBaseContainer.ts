import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { getValueAxisFocusContexts } from '../utils/FocusValue';

import AxisBaseLine from './AxisBaseLine';
import { NONE } from '../config/core/constants';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { SeriesData } from '../types/data';
import type { FocusData } from '../types/animation';
import type { LayoutInfo } from '../types/layout';

interface AxisBaseContainerProps {
  front: boolean;
  mochartConfig: EnhancedMochartConfig;
  seriesLayoutInfo: LayoutInfo;
  focusData: FocusData;
  seriesData: SeriesData;
}

export default class AxisBaseContainer extends Renderer<AxisBaseContainerProps> {
  root = svgEl('g');
  baseLines = this.rendererList(this.root);

  create() {
    return this.root.node;
  }

  sync() {
    const { front, mochartConfig, seriesLayoutInfo, focusData, seriesData } = this.props;
    const { plot: plotConfig, valueAxes: valueAxisConfigs } = mochartConfig;
    const { filtered, raw } = seriesData;
    const { renderAxisDomains: filteredDomains } = filtered;
    const { renderAxisDomains: rawDomains } = raw;

    this.root.set({ className: mochartCssClasses['axisBaseContainer'] });

    this.baseLines.sync(getValueAxisFocusContexts(valueAxisConfigs, focusData)
      .filter(({ axisConfig }) => axisConfig.baseLine.front === front)
      .map(({ axisConfig, id, key, axisFocusPercentage, seriesFocusPercentage }) => {
        const { base, adjustForFiltering } = axisConfig;
        const axisDomain = adjustForFiltering ? filteredDomains[id] : rawDomains[id];
        const domainMin = axisDomain[0];
        const domainMax = axisDomain[1];
        const basePercentage = base !== NONE && domainMin !== null && domainMax !== null && domainMin !== domainMax && base > domainMin && base < domainMax ? (base - domainMin) / (domainMax - domainMin) : 0;
        return {
          key,
          ctor: AxisBaseLine,
          props: { plotConfig, valueAxisConfig: axisConfig,
            axisBaseLineClass: mochartCssClasses['valueAxisBaseLine'] + id,
            axisFocusPercentage, seriesFocusPercentage,
            seriesLayoutInfo, basePercentage }
        };
      }));
  }
}
