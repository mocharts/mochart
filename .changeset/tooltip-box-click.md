---
"@mochart/core": patch
---

fix a click on the tooltip's own padding or border reaching the chart root, which fired onChartClick for the plot point underneath and toggled the tooltip closed even with closeOnClick off
