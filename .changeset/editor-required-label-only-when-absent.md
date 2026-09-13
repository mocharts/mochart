---
"@mochart/editor": patch
---

fix a present but invalid value such as "property": 5 reading as missing, with the required label now added only when the property is absent from the document
