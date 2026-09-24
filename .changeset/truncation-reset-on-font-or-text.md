---
"@mochart/core": patch
---

fix truncated tick labels, axis titles, the chart title and legend items keeping a fit made for an earlier config when an update changed only the font (tick labels and axis titles) or the truncation text (all four): the prefix is fitted again from the full text, so the rendering no longer depends on the update history
