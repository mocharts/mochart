---
"@mochart/core": patch
---

fix the linearGradientDefaults, radialGradientDefaults, valueAxisDefaults, seriesDefaults, seriesGroupDefaults and seriesStackDefaults input types accepting id, ignore and order, which validation rejects on an all config; the types now leave them out, as patternDefaults already did
