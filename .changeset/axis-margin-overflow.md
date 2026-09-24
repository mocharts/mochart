---
"@mochart/core": patch
---

fix value axis ticks rendering at NaN for data near Number.MAX_VALUE: an automatic margin or a minOffset/maxOffset that would take the axis range past the largest number is now left out
