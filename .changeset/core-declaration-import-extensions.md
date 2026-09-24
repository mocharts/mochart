---
"@mochart/core": patch
---

fix the shipped type declarations under node16 or nodenext module resolution, where their extensionless relative imports made every core type import fail (TS2305), createDefaultChart any, and the bindings' prop types unchecked; the imports now name their .js targets, and the pack smoke check typechecks a nodenext consumer against the tarballs
