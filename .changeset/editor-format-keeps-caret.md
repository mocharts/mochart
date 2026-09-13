---
"@mochart/editor": patch
---

fix format() losing the caret position, which now stays on the same character, and skipping the dispatch and onChange when the document is already formatted
