---
"@mochart/editor": patch
---

fix format(): the caret and selection stay on the same characters, number and string literals are kept as written (1e3, 1.0, long integers), an already formatted document gets no onChange, a read-only document returns false, and the indentation option is read the way JSON.stringify reads its space argument
