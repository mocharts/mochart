---
"@mochart/core": minor
---

format tooltip and series label values at each value's own magnitude on every axis, an SI prefix with two significant digits (4.5, 45, 1.2k) with the trailing zeros trimmed, rather than one prefix fixed by the axis domain, which printed 4.5 as 0.00k on an axis to 1000; a value axis tickLabel.format that leaves its precision open takes 3 significant digits there; the automatic number category format in the tooltip header trims its trailing zeros too (1k, not 1.0k)
