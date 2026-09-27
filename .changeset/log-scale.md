---
"@mochart/core": minor
---

add scale: 'log' to the value axis and to number category axes, spacing values by ratio with ticks at the powers of 10 and minor ticks at the multiples from 2 to 9 between them; series values at or below 0 are drawn as missing with a console warning, error bar ends and range ends at or below 0 are cut off at the plot edge, category values at or below 0 are a data error, and stacks, bar series on a log category axis, offsets, minTickInterval, step intervals and bounds, bases, ticks and threshold lines at or below 0 are validation errors; export SCALE_LOG and the ValueAxisScale type
