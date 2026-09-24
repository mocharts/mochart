---
"@mochart/core": patch
---

fix a focused slice of a partial pie or gauge (a span short of a full circle) with focusOffsetFraction set being pushed outside the series area on the arc side while the flat side kept the same room empty: the layout now fits and centres the exploded extent of the span, so the slice stays inside the rect as the docs promise
