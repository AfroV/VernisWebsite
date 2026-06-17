# Wave 2 — Metal Edition Checkout (Design Spec)

**Date:** 2026-06-17
**Status:** Approved design, pending implementation plan
**Scope:** Add a fiat (EUR) checkout for the Vernis wave-2 metal-cased product on the
existing static site, plus a DIY/open-source path. No backend.

## Goal

Wave 2 sells a **metal-enclosure** Vernis as a premium physical product paid for in
EUR (card or crypto), with the NFT delivered manually to a wallet the buyer provides
at checkout. A separate DIY path points self-builders to open-source enclosure files.

This replaces the wave-1 model (self-mint in ETH on Transient Labs) for metal buyers.

## Key decisions

- **Two payment methods only — both Stripe. No MoonPay.**
  - Card → Stripe Payment Link, priced in EUR.
  - Crypto → Stripe pay-with-crypto (stablecoin settles to the Stripe balance).
- **No backend.** Stripe Payment Links are created in the Stripe dashboard; the site
  links a button to them. GitHub Pages stays purely static.
- **Hold a EUR balance in Stripe** (do not auto-convert EUR→NOK per sale) to avoid the
  ~2% per-transaction currency-conversion fee. Convert/pay out in batches.
- **NFT delivery is a manual airdrop** to the wallet address captured at checkout. The
  buyer never needs ETH or to self-mint. The Transient self-mint page is retired for
  wave-2 metal buyers.

## Pricing

| Edition | Price | Buyer gets | Artist payout | Vernis net (pre-fees) |
|---|---|---|---|---|
| Standard Metal Edition | **€600** | Metal kit + signed/numbered NFT | — | ~2,045 kr |
| Artist-Collab Metal Edition | **€700** | Metal kit + artist-designed NFT | ~1,155 kr (manual) | ~1,957 kr |

- The €100 artist premium is paid by the buyer, so Vernis margin stays ~flat (~2,000 kr)
  across both editions.
- **€500 is explicitly rejected** — once an artist cut and Stripe fees are applied,
  Vernis net goes to ~zero or negative for international-card buyers.

### Stripe fee context (ballpark, verify in dashboard)

- EEA card ~1.5% + ~2 kr · UK ~2.5% · international ~3.25% · +2% FX if not holding EUR.
- Crypto-pay ~1.5% (cheaper than cards; the higher-margin path). Verify availability.
- At €600/€700 both editions clear fees comfortably; crypto-pay maximizes margin.

## Page structure

1. **Hero / premium path** — "Vernis Metal Edition" product card: metal enclosure,
   EUR price, **Reserve / Buy** CTA → Stripe Payment Link. (Standard €600; artist
   editions €700, one Payment Link per artist design.)
2. **DIY path** — a separate, visually subordinate "Build it yourself" section lower on
   the page linking to open-source enclosure files on GitHub. Free / bring-your-own-hardware.

## Checkout data captured (Stripe-native, per order)

- Email + phone (contact for shipping)
- Shipping address (native Stripe field)
- **Custom field — Wallet address** (text): airdrop destination for the NFT
- **Custom field — Charger / plug type** (dropdown): EU (Type C/F) · UK (Type G) ·
  US (Type A/B) · AU (Type I)
- For artist editions: an artist/design tag (hidden metadata or a dedicated Payment
  Link per design) so the correct artist payout is known.

All order data lands in the Stripe dashboard — that is the fulfillment worklist.

## Fulfillment flow (manual, by operator)

1. Order arrives → Stripe dashboard shows wallet + shipping address + plug type
   (+ artist tag if applicable).
2. Airdrop the signed, numbered NFT to the buyer's wallet.
3. Ship the metal kit with the correct plug type.
4. For artist editions: pay the artist their cut out-of-band.

## Artist revenue share

- **Now:** manual payout. One Payment Link per artist design (or an artist tag) for
  attribution. Zero extra build.
- **Later:** Stripe Connect to auto-split the cut at payment time (requires artist
  onboarding/KYC) — only once there are several artists.

## Site content changes

- Product card: PETG → **metal enclosure**, EUR price, remove "sold out", new CTA.
- "How it works" three steps: rewrite from *Mint → Connect → Display* to
  **Buy (card/crypto) → We airdrop your NFT + ship your metal kit → Power on & display**.
- FAQ: update mint-centric answers to the buy-and-receive model.
- Add the DIY / open-source section.

## Out of scope (flagged follow-ups, not built here)

- **VAT / taxes** — 25.time AS (Norway) shipping into the EU has real VAT/import
  implications. Price is taken as set; Stripe Tax integration is a separate task.
- **Terms / Privacy updates** — the physical-sale + shipping + refund model (angrerett,
  shipping terms) likely needs Terms edits. Separate task.
- Automated NFT delivery, inventory/edition-cap automation, Stripe Connect.

## Success criteria

- A buyer can purchase the metal edition in EUR by card on the live static site and
  have their wallet, shipping address, and plug type captured in one Stripe order.
- Crypto-pay can be enabled on the same Payment Link with no site changes once the
  Stripe account is eligible.
- A self-builder can reach the open-source enclosure files from the page.
- The operator has every datum needed to airdrop the NFT and ship the kit from the
  Stripe dashboard alone.
