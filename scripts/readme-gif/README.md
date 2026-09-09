# README recording harness

Produces the animated clips embedded in the READMEs and the docs landing page. `record.html` mounts one
chart on a bare page, `scenes.mjs` scripts the data and config updates each clip steps through, and
`record.mjs` drives the page in Chromium with Playwright video recording on and converts the result to
a looping GIF plus an MP4 with ffmpeg (which must be on the PATH).

```bash
npm run gif:readme -- <out-dir>                       # every scene, light and dark
npm run gif:readme -- <out-dir> --scene stacked --theme light
```

Each scene sets its own animation durations, and its `run` function waits on those same numbers between
updates, so lengthening a phase means changing both. A scene calls `begin()` once its mount animation
has settled, which is where the clip starts, and ends on the data it started with, so the GIF loops
without a jump. The committed clips live in `assets/` at the repo root; the READMEs link them by raw
GitHub URL so they also show on npm. The page follows the host page's `color`, which is all the light and dark
themes change; the colours match GitHub's README backgrounds so the GIF sits flush.

The option list is the comment block at the top of `record.mjs`.
