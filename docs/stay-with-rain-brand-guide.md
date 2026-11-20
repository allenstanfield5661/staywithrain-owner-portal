# Stay with Rain — Official Brand Guide & UI Reference

Installed in this repo: web logos in `public/brand/`, this guide at `docs/stay-with-rain-brand-guide.md`, and the one-page visual guide (PNG and PDF) in `docs/brand/`. The always-on Cursor rule is `.cursor/rules/stay-with-rain-brand.mdc`.

## Brand Identity
- **Name:** Stay with Rain (`STAY WITH RAIN` in all-caps wordmark/display)
- **Location:** Ocean Springs, MS & the Mississippi Gulf Coast
- **Parent / Sister Brand:** Rain Residential (lead with **Stay with Rain** on all STR, guest, and owner-portal surfaces)
- **Tagline (guest-facing):** *"Memorable stays in a town like no other"*
- **Voice:** Warm, local, polished, and helpful — like a trusted friend and local expert who knows the Mississippi Gulf Coast inside and out. Clear, direct, human prose; avoid generic SaaS buzzwords or stiff corporate language.

## Color Palette (CSS Custom Properties)
```css
:root {
  /* Core Brand */
  --swr-navy: #12384F;         /* Primary brand anchor: headers, primary buttons, dark hero/nav */
  --swr-charcoal: #2B2A28;     /* Primary dark text */
  --swr-porch-peach: #F4D9BE;  /* Signature warm accent: soft surfaces, badges, warm highlights */
  --swr-sand: #D4A975;         /* Warm gold/sand accent, rules (#D9AB76), sun mark */
  --swr-gulf-teal: #A9D6D3;    /* Light coastal water accent */
  --swr-seafoam: #7AABB0;      /* Secondary coastal accent, charts, calm highlights */
  --swr-rust: #B85C22;         /* Warm terracotta accent (use sparingly for callouts/emphasis) */
  --swr-olive: #4D4E13;        /* Earthy botanical accent (use sparingly) */
  --swr-mist: #E8E8E8;         /* Subtle borders, dividers, muted neutral surfaces */
  --swr-cream: #FAF7F3;        /* Soft warm off-white page background */
  --swr-white: #FFFFFF;
}
```

## Typography (Google Fonts)
- **Wordmark / Editorial Display:** `Aboreto` (Regular 400, uppercase with generous letter-spacing — matches the official header lockups)
- **Headings / UI Titles:** `League Spartan` (Weights 500, 600, 700)
- **Body / UI / Tables / Data:** `Montserrat` (Weights 400, 500, 600, 700)
- **Script Accent (sparingly):** `Allura` (stand-in for Bacalisties — light editorial flourish only; never for data, buttons, or long copy)

## Official Logo & Graphic Assets (included in `assets/`)
Use the matching transparent PNG for the background contrast:
- `assets/swr_header_logo_navy.png` — Primary navy lockup (`STAY WITH RAIN` + sand rule + `OCEAN SPRINGS, MS`) for **light backgrounds** (sign-in card, light hero, print)
- `assets/swr_header_logo_white.png` — Primary white lockup (`STAY WITH RAIN` + sand rule + `OCEAN SPRINGS, MS`) for **dark navy (`#12384F`) backgrounds**
- `assets/swr_header_logo_navy_wordmark.png` — Compact navy wordmark (`STAY WITH RAIN`) for **light navbars/headers**
- `assets/swr_header_logo_white_wordmark.png` — Compact white wordmark (`STAY WITH RAIN`) for **dark navy navbars/headers**
- `assets/swr_logo_transparent.png` — Stacked tree-and-sun emblem + `STAY WITH RAIN` (transparent, for **light backgrounds**)
- `assets/starburst_web_faded.png` & `assets/starburst_web.png` — Transparent decorative Rain starburst mark (great as a subtle low-opacity background texture in a hero or sign-in panel)
- `assets/stay_with_rain_fb_profile.jpg` — Square social/avatar badge (`STAY WITH RAIN` tree mark in Porch Peach circle on navy ring — good reference for favicons/app icons)
- `assets/stay_with_rain_brand_guide.png` & `assets/stay_with_rain_brand_guide.pdf` — Full visual one-page Brand Guide

## Standing Copy & Compliance Rules
1. **No hard-coded property counts:** Never write "eight houses" or fix the portfolio to a static count — the portfolio grows and changes. Describe it naturally (e.g., "Mississippi Gulf Coast vacation rentals" or "Ocean Springs & Gulf Coast short-term rentals").
2. **Phone label rule (strict):** The Stay with Rain phone number is `228-875-4496`. Whenever displayed, label it **Call** only (e.g., `Call 228-875-4496`) — **never** write "text", "SMS", or "Call or text".
3. **Official links & contact:**
   - Guest booking site: `https://staywithrain.thebookingportal.com/`
   - Email: `allen@raindev.com`
   - Instagram: `@staywithrain_os`
   - Facebook: `facebook.com/staywithrain`
4. **No hashtags** in UI or marketing copy.

## Owner Portal Design Guidance
- **Tone for owners:** Calm, refined coastal hospitality meets crisp financial clarity — confident, transparent, effortless.
- **Visual hierarchy:** Anchor navigation/hero moments in Stay with Rain Navy (`#12384F`) or airy warm off-white (`#FAF7F3`), pair with crisp white cards, Mist (`#E8E8E8`) borders, Porch Peach (`#F4D9BE`) / Sand (`#D4A975`) warmth, and Seafoam (`#7AABB0`) / Navy (`#12384F`) data accents.
- **Keep contrast accessible:** Ensure WCAG AA contrast on all text and buttons (e.g., white text on `#12384F`, `#12384F` or `#2B2A28` text on `#F4D9BE` / `#FAF7F3` / `#FFFFFF`).
