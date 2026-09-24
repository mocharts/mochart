---
"@mochart/core": patch
---

fix the pointer leaving the chart onto an element overlapping the plot (a popover, a sticky header, an overlay) counting as a move because the mouseleave still carried in-plot coordinates: onChartMouseLeave never fired, and a follow-pointer tooltip and the category focus it applied stayed up until the pointer came back and left again over empty space
