import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { accessibilityActive } from '../utils/utils';
import { getClipPathReference } from '../utils/svgUtils';
import { styleToAttributes } from '../utils/style';
import type { EnhancedMochartConfig } from '../types/enhanced';
import type { LayoutInfo } from '../types/layout';

const emptyPercentages: number[] = [];

interface CrosshairProps {
  mochartConfig: EnhancedMochartConfig;
  seriesLayoutInfo: LayoutInfo;
  categoryPercentages: number[];
  seriesPercentages: number[];
  tooltipClipPathUniqueId: string;
  tooltipClipPresent: boolean;
}

class Crosshair extends Renderer<CrosshairProps> {
  root = svgEl('g');
  categoryLinesGroup = svgEl('g');
  seriesLinesGroup = svgEl('g');
  categoryLines = this.elList<number>(this.categoryLinesGroup);
  seriesLines = this.elList<number>(this.seriesLinesGroup);

  create() {
    this.root.append(this.categoryLinesGroup, this.seriesLinesGroup);
    return this.root.node;
  }

  sync() {
    const { mochartConfig, seriesLayoutInfo, categoryPercentages, seriesPercentages, tooltipClipPathUniqueId, tooltipClipPresent } = this.props;

    if (mochartConfig.crosshair.visible) {
      const { plot: plotConfig, crosshair: crosshairConfig } = mochartConfig;

      const { inverted } = plotConfig;

      const minX = seriesLayoutInfo.x;
      const maxX = minX + seriesLayoutInfo.width;
      const minY = seriesLayoutInfo.y;
      const maxY = minY + seriesLayoutInfo.height;

      // the clip node is only in the dom while the tooltip is visible; referencing it otherwise would leave the crosshair unrendered
      const clipPath = crosshairConfig.showBehindTooltip || !tooltipClipPresent
        ? null : getClipPathReference(tooltipClipPathUniqueId);

      const categoryLineAttributes = styleToAttributes(crosshairConfig.categoryLine.style);
      const seriesLineAttributes = styleToAttributes(crosshairConfig.seriesLine.style);

      this.setPresent(true);
      this.root.set({ className: mochartCssClasses['crosshair'], clipPath,
        ariaHidden: accessibilityActive(mochartConfig.accessibility) ? 'true' : null });
      this.categoryLinesGroup.set({ className: mochartCssClasses['crosshairCategoryLines'] });
      this.seriesLinesGroup.set({ className: mochartCssClasses['crosshairSeriesLines'] });

      const lineAdapter = {
        key: (_percentage: number, i: number) => i,
        create: () => ({ root: svgEl('line') }),
        update: null
      };

      this.categoryLines.sync(crosshairConfig.categoryLine.visible ? categoryPercentages : emptyPercentages, {
        ...lineAdapter,
        update: (handle, categoryPercentage) => {
          const categoryOffset = categoryPercentage * seriesLayoutInfo.categoryExtent;
          const categoryPosition = (inverted ? minY : minX) + categoryOffset;
          const categoryX1 = inverted ? minX : categoryPosition;
          const categoryX2 = inverted ? maxX : categoryPosition;
          const categoryY1 = inverted ? categoryPosition : minY;
          const categoryY2 = inverted ? categoryPosition : maxY;

          handle.root.set({ className: mochartCssClasses['crosshairLine'],
            x1: categoryX1, y1: categoryY1, x2: categoryX2, y2: categoryY2, ...categoryLineAttributes });
        }
      });

      this.seriesLines.sync(crosshairConfig.seriesLine.visible ? seriesPercentages : emptyPercentages, {
        ...lineAdapter,
        update: (handle, seriesPercentage) => {
          const seriesOffset = seriesPercentage * seriesLayoutInfo.valueExtent;
          const seriesPosition = (inverted ? minX : minY) + seriesOffset;
          const valueX1 = inverted ? seriesPosition : minX;
          const valueX2 = inverted ? seriesPosition : maxX;
          const valueY1 = inverted ? minY : seriesPosition;
          const valueY2 = inverted ? maxY : seriesPosition;

          handle.root.set({ className: mochartCssClasses['crosshairLine'],
            x1: valueX1, y1: valueY1, x2: valueX2, y2: valueY2, ...seriesLineAttributes });
        }
      });
    }
    else {
      this.setPresent(false);
    }
  }
}

export default Crosshair;
