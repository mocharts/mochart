---
"@mochart/core": patch
---

fix onFocus and onSeriesFilter still being called after a host destroyed the chart from onSeriesLayoutBoundsChange during an update, a focus change or a legend filter
