---
"@mochart/core": patch
---

fix an update that switches animation on (animation.enabled, or accessibility.respectReducedMotion with a reduced motion preference) while also changing the config structure or the data provider throwing "Cannot read properties of undefined (reading 'domain')": the new animated source now starts from nothing instead of tweening from a frame whose series and categories the new data may not have
