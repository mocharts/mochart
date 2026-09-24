---
"@mochart/core": minor
---

add tickStep on both axes, choosing the ticks by rule: on an ordinal category axis every count-th category from an offset, or the first category of each second, minute, hour, day, week, month or year on a date axis, with the categories between as minor ticks; on a linear axis every count-th period boundary or interval multiple from a fixed start, with minorPeriod or minorSteps placing minor ticks between them; minSpacing keeps a step from drawing ticks closer together than a number of pixels, with a console warning naming the axis
