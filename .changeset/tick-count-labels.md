---
"@mochart/core": patch
---

fix a linear axis with automatic ticks ending on different tick labels after an update than when built, resized or animated with the same config: the count is now picked from hidden labels of every tick set the axis could draw
