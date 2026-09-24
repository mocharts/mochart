---
"@mochart/core": patch
---

fix the automatic precision of tick labels for explicit ticks entries without a label: the auto format, or any d3 format without a precision of its own, derived it from the count of ticks over the domain rather than from the values listed, so a tick at 0.125 read 0.1; the precision now follows the smallest gap between the listed ticks
