import { NONE, POSITION_TOP, ALIGN_CENTER, VERTICAL_ALIGN_MIDDLE, COLOR_CURRENT } from '../core/constants';
import { getRegularDefaults as getTruncationDefaults } from './truncationConfig';

export default function getDefaults() {
  return {
    text: NONE,
    position: POSITION_TOP,
    link: NONE,
    linkDisabled: false,
    truncation: getTruncationDefaults(),
    alignedToAxes: true,
    align: ALIGN_CENTER,
    verticalAlign: VERTICAL_ALIGN_MIDDLE,
    verticalExpand: false,
    margin: { top: 0, right: 0, bottom: 5, left: 0 },
    padding: { top: 0, right: 0, bottom: 5, left: 0 },
    textMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    textPadding: { top: 0, right: 0, bottom: 0, left: 0 },
    // 'none' rather than null on the text styles: stroke="none" firewalls a host-css stroke inheriting onto the text.
    backgroundStyle: { strokeColor: COLOR_CURRENT, strokeOpacity: 0, strokeWidth: NONE, strokeDashArray: NONE, fillColor: NONE, fillOpacity: 0 },
    textBackgroundStyle: { strokeColor: COLOR_CURRENT, strokeOpacity: 0, strokeWidth: NONE, strokeDashArray: NONE, fillColor: NONE, fillOpacity: 0 },
    textStyle: { strokeColor: 'none', strokeOpacity: NONE, strokeWidth: 0, strokeDashArray: NONE, fillColor: COLOR_CURRENT, fillOpacity: NONE },
    prefix: {
      text: NONE,
      margin: { top: 0, right: 5, bottom: 0, left: 0 },
      padding: { top: 0, right: 5, bottom: 0, left: 0 },
      backgroundStyle: { strokeColor: COLOR_CURRENT, strokeOpacity: 0, strokeWidth: NONE, strokeDashArray: NONE, fillColor: NONE, fillOpacity: 0 },
      textStyle: { strokeColor: 'none', strokeOpacity: NONE, strokeWidth: 0, strokeDashArray: NONE, fillColor: COLOR_CURRENT, fillOpacity: NONE }
    },
    suffix: {
      text: NONE,
      margin: { top: 0, right: 0, bottom: 0, left: 5 },
      padding: { top: 0, right: 0, bottom: 0, left: 5 },
      backgroundStyle: { strokeColor: COLOR_CURRENT, strokeOpacity: 0, strokeWidth: NONE, strokeDashArray: NONE, fillColor: NONE, fillOpacity: 0 },
      textStyle: { strokeColor: 'none', strokeOpacity: NONE, strokeWidth: 0, strokeDashArray: NONE, fillColor: COLOR_CURRENT, fillOpacity: NONE }
    }
  };
}