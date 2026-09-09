// Shared user-facing text for the framework demos: tab titles, button labels,
// tooltips, aria-labels, captions and inline error messages. Every demo renders
// the same UI, so the copy lives here once — edit it here and all demos update.
//
// Naming convention per button: { label, tooltip, aria }. Buttons without a
// visible label omit `label`.
//
// `menuLabel` is a fourth, narrower key: text shown *only* once a button has
// been folded into a phone overflow menu, where an icon-only button would
// otherwise be a bare glyph in a column of bare glyphs. It is deliberately not
// spelled `label`, because `label` renders a `.btn-label` span that is visible
// at every width above 900px — giving these buttons one would put new text in
// the desktop toolbars. The ports render `menuLabel` in a `.btn-menu-label`
// span instead, which demo.css hides everywhere except inside a menu.
export const demoText = {
  tabs: {
    chart: 'Chart',
    config: 'Config',
    data: 'Data',
    randomConfig: 'Random Config',
    transitionConfig: 'Transition Config',
    chartPendingTitle: 'Applied changes are waiting — switch here to see them',
    // Accessible name of the strip itself (a tablist), which has no visible label.
    listAria: 'Demo views'
  },
  errors: {
    errorOccurred: 'An Error Occurred',
    invalidJson: 'Invalid JSON',
    invalidChartConfig: 'Invalid chart config — details in the browser console',
    invalidRandomConfigValues: 'Config has invalid values — details in the browser console',
    invalidDataArray: 'Invalid Data — should be an array of objects',
    invalidRandomConfig: 'Invalid Random Config',
    creatingDataProvider: 'Error creating DataProvider',
    // short labels shown as the chart's error state (the onDataError payload)
    invalidData: 'Invalid Data',
    invalidDataContent: 'Invalid Data Content',
    invalidConfigAndData: 'Invalid Config & Data',
    // appended to a short label when the console warning has the specifics
    detailsInConsoleSuffix: ' — details in the browser console',
    transitionObject: 'Transition config should be an object',
    transitionConfigObject: '"config" should be an object',
    transitionDataArrays: '"data" should be an array of arrays'
  },
  // Rendered in place of a view when the URL resolves to nothing showable.
  routeErrors: {
    noRoute: (path: string) => `No route found matching ${path}`,
    noDemo: (demoId: string) => `No demo found for id: ${demoId}`,
    badRandomId: (randomId: string) => `Bad random id: ${randomId}`
  },
  // The standalone demo gallery page (the landing route).
  gallery: {
    sections: {
      demos: 'Demos',
      showcases: 'Showcases',
      test: 'Test Demos'
    },
    testSectionHint: 'Feature-coverage demos exercising less common config options',
    showcases: {
      transition: { title: 'Transition', description: 'Animate a chart between two datasets' },
      rotation: { title: 'Rotation', description: 'A grid of charts showing different tick label rotations' },
      sparkline: { title: 'Sparklines', description: 'Word-sized charts embedded in text and tables' }
    }
  },
  backToDemos: { label: 'Demos', tooltip: 'Back to the demo gallery', aria: 'Back to the demo gallery' },
  modeSwitcher: {
    label: 'Mode:',
    // Names the switcher's `role="group"`; the visible `Mode:` label cannot, since it is display:none'd below 900px.
    groupAria: 'Demo mode',
    // Heading over the mode rows in the phone nav overflow menu, where the
    // strip's `Mode:` label is display:none'd and "Single / Random" would
    // otherwise sit unexplained between the notes row and the theme toggle.
    // Rendered via `.demo-menu-section-label`, which uppercases it.
    menuSectionLabel: 'Mode',
    modes: {
      single: { label: 'Single', title: 'One chart with editable config, data, categories and series' },
      multi: { label: 'Multi', title: 'A grid of charts stepping through datasets together' },
      random: { label: 'Random', title: 'A chart fed by a seeded random data generator' }
    }
  },
  configTab: {
    reset: { label: 'Reset', tooltip: "Restore this demo's original config", aria: 'Reset' },
    defaults: { label: 'Defaults', tooltip: 'Show or hide the default config values merged into the JSON', aria: 'Toggle Defaults' },
    invert: { label: 'Invert', tooltip: 'Swap the chart between vertical and horizontal orientation', aria: 'Toggle Inverted' },
    slow: { label: 'Slow', tooltip: 'Slow all animations down so transitions are easy to watch', aria: 'Toggle Slow' },
    format: { label: 'Format', tooltip: 'Reformat the config JSON', aria: 'Format' },
    apply: { label: 'Apply', tooltip: 'Apply this config — the chart updates when you return to the Chart tab', aria: 'Apply' },
    editorAria: 'Chart config JSON'
  },
  dataTab: {
    reset: { label: 'Reset', tooltip: "Restore this demo's original data", aria: 'Reset' },
    unused: { label: 'Unused', tooltip: 'Show or hide data properties the chart config does not use', aria: 'Toggle Unused' },
    apply: { label: 'Apply', tooltip: 'Apply this data — the chart updates when you return to the Chart tab', aria: 'Apply' },
    editorAria: 'Chart data JSON'
  },
  exportButtons: {
    png: { label: 'PNG', aria: 'Export PNG' },
    svg: { label: 'SVG', aria: 'Export SVG' }
  },
  // The collapsed export/share menu at the end of each mode's controls row.
  exportShareMenu: {
    trigger: { tooltip: 'Export or share this chart', aria: 'Export and share' }
  },
  // Phone-only overflow menus: the controls that do not fit across ~360px are
  // moved behind a trigger rather than wrapped onto another row. A single view
  // can show two of these at once — the navigation row's and the control
  // strip's — so each trigger names what it holds instead of all of them
  // saying "More", which would leave two identically-labelled buttons on screen
  // and no way to tell which one has the thing you are looking for.
  overflowMenu: {
    nav: { tooltip: 'More options', aria: 'More options' },
    chart: { tooltip: 'More chart controls', aria: 'More chart controls' },
    random: { tooltip: 'More random controls', aria: 'More random controls' },
    // The Config and Data tab footers. Named separately from `chart` because
    // what folds there edits the JSON — Reset, Defaults, Invert, Slow and the
    // reference links — and a screen-reader user who hears "more chart
    // controls" on the Config tab has been told the wrong thing. Two triggers
    // are never on screen at once, but they are on adjacent tabs.
    editor: { tooltip: 'More editor controls', aria: 'More editor controls' }
  },
  // A demo's `notes` (see demo-data's DemoManifestEntry): the detail kept out
  // of the one-sentence description. Shown behind the gallery card's toggle and
  // the notes button in each mode's navigation row.
  demoNotes: {
    galleryToggle: { tooltipShow: 'Show more about this demo', tooltipHide: 'Hide the details', aria: 'Toggle demo details' },
    trigger: { tooltip: 'More about this demo', aria: 'About this demo' }
  },
  docsLinks: {
    label: 'Reference:',
    tooltipPrefix: 'Open the config reference for '
  },
  siteRootLink: {
    // Rendered as an icon + text button in every view's navigation row.
    shortLabel: 'Mochart',
    tooltip: 'Back to the Mochart site',
    aria: 'Back to the Mochart site'
  },
  themeToggle: {
    // Icon-only button (sun/moon) in every view's navigation row — so it needs
    // menu text for both states once it folds, not just a tooltip.
    tooltipToDark: 'Switch to the dark theme',
    tooltipToLight: 'Switch to the light theme',
    menuLabelToDark: 'Dark theme',
    menuLabelToLight: 'Light theme',
    aria: 'Toggle color theme'
  },
  shareButton: {
    label: 'Share',
    tooltip: 'Copy a link to this chart with the current config and data',
    tooltipCopied: 'Link copied',
    // Spoken through the copier's live region — the whole confirmation an assistive-tech user gets, so it says where the link went.
    announcementCopied: 'Share link copied to clipboard',
    aria: 'Copy Share Link'
  },
  editableChart: {
    emptyCategoryText: 'Select Category(s)',
    selectACategoryText: 'Select a Category',
    categoryIndexPrefix: 'Category: ',
    seriesIndexPrefix: 'Series: ',
    // Phone-tier stand-ins for the two prefixes above. The full prefixes are
    // sr-only clipped there (the strip cannot spare their width), but a bare
    // `-1` between two arrows names nothing visually either — so a one-letter,
    // aria-hidden prefix carries the meaning for sighted users while the
    // clipped full text keeps carrying the accessible name.
    categoryIndexPrefixCompact: 'C',
    seriesIndexPrefixCompact: 'S',
    secondChart: {
      label: '2nd Chart',
      tooltipShow: 'Show a second chart sharing the same data',
      tooltipHide: 'Hide the second chart sharing the same data',
      aria: 'Toggle Chart Count'
    },
    editMode: {
      labelToSeries: 'Edit Series',
      labelToCategories: 'Edit Categories',
      tooltipToSeries: 'Switch to editing one category at a time (step categories/series, change values)',
      tooltipToCategories: 'Switch to editing the set of categories (add, remove, reorder)',
      aria: 'Toggle Mode'
    },
    resetCategories: { label: 'Reset', tooltip: 'Restore the original category set and order', aria: 'Reset Categories' },
    reverseCategories: { label: 'Reverse', tooltip: 'Reverse the order of the categories', aria: 'Reverse Categories' },
    addCategories: { label: 'Add', tooltip: 'Add the categories selected in the input to the chart', aria: 'Add Selected Categories' },
    removeCategories: { label: 'Remove', tooltip: 'Remove the categories selected in the input from the chart', aria: 'Remove Selected Categories' },
    playAddCategories: { menuLabel: 'Play Add', tooltip: 'Animate adding the selected categories one at a time', aria: 'Play Add Selected Categories' },
    playRemoveCategories: { menuLabel: 'Play Remove', tooltip: 'Animate removing the selected categories one at a time', aria: 'Play Remove Selected Categories' },
    stopSequence: { menuLabel: 'Stop', tooltip: 'Stop the add/remove animation', aria: 'Stop Selected Category Sequence' },
    selectAllCategories: { label: 'Select All', tooltip: 'Put every category into the selection input', aria: 'Select All Categories' },
    decreaseCategoryOrder: { tooltip: 'Move the focused category one position earlier', aria: 'Decrease Category Order' },
    increaseCategoryOrder: { tooltip: 'Move the focused category one position later', aria: 'Increase Category Order' },
    previousSeries: { tooltip: 'Edit the previous series', aria: 'Previous Series' },
    nextSeries: { tooltip: 'Edit the next series', aria: 'Next Series' },
    resetSeries: { label: 'Reset', tooltip: "Discard the edits to this series' values", aria: 'Reset Series Changes' },
    applySeries: { label: 'Apply', tooltip: 'Apply the edited series values to the chart', aria: 'Apply Series Changes' },
    // pie-mode (pie/donut/gauge) slice panel
    sliceIndexPrefix: 'Slice: ',
    selectASliceText: 'Click a slice to edit its value',
    previousSlice: { tooltip: 'Select the previous slice', aria: 'Previous Slice' },
    nextSlice: { tooltip: 'Select the next slice', aria: 'Next Slice' },
    resetSlice: { label: 'Reset', tooltip: "Restore the selected slice's original value", aria: 'Reset Slice Value' },
    applySlice: { label: 'Apply', tooltip: 'Apply the entered value to the selected slice', aria: 'Apply Slice Value' },
    playSliceSequence: { menuLabel: 'Play Slices', tooltip: 'Animate filtering the slices one at a time, then restoring them', aria: 'Play Slice Sequence' },
    stopSliceSequence: { menuLabel: 'Stop', tooltip: 'Stop the slice sequence', aria: 'Stop Slice Sequence' }
  },
  multiChartsTab: {
    gridLabel: 'Grid:',
    gridRowsAria: 'Grid rows',
    gridColsAria: 'Grid columns',
    stepBackward: { tooltip: 'Step all charts one dataset backward', aria: 'Step Backward' },
    stepForward: { tooltip: 'Step all charts one dataset forward', aria: 'Step Forward' },
    playBackward: { tooltip: 'Play backward through the datasets at the interval', aria: 'Play Backward' },
    playForward: { tooltip: 'Play forward through the datasets at the interval', aria: 'Play Forward' },
    stop: { tooltip: 'Stop playback', aria: 'Stop' },
    intervalLabel: 'Interval (ms):',
    intervalAria: 'Playback interval in milliseconds'
  },
  randomChartTab: {
    back: { label: 'Back', tooltip: 'Go back to the previous random dataset', aria: 'Randomize Back' },
    randomize: { label: 'Randomize', tooltip: 'Generate the next random dataset', aria: 'Randomize Next' },
    play: { menuLabel: 'Play', tooltip: 'Keep generating random datasets at the interval', aria: 'Play Randomize' },
    stop: { menuLabel: 'Stop', tooltip: 'Stop generating', aria: 'Stop' },
    intervalLabel: 'Interval (ms):',
    intervalAria: 'Randomize interval in milliseconds',
    reuse: {
      label: 'Reuse',
      tooltip: "Keep part of the data the same between randomizations (the config's reuse settings), so transitions animate with continuity — off generates fully independent datasets",
      aria: 'Reuse'
    }
  },
  randomConfigTab: {
    reset: { label: 'Reset', tooltip: 'Restore the original random generator config', aria: 'Reset' },
    apply: { label: 'Apply', tooltip: 'Apply this generator config to the random chart', aria: 'Apply' },
    editorAria: 'Random generator config JSON'
  },
  randomDataTab: {
    editorAria: 'Generated data JSON (read-only)'
  },
  transitionChartTab: {
    back: { label: 'Back', tooltip: 'Transition to the previous dataset', aria: 'Step Backward' },
    next: { label: 'Next', tooltip: 'Transition to the next dataset', aria: 'Step Forward' }
  },
  transitionConfigTab: {
    reset: { label: 'Reset', tooltip: 'Restore the original transition config', aria: 'Reset' },
    apply: { label: 'Apply', tooltip: 'Apply this config to the transition charts', aria: 'Apply' },
    editorAria: 'Transition config JSON'
  },
  // The sparkline showcase page: prose with inline charts woven between the
  // segments (segment count = inline chart count + 1, see sparklines.ts),
  // then a small-multiples metrics table.
  sparklinePage: {
    intro: [
      'Sparklines are word-sized charts that live inside running text. The createSparklineConfig helper strips a regular chart config down to its plotted shape — no axes, legend, tooltip or margins — so a 30-day revenue trend ',
      ' can sit right in a sentence, an error-rate pulse ',
      ' beside it, and the same preset scales up to small-multiple tables like the one below.'
    ],
    randomize: { label: 'Randomize', tooltip: 'Generate new data for every sparkline', aria: 'Randomize sparklines' },
    table: {
      metric: 'Metric',
      latest: 'Latest',
      trend: 'Last 30 days'
    }
  }
} as const;
