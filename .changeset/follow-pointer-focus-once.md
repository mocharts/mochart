---
"@mochart/core": patch
---

fix onFocus firing, and the chart re-rendering, on every mousemove under tooltip.followPointer even when the focused category had not changed; an unchanged focus is now no report and no render
