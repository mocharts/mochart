import { format } from 'd3-format';

import { Renderer, svgEl, textEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { translate, textDY } from '../utils/utils';
import { styleToAttributes } from '../utils/style';
import { NONE, AUTO } from '../config/core/constants';

import type { PieConfig } from '../types/config';
import type { LayoutInfo } from '../types/layout';
import type { RadialLayoutInfo } from '../layout/RadialLayout';

// SI-abbreviated by default, like the auto slice value labels.
const AUTO_TOTAL_FORMAT = '~s';

interface PieCenterProps {
  pieConfig: PieConfig;
  seriesLayoutInfo: LayoutInfo;
  radialLayoutInfo: RadialLayoutInfo;
  /** The current (possibly mid-tween) total of the unfiltered slice values. */
  total: number;
  /** When true, the decorative center is hidden from assistive tech. */
  accessibility: boolean;
}

/** The pie center content: an optional text label and/or the live total of the unfiltered slice
 * values (counting along with value tweens); styled by centerLabel.textStyle / centerTotal.textStyle. */
export default class PieCenter extends Renderer<PieCenterProps> {
  root = svgEl('g');
  label = this.elSlot(this.root);
  labelText = textEl();
  total = this.elSlot(this.root);
  totalText = textEl();

  create() {
    return this.root.node;
  }

  sync() {
    const { pieConfig, seriesLayoutInfo, radialLayoutInfo, total, accessibility } = this.props;
    const { text: centerLabel, textStyle: centerLabelTextStyle } = pieConfig.centerLabel;
    const { visible: showCenterTotal, textStyle: centerTotalTextStyle } = pieConfig.centerTotal;
    const showLabel = centerLabel !== NONE;

    if (!showLabel && !showCenterTotal) {
      this.setPresent(false);
      return;
    }

    this.setPresent(true);
    this.root.set({ className: mochartCssClasses['pieCenter'], ariaHidden: accessibility ? 'true' : null,
      transform: translate(
        seriesLayoutInfo.x + radialLayoutInfo.cx + pieConfig.centerOffsetXFraction * radialLayoutInfo.outerRadius,
        seriesLayoutInfo.y + radialLayoutInfo.cy + pieConfig.centerOffsetYFraction * radialLayoutInfo.outerRadius) });

    if (showLabel) {
      const labelEl = this.label.set('text', () => {
        const el = svgEl('text');
        el.append(this.labelText);
        return el;
      });
      labelEl!.set({ ...styleToAttributes(centerLabelTextStyle), className: mochartCssClasses['pieCenterLabel'],
        textAnchor: 'middle', dy: showCenterTotal ? '-0.35em' : textDY });
      this.labelText.set(centerLabel!);
    }
    else {
      this.label.set(null);
    }

    if (showCenterTotal) {
      const specifier = pieConfig.centerTotal.format === AUTO ? AUTO_TOTAL_FORMAT : pieConfig.centerTotal.format;
      const totalEl = this.total.set('text', () => {
        const el = svgEl('text');
        el.append(this.totalText);
        return el;
      });
      totalEl!.set({ ...styleToAttributes(centerTotalTextStyle), className: mochartCssClasses['pieCenterTotal'],
        textAnchor: 'middle', dy: showLabel ? '1.0em' : textDY });
      this.totalText.set(format(specifier)(total));
    }
    else {
      this.total.set(null);
    }
  }
}
