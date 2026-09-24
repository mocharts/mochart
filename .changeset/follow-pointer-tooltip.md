---
"@mochart/core": patch
---

fix the follow-pointer tooltip: its box sat under the pointer and took the plot's hover and clicks (series hover focus never applied, clicks landed on the box and closeOnClick closed it), it stayed closed after a load the pointer entered during, or after a click closed it, until the pointer left the chart and came back, the keyboard reopened it on the category it first opened at instead of the last one the pointer reached, and onFocus fired and the chart re-rendered on every mousemove with the focus unchanged. The box now ignores the pointer, a closed tooltip opens on the next move, an unchanged focus is no report and no render, and showControls, filterSeriesOnClick, focusCategoryOnClick, focusSeriesOnClick, focusCategoryOnHover and focusSeriesOnHover are validation errors while followPointer is on
