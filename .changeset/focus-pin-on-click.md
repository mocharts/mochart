---
"@mochart/core": patch
---

fix a click on a hover-focused series, value axis or category clearing the focus hover or the keyboard had just applied, so a mouse click could never keep an item focused and Enter on a legend item cleared what Tab had focused. A click now pins the focus: it stays after the pointer leaves, hovering another item previews it, a click on the pinned item releases it and a click elsewhere moves the pin, for every focusOnClick, focusCategoryOnClick and focusSeriesOnClick setting and the tooltip's focus mode; the interaction guide's Focus section has the rules
