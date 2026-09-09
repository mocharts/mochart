import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import EasingGallery from './EasingGallery.vue';
import LiveChart from './LiveChart.vue';
// Structural defaults for the chart's HTML overlays — shields the live
// examples from VitePress's base CSS resets (e.g. `svg { display: block }`).
import '@mochart/core/mochart.css';
// Restyles the charts' structural colors (axis text, grid, tooltip, …) when
// the site is in dark mode; shared with the demo apps.
import '@mochart/demo-common/chart-dark.css';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('EasingGallery', EasingGallery);
    app.component('LiveChart', LiveChart);
  }
} satisfies Theme;
