---
"@mochart/editor": patch
---

fix editor.css reading nine --demo-* custom properties that belong to the demo apps, so a host page that happened to define one of those names restyled the editor; the stylesheet now uses only its documented --mochart-editor-* properties, and the font, corner radius and invalid border are set with ordinary CSS, as the editor guide describes
