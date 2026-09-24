---
"@mochart/core": minor
---

add an axisType option to createCandlestick and createOhlc that charts ISO string, timestamp or Date labels on an ordinal date axis, so tick label and tooltip formats and explicit ticks can use dates; item and result labels widen from string to CandlestickLabel (string, number or Date), and without the option a non-string label, which passed through before, is rejected with an error naming axisType
