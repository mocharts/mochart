---
"@mochart/core": patch
---

fix setting a series' stack, group, gradient or pattern to null, which looked up an entry with the id "null" and could throw on mount
