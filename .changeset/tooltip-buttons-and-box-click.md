---
"@mochart/core": patch
---

fix the tooltip's previous and next buttons moving the focused category only when tooltip.applyFocus is set, while the keyboard and pointer also accept crosshair.applyFocus, so the crosshair stayed a step behind, and a click on the tooltip's own padding or border reaching the chart root, which fired onChartClick for the plot point underneath and toggled the tooltip closed even with closeOnClick off
