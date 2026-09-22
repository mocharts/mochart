---
"@mochart/editor": patch
---

fix the handle and validation: setValue resets validity, aria-invalid and the diagnostics list until the new document is linted, a support whose diagnostics throw reports a whole-document error instead of freezing the previous pass, onChange keeps firing after a failed format() or setValue, hover shows conditional colour defaults, and a diagnostic names the key and required status only of a property that is absent; EditorPropertyModel.default is now the exported EditorDefaultValue union discriminated on kind, with conditionalDefaults typed as EditorConditionalDefault[]
