---
"@mochart/core": patch
---

fix a throwing render in one animating chart (such as a host onSeriesLayoutBoundsChange that throws) dropping the same frame's renders of every other animating chart on the page, which could leave another chart stuck on its second-to-last animation frame; each queued render and measure callback now runs, and the first error is rethrown afterwards
