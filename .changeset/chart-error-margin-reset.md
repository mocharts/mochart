---
"@mochart/core": patch
---

fix the optional mochart.css margin reset missing the content of the chart-wide error states (mochart-chart-error: no size, an invalid config, or an error before a config arrives), so a host page's div margins no longer shift those messages
