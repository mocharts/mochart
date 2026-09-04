# Social preview card

Produces `packages/mochart-docs/public/og-image.png`, the image the docs site's `og:image` meta tag
points at, so links to mochart.org unfurl with a card on Slack, Discord, Bluesky, X, iMessage and
WhatsApp. `card.html` lays out the mark, the name, the home page hero text and tagline, and a live
stacked bar chart drawn by the built `@mochart/core` bundle; `capture.mjs` opens it in Chromium with
Playwright and screenshots it at 1200x630, the size those platforms recommend.

```bash
npm run og:image                 # writes packages/mochart-docs/public/og-image.png
npm run og:image -- out/card.png # writes somewhere else
```

Rerun it when the mark, the hero wording in `packages/mochart-docs/index.md`, or the chart's default
look changes, and commit the new PNG. The card is captured on the machine that runs it, so its text
uses that machine's system font. Keep the file under 300 KB: WhatsApp skips larger images.
