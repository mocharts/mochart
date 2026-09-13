---
"@mochart/editor": patch
---

fix completing an object or array property whose default is null, such as colorScale or ticks, inserting null instead of {} or [] to fill in
