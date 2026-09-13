---
"@mochart/editor": patch
---

fix format() rewriting a read-only document, since EditorState.readOnly blocks user input only; it now returns false while the editor is read-only
