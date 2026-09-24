---
"@mochart/core": patch
---

fix keyboard focus dropping to the page body inside a shadow root (a LitElement by default, Angular ShadowDom, any web component) when the tooltip closes, a series or slice is reordered, a legend item unmounts or a tooltip row filters itself away: the chart now reads the focused element from its own root node, where the document retargets it to the shadow host
