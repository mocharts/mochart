---
"@mochart/core": patch
---

fix a follow-pointer tooltip taking the pointer's hover and clicks because its box sits under the pointer: series hover focus never applied, clicks landed on the box instead of the plot and its shapes, and closeOnClick closed it. The box now ignores the pointer, and the tooltip settings a following tooltip cannot reach (showControls, filterSeriesOnClick, focusCategoryOnClick, focusSeriesOnClick, focusCategoryOnHover and focusSeriesOnHover) are validation errors while followPointer is on
