// One series: the legend only defaults to visible above one series, so
// visible is set explicitly. With filtering and focus switched off it is a
// plain key — clicking or hovering the item does nothing — and the icon
// drops its border to read as a colour swatch.
import type { MochartInputConfig } from '@mochart/core';

export const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Daily Sign-ups' },
  categoryAxis: { property: 'day', type: 'string', scale: 'ordinal' },
  valueAxes: [{ id: 'VA0', title: { text: 'Sign-ups' }, min: 0 }],
  series: [{ property: 'signups', title: 'New sign-ups', renderer: 'bar' }],
  legend: {
    visible: true,
    position: 'bottom',
    align: 'left',
    alignedToAxes: true,
    filterOnClick: false,
    focusOnClick: false,
    focusOnHover: false,
    icon: { size: 12, borderStyle: { strokeOpacity: 0 } }
  }
};

export const data = [
  { day: 'Mon', signups: 34 },
  { day: 'Tue', signups: 41 },
  { day: 'Wed', signups: 38 },
  { day: 'Thu', signups: 52 },
  { day: 'Fri', signups: 47 },
  { day: 'Sat', signups: 23 },
  { day: 'Sun', signups: 19 }
];
