export default function getDescriptions() {
  return {
    enabled: 'whether all animation should be enabled or disabled',
    valueDomainChange: 'how value axis domain changes animate relative to value changes: staged, combined, or auto',
    categoryDomainChange: 'how category axis domain changes animate relative to value changes: staged, combined, or auto',
    initialDuration: 'the maximum duration (in milliseconds) for the initial animation when chart data is first loaded',
    expansionDuration: 'the maximum duration (in milliseconds) for the axis expansion animation phase when new data is added to the chart',
    valueChangeDuration: 'the maximum duration (in milliseconds) for the value change animation phase when data in the chart changes',
    contractionDuration: 'the maximum duration (in milliseconds) for the axis contraction animation phase when data is removed from the chart',
    easing: 'the easing applied to the data animation phases',
    focusDuration: 'the duration (in milliseconds) of the transition when focus moves to or from a series or category value',
    focusEasing: 'the easing applied to focus transitions'
  };
}

export function getDetails() {
  return {
    enabled: 'The master switch for staged animation. When `false`, config and data changes apply instantly. When `true`, each update plays up to three sequential phases — axis expansion, value change, axis contraction — skipping phases it does not need, and each phase’s duration scales with the size of its change (small updates play faster than the configured maximum). Width/height changes re-layout the chart instantly either way. The user’s reduced-motion preference can also disable animation — see `accessibility.respectReducedMotion`.',
    valueDomainChange: '`\'staged\'` always plays the union phases: value axes expand to cover both the old and new domains, values tween, then axes contract. `\'combined\'` interpolates every changed value axis domain together with the value changes in a single phase. `\'auto\'` (the default) combines only when a domain translates — the old and new domains barely overlap, as with flat data changing level — and stages everything else. Combined domain changes are paced by `valueChangeDuration`; `expansionDuration` and `contractionDuration` do not apply to them.',
    categoryDomainChange: 'The category axis counterpart of `valueDomainChange`, with the same modes. The default is `\'staged\'` rather than `\'auto\'`: a category domain change usually also changes the category set (a sliding time window), and the staged union — zoom out over both windows, tween, zoom in — shows where the data moved, where a combined slide draws entering and leaving points connected mid-flight. Set `\'auto\'` to slide barely-overlapping windows during the value phase instead, or `\'combined\'` to merge every category domain change into it.',
    initialDuration: 'Duration (in milliseconds) of the first render animation when the chart mounts with data, and of the replay after a structural config change rebuilds the chart.',
    expansionDuration: 'Duration (in milliseconds) of the axis expansion phase, which plays first when an update needs larger axis domains (new categories or larger values) so incoming data has room to land.',
    valueChangeDuration: 'Duration (in milliseconds) of the value change phase, which tweens values to their new positions and also plays category transitions (categories added/removed/reordered) and series transitions (series added, removed, or filtered via the legend).',
    contractionDuration: 'Duration (in milliseconds) of the axis contraction phase, which plays last when the settled data needs smaller axis domains.',
    easing: 'The pacing of every data animation phase: the initial render, axis expansion, value change, and axis contraction, each eased on its own. `\'linear\'` runs at constant speed. The sine, quad, cubic and quint families accelerate progressively more sharply, each as In (starts slow), Out (starts fast) and InOut (both); the default is `\'sineInOut\'`, the gentlest of them. elastic approaches its target with a decaying oscillation and bounce lands in diminishing bounces; eased progress is clamped at the target, so no easing overshoots past it. Focus transitions are paced by `focusEasing` instead.',
    focusDuration: 'Duration (in milliseconds) of focus transitions — the emphasis change between focused/defocused styling when a series or category gains or loses focus via hover, click, or the legend.',
    focusEasing: 'The pacing of focus transitions, with the same values as `easing`. The default `\'cubicOut\'` starts fast and decelerates, so the emphasis change reads as immediate even while focus moves quickly between series or categories.'
  };
}
