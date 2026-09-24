---
"@mochart/core": patch
---

fix the tooltip's previous and next buttons moving the focused category only when tooltip.applyFocus is set, while the keyboard and pointer also accept crosshair.applyFocus, so the crosshair stayed a step behind the buttons
