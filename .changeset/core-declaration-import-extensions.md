---
"@mochart/core": patch
---

fix the shipped type declarations under node16 or nodenext module resolution: their relative imports named no file extension, so every core type import failed there (TS2305), createDefaultChart became any, and the bindings' prop types that reach core types went unchecked; the source now names its .js targets, as the other packages do, and the pack smoke check typechecks a nodenext consumer against the tarballs
