---
"@mochart/editor": patch
---

fix property completions inserting a type placeholder for conditional defaults, palettes and JavaScript-notation literals, which now resolve the true value with getDefaults on the last parsed document, with hover showing conditional colour defaults and a diagnostic naming the key and required status of an absent property, ranged on its entry's opening brace
