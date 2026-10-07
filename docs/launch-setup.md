# Oppsett før wave 2: Stripe, Mailchimp, Plausible

Følg rekkefølgen. Alt med 🔧 er noe du gjør i en nettleser; send meg det som står under
«Send til Claude», så legger jeg det inn på siden.

---

## A. Stripe (betaling)

### A1. Konto og selskap 🔧
1. Logg inn på dashboard.stripe.com → **Settings → Business**: fyll inn 25.TIME AS,
   org.nr. 915 890 423, bankkonto for utbetaling, og nettside `https://vernis.art`.
2. **Settings → Business → Public details**: offentlig navn «Vernis», support-e-post.
3. **Settings → Payouts / Balances**: legg til en **EUR-saldo** (hold euro, ikke veksle hvert salg
   – sparer ca. 2 % valutagebyr).
4. **Settings → Customer emails**: slå på **«Successful payments»** (kvittering på e-post).

### A2. Bytt til testmodus 🔧
Øverst til høyre: slå på **Test mode**. Alt under gjøres først i testmodus.

### A3. Produkter 🔧
**Product catalog → Add product**, to ganger:

| Navn | Pris | Valuta | Type |
|---|---|---|---|
| Vernis Side | 600 | EUR | One-off |
| Vernis Rear | 750 | EUR | One-off |

Legg gjerne inn et bilde fra `images/scenes/` (f.eks. `angle-34-1600.jpg`).

### A4. Fraktsatser 🔧
**Product catalog → Shipping rates → Create** (en per sone). Fyll inn dine faktiske priser fra
Posten/Bring eller DHL for en pakke på **[vekt]**:

| Navn kunden ser | Pris (EUR) | Leveringstid |
|---|---|---|
| Norway | [__] | 2–5 virkedager |
| Europe | [__] | 5–10 virkedager |
| Rest of world | [__] | 7–21 virkedager |

> Stripe lar kunden velge sone selv. Du sjekker at sonen stemmer med adressen når du pakker;
> velger noen feil, refunderer eller fakturerer du differansen. Det er den enkleste løsningen
> uten egen server.

### A5. Betalingslenker 🔧
**Payment Links → New**, én for hver modell:

1. **Product:** Vernis Side (antall 1, la kunden *ikke* endre antall – eller tillat 1–3 om du vil).
2. **Options → Collect customers' addresses:** *Shipping address*. Velg landene du sender til.
3. **Options → Shipping rates:** legg til de tre satsene.
4. **Options → Require customers to provide a phone number:** på (fraktfirma trenger det).
5. **Options → Add custom fields → Dropdown** «Plug type»:
   EU (Type C/F) · UK (Type G) · US (Type A/B) · AU (Type I).
6. **After payment → Don't show confirmation page → Redirect customers to your website:**
   `https://vernis.art/thanks.html`
   (takkesiden er ferdig – den teller også kjøpet i Plausible).
7. **Inactive message** (vises når lenka er stengt):
   «Wave 2 has closed. Join the list for the next wave at vernis.art.»
8. Lag den. Gjenta for Vernis Rear.

### A6. Testkjøp 🔧
Åpne testlenka, betal med testkort **4242 4242 4242 4242**, hvilken som helst framtidig dato,
hvilken som helst CVC. Sjekk at:
- du havner på vernis.art/thanks.html (fungerer først når siden er publisert),
- ordren i Stripe viser adresse, telefon, støpseltype og fraktsone,
- kvitteringsmailen kommer.

### A7. Gå live 🔧
Slå av Test mode, lag de samme produktene/satsene/lenkene i live-modus (testdata kopieres ikke
automatisk – Stripe har en «Copy to live mode»-knapp på produkter).

**Send til Claude:** de to live-lenkene (`https://buy.stripe.com/...`). De er ikke hemmelige.

### A8. Når vinduet stenger 🔧
Stripe kan ikke stenge en lenke på dato. Når vinduet går ut: **Payment Links → lenka →
Deactivate**. Nettsiden bytter selv knappene til ventelista i samme minutt.
(Vil du ha det helt automatisk, kan jeg lage et lite skript som deaktiverer lenkene via API –
krever en Stripe-nøkkel som lagres hos deg, aldri i repoet.)

---

## B. Salgsvinduet (data/sale.json)

**Send til Claude:** start og slutt (dato + klokkeslett, Oslo-tid) og hvor mange uker etter
stenging du sender. Jeg setter:

```json
{ "wave": 2, "opens": "2026-10-14T12:00:00+02:00", "closes": "2026-10-21T20:00:00+02:00", "shipsWeeksAfterClose": 6 }
```

Før start viser siden «Wave 2 opens …» og sender folk til ventelista. Under vinduet vises en
nedtelling og kjøpsknappene. Etterpå: «Wave 2 has closed».

---

## C. Mailchimp (venteliste)

### C1. Konto 🔧
1. Lag gratis konto på mailchimp.com (Free-planen holder til 500 kontakter).
2. Mailchimp krever en **postadresse** i hver e-post (antispam-lov). Den vises nederst i
   e-postene, ikke på nettsiden. Bruk selskapets adresse eller en postboks.
3. **Audience → Settings → Audience name and defaults**: navn «Vernis waitlist»,
   avsender «Vernis», e-post du svarer fra.
4. **Audience → Settings → Double opt-in: på** (anbefalt i EU – folk bekrefter adressen).

### C2. Hent skjema-adressen 🔧
**Audience → Signup forms → Embedded form** → se på koden. Finn linja:

```html
<form action="https://xxxx.us21.list-manage.com/subscribe/post?u=abc123&amp;id=def456&amp;f_id=..." ...>
```

og det skjulte feltet som ser ut som `name="b_abc123_def456"`.

**Send til Claude:** hele `action="..."`-adressen og `b_...`-navnet. Ikke hemmelig.

### C3. E-postene 🔧
Lag to kampanjer som du sender manuelt:
1. **«Wave 2 is open»** – samme dag vinduet åpner. Ett bilde, prisene, sluttidspunkt, knapp til
   vernis.art/#editions.
2. **«Last 24 hours»** – dagen før det stenger.

---

## D. Plausible (besøk og kjøp)

1. 🔧 Lag konto på plausible.io (ca. €9/mnd, 30 dager gratis), legg til nettstedet `vernis.art`.
   Skriptet er allerede lagt inn på siden.
2. 🔧 **Site settings → Goals → Add goal:**
   - *Pageview* `/thanks.html` → kall den «Purchase»
   - *Custom event* `Checkout click`
   - *Custom event* `Tried own art`
   - *Custom event* `Waitlist signup`
3. 🔧 **Site settings → Custom properties:** legg til `model` (Side/Rear) og `kind` (image/video).

Da ser du: besøkende → hvor mange prøvde egen kunst → hvor mange klikket kjøp → hvor mange
fullførte (thanks-siden). **Stripe er fasiten** for faktiske kjøp; Plausible viser veien dit.

---

## E. Før publisering (sjekkliste)

- [ ] Stripe live-lenker lagt inn (A7)
- [ ] `data/sale.json` fylt inn (B)
- [ ] Mailchimp-skjema koblet til (C2)
- [ ] Plausible-konto og mål (D)
- [ ] Vilkår og personvern godkjent og publisert (`docs/legal/`)
- [ ] Svar på MVA-spørsmålet for norske kunder (`docs/legal/terms-draft.md`, spørsmål 1)
- [ ] Varmetest av Vernis Rear i lukket kasse (flere timer video)
- [ ] Bilde av Vernis Rear (nå brukes et bilde av den andre modellen)
