---
"@mochart/core": patch
---

fix error bars under missingValueMode "connect" carrying the compacted point index in their per-item class (mochart-series-error-bar-N) instead of the category index that the bars, markers and labels of the same point use
