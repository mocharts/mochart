---
"@mochart/core": patch
---

fix a click on a hover-focused series, value axis or category clearing the focus that hover, or keyboard focus, had just applied, so a mouse click could never keep an item focused and Enter on a legend item cleared what Tab had focused. A click now pins the focus: it stays after the pointer leaves, hovering another item previews it and leaving returns to the pinned one, a click on the pinned item releases it, and a click elsewhere moves the pin. Applies to legend.focusOnClick, series and value axis focusOnClick, series focusCategoryOnClick, and the tooltip's focusSeriesOnClick and focusCategoryOnClick and its focus mode; the interaction guide's Focus section describes the rules
