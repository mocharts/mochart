---
"@mochart/core": patch
---

fix createChart and createDefaultChart leaking their reduced-motion and font-loading listeners, and a running entrance tween, when mounting throws (a throwing state factory or a null container): the caller never gets a handle to destroy, so the chart now cleans up before rethrowing
