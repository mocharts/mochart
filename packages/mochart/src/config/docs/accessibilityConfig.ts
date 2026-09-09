export default function getDescriptions() {
  return {
    enabled: 'whether the chart exposes keyboard navigation and screen-reader semantics',
    hidden: 'whether the chart is hidden from assistive tech and keyboard navigation, for purely decorative charts',
    respectReducedMotion: 'whether to respect the user’s reduced-motion system preference',
    minTargetSize: 'the minimum size (in pixels) of the click targets the chart lays out itself',
    chartLabel: 'the screen-reader name for the chart when the title has no text',
    chartRoleDescription: 'the role description screen readers announce for the chart',
    plotLabel: 'the screen-reader label for the keyboard-focusable plot area',
    seriesLabel: 'the screen-reader label for the group of keyboard-reachable series or pie slices',
    categoryAxisLabel: 'the screen-reader name for the category axis group when the axis has no title',
    valueAxisLabel: 'the screen-reader name for a value axis group when the axis has no title',
    legendLabel: 'the screen-reader label for the legend',
    tooltipLabel: 'the screen-reader label for the group of keyboard-reachable tooltip rows',
    tooltipPreviousLabel: 'the label for the tooltip controls’ previous-category button (aria-label and hover title)',
    tooltipNextLabel: 'the label for the tooltip controls’ next-category button (aria-label and hover title)'
  };
}

export function getDetails() {
  return {
    enabled: 'When `true`, the chart is keyboard- and screen-reader-accessible: the plot area is a tab stop that opens and steps the tooltip (with the values spoken through a hidden live region), legend items and interactive pie slices are roving tab stops, and the svg carries roles, labels and `aria-hidden` markers for assistive tech. Set to `false` to render the chart without any of these attributes or key handlers — for example when the host page provides its own accessible alternative. `respectReducedMotion` is not gated by this switch.',
    hidden: 'Set to `true` for a purely decorative chart — for example a sparkline that repeats a value already shown as text. The chart’s container is marked `aria-hidden` so screen readers skip it entirely, and every keyboard tab stop (plot area, legend items, pie slices, tooltip rows and controls) is removed, so keyboard users cannot land on content assistive tech cannot see. Overrides `enabled`; `respectReducedMotion` is not gated by this switch.',
    respectReducedMotion: 'When `true` and the user’s system requests reduced motion (the `prefers-reduced-motion: reduce` accessibility setting, for users sensitive to movement), the chart behaves as if `animation.enabled` were `false`: config, data, and focus changes apply instantly. The preference is watched live, so changing the system setting takes effect without re-creating the chart. Set to `false` to animate regardless of the preference. Independent of `enabled`.',
    minTargetSize: 'The floor for the chart chrome a pointer can click: legend item boxes, the tooltip controls’ buttons, and interactive tooltip rows are laid out at least this many pixels in each direction the chart controls. The default of `24` is the WCAG 2.5.8 minimum, which these targets otherwise miss at ordinary font sizes — a legend item is about 22px tall at a 16px host font, and they sit one pixel apart, so a mis-hit filters the series next to it. The floor applies to a target only while clicking it does something (`legend.filterOnClick` / `focusOnClick`, the tooltip controls, the tooltip’s click config), so a legend nothing responds to stays compact, and it is not gated by `enabled` or `hidden`: it is about pointers and touch, not assistive tech. Series shapes — bars, markers, pie slices — are deliberately not padded: their size is the data, and growing their hit area would change which value the pointer lands on. Set to `0` to lay every target out at its content size.',
    chartLabel: 'The accessible name of the chart svg when `title.text` is unset; a set title always wins. Replace to localize the announced name.',
    chartRoleDescription: 'Announced by screen readers in place of the generic "group" role, e.g. "Monthly sales, chart". Replace to localize it, as required for `aria-roledescription` values.',
    plotLabel: 'The accessible name of the plot-area tab stop that keyboard users activate to open and step the tooltip. Replace to localize it.',
    seriesLabel: 'The accessible name of the group that contains the keyboard-reachable series — cartesian series or pie slices, whichever the chart draws. Like the legend group, it is present only while the series are roving tab stops, which is when clicking a series does something (`series.focusOnClick`, or an `onSeriesClick`/`onSliceClick` callback). Replace to localize it.',
    categoryAxisLabel: 'The accessible name of the group that wraps the category axis’ tick labels, used when `categoryAxis.title` is unset; a set title always wins, and it is the untruncated title even when the drawn one is ellipsised. The group is what tells a screen reader which axis the run of tick labels belongs to, so the labels read as a scale instead of as loose numbers. Replace to localize it.',
    valueAxisLabel: 'The accessible name of the group that wraps a value axis’ tick labels, used when that axis’ `title` is unset; a set title always wins, and it is the untruncated title even when the drawn one is ellipsised. Every untitled value axis gets this same name, so give the axes titles when a chart has more than one and the distinction matters. Replace to localize it.',
    legendLabel: 'The accessible name of the legend group that contains the keyboard-reachable legend items. Replace to localize it.',
    tooltipLabel: 'The accessible name of the group that contains an open tooltip’s keyboard-reachable rows. Present only while the rows are roving tab stops, which is when clicking a row does something (the tooltip controls’ current mode, or `tooltip.focusCategoryOnClick` / `focusSeriesOnClick` / `filterSeriesOnClick`). Replace to localize it.',
    tooltipPreviousLabel: 'The accessible name and hover title of the ‹ button shown when `tooltip.showControls` is on; the button itself shows only the glyph. Replace to localize it.',
    tooltipNextLabel: 'The accessible name and hover title of the › button shown when `tooltip.showControls` is on; the button itself shows only the glyph. Replace to localize it.'
  };
}
