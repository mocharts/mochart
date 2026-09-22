---
"@mochart/editor": patch
---

fix format() losing the caret position and rewriting number literals through a double, so 1e3, 1.0 and long integers now survive formatting as written and the caret stays on the same character, and skip the dispatch and onChange when the document is already formatted, with the indentation option still read the way JSON.stringify reads its space argument
