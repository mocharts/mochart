---
"@mochart/core": minor
---

add tickStep on both axes, choosing the ticks by rule: on an ordinal category axis every count-th category from an offset, or with a period on a date axis the first category of each day, week, month or year, with the categories between as minor ticks; on a linear axis (a linear category axis, or a value axis) the boundaries of a period or the multiples of an interval, every count-th of them counted from a fixed starting point, with minorPeriod or minorSteps placing minor ticks between them, and minSpacing keeping a step from creating ticks closer together than a number of pixels (a console warning names the axis)
