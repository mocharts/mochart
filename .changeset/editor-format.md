---
"@mochart/editor": patch
---

fix format(): the caret and selection stay on the same characters, every number and string literal is kept as written (1e3, 1.0, long integers), an already formatted document is left alone with no onChange, a read-only document is refused with false, and the indentation option is read the way JSON.stringify reads its space argument
