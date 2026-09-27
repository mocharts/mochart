---
"@mochart/core": patch
---

reject a pie chart's valueAxes[].base unless it is 0, the value a filtered slice shrinks to: null or a positive base resolved to the axis minimum, so the smallest filtered slice stopped shrinking partway and never left the pie, and any non-zero base moved where the first-load sweep starts from; the base docs and the pie recipe say so
