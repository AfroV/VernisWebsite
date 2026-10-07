# Site Redesign + "See it with your own art" (Design Spec)

**Date:** 2026-09-27
**Status:** Built on branch `site-redesign` at the user's request ("continue with everything, I'll review at the end") — pending user review.
**Scope:** Sub-projects B (art viewer) and C (landing page redesign). Builds on A (`photo-pipeline`).

## Goal
Turn vernis.art into a page for non-crypto buyers: lead with the object, the photos and the art;
let visitors see their own art on the frame; keep EUR pricing and the existing Stripe placeholders.

## Decisions
- New `css/site.css` + `js/site.js` (ES module) for `index.html` only. `css/styles.css` / `js/main.js`
  stay for terms.html and privacy.html (unchanged).
- Visual system: concrete #D8D6D1, slate ink #1E2327, brass #A9813F, fjord #3B5566; Instrument Serif
  (display) + Hanken Grotesk (text). One bold element: the hero photo with live art on its screen.
- Hero: `oslo-view-19` with library pieces rotating every 7 s (paused off-screen, off with reduced motion).
- Viewer: 14 scenes from `data/screens.json`, pieces from `data/library.json`, visitor files via
  file input or drag-and-drop, read with object URLs — nothing is uploaded. Fill / whole-piece toggle.
  Scenes with real art offer "Original photo".
- Library: `images/library/` + `data/library.json`. Seeded with XCOPY works (CC0, used with the artist's blessing; replaced the generated samples labelled
  "Vernis sample"). Other third-party NFT art from the artboxv3 CSV library
  is NOT used (needs artist permission).
- Old PETG showcase videos and prototype photos removed from the page (files kept).
- Copy follows the kit model (buyer assembles in minutes) and positioning rules: no IPFS/NFT above the
  fold; technical detail only in "Why it stays yours" and FAQ.
- [VERIFY] placeholders: edition size/remaining (`data-remaining`), shipping/duties note, Stripe links.

## Out of scope
Live payment links, email capture (needs a provider choice), VAT/Terms updates.
