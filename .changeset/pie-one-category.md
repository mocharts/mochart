---
"@mochart/core": patch
---

report a data error when a pie chart's data has more than one category: the pie drew the first category's values while the pointer, arrow keys and tooltip controls stepped through the rest, so the tooltip could show values the pie was not drawing; a threshold or thresholdStep pattern no longer adds an unused pattern definition to a pie's svg, and a pie's hidden axes no longer log tickStep warnings
