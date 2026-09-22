---
"@mochart/editor": patch
---

fix value completions opening right after the closing quote of a finished string value, where Enter or Tab meant for the next line accepted one and wrote its text into the value, such as "xy"xy"
