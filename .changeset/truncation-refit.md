---
"@mochart/core": patch
---

fix truncated tick labels, axis titles, the chart title and legend items keeping a fit made for an earlier font or truncation text: an update that changes only the font (tick labels and axis titles) or the truncation text now refits from the full text, and a web font finishing loading after mount measures the chart's text again and refits, instead of keeping the fallback font's measurements until the next config change or resize
