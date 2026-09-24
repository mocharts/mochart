---
"@mochart/core": patch
---

fix getConfigWithoutDefaults dropping an all-default seriesStacks or seriesGroups entry written in single-object shorthand ({} or an entry whose members all match their defaults), which left the minimal config unstacked or ungrouped since the series default their stack or group to that lone entry; only the implicit valueAxes entry is dropped, as in the array form
