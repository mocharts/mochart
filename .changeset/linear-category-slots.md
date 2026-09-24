---
"@mochart/core": patch
---

size category slots on a linear category axis from the smallest gap between neighbouring category values instead of one axis value, so bars, bar caps and error bar caps on a date axis or a number axis with spaced values are no longer drawn at the 1px minimum, a single category gets a slot spanning the plot whatever its value, and a single category of 0 sits at the centre instead of the quarter point; the categoryCountPadding description now says it adds slots
