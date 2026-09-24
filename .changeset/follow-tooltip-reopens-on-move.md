---
"@mochart/core": patch
---

fix a follow-pointer tooltip staying closed after a load ends when the pointer entered the plot during the load, or after a click closed it, until the pointer left the chart and came back: the tooltip now opens on the next move, as it does on entry
