---
"@mochart/core": patch
---

report the category indices of onChartClick, onChartMouseEnter, onChartMouseMove, onChartMouseLeave and onSeriesClick in the index space of the data last supplied, as onFocus already did, while a data change that adds, removes or reorders categories animates; a category only the old data had reports -1. A host indexing its data with a payload received mid-animation got the drawn category's old or merged index before
