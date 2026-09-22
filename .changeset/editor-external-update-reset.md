---
"@mochart/editor": patch
---

fix a throw from the editor update inside format() or setValue leaving every later user edit unreported to onChange
