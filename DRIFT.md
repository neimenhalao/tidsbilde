# Driftshåndbok – Tidsbilde

Brukes av den daglige arbeidsøkten kl. 16:00. Hold dette dokumentet oppdatert – det er hukommelsen mellom øktene.

## Mål og roller
- **Mål:** over 100 000 sidevisninger per måned på https://tidsbilde.no.
- **Eier** betaler for drift og gjør bare det Claude ikke kan gjøre selv (betaling, egne innlogginger/verifisering). **All vekst er Claudes ansvar.** Be aldri eieren poste, dele, sende e-post eller verve spillere.
- Meldinger/innlegg i prosjektets navn til andre (e-post, sosiale medier, skjemaer) krever eierens godkjenning – samle dem og be om ett samlet ja.

## Systemet
- Kode: `C:\Users\DanErikLinde\OneDrive - AREALUTVIKLING AS\Dokumenter\Claude code\tidsbilde`, repo `neimenhalao/tidsbilde` (offentlig), gren `main`.
- Hosting: GitHub Pages via Actions (`.github/workflows/deploy.yml`): bygger ved push og hver kveld 22:05 UTC. Morgendagens dag og gårsdagens bildesider kommer automatisk.
- Repo-variabler: `SITE_DOMAIN=tidsbilde.no`, `GOATCOUNTER=tidsbilde`, (`NOINDEX=1` kun før lansering).
- Statistikk: GoatCounter https://tidsbilde.goatcounter.com (eier er innlogget i Chrome). Hendelser: `hendelse-gjett`, `hendelse-ferdig`, `hendelse-del`.
- Søk: Google Search Console, domeneegenskap `sc-domain:tidsbilde.no` (eiers Google-konto i Chrome). IndexNow melder nye sider hver natt.
- DNS: Domeneshop-portalen (portal.domene.shop), 4 GitHub A-oppføringer + www CNAME + Google TXT. Ikke endre uten grunn.
- Lokal forhåndsvisning: `node tools/serve.mjs` (port 4321) eller preview «tidsbilde».

## Bildeflyt
1. `node tools/harvest.mjs <fra> <til>` – kandidater fra Commons til `data/candidates/` (ikke i git). Skånsom: én arbeider, håndterer 429.
2. Kuratorer (underagenter) etter `data/KURATERING.md` → `data/curated/<intervall>.json`. Gi dem tydelig årsintervall, mål, fylkesspredning, og at de bare skriver sin egen fil. Maks 2 samtidig (Wikimedia-grense). User-Agent `TidsbildeBot/0.2 (https://tidsbilde.no/om/)`, 500px-miniatyrer.
3. Kontroller rapporten: ta ut poster med usikkert år (håndkolorerte lysbilder, «ca.», reproduksjoner).
4. `node tools/fetch-images.mjs` → `data/img/`, `data/photos.json`.
5. `node tools/schedule.mjs [maks antall nye dager]` – legger nye dager **etter** eksisterende. **Publiserte dager endres aldri.** Kjør så `node tools/make-day-og.mjs` (forhåndsvisningsbilde per dag). `fetch-images.mjs` kan begrenses til navngitte filer så halvferdige kuratorfiler ikke tas med.
6. Commit + push → publiseres.

**Buffer:** hold minst 30 dager med ferdige dager foran dagens dato. Under 30 → kurater flere (neste ikke-dekkede år, deretter fyll hull i fylker/motiver).

## Daglig økt (16:00)
1. Les dette dokumentet, `VEKST.md`, `KOMMERSIALISERING.md` og siste fil i `rapporter/`.
2. **Helse:** siste GitHub Actions-kjøring grønn (`gh run list --limit 3`), https://tidsbilde.no svarer, dagens `data/dag/N.json` finnes.
3. **Tall:** GoatCounter (i går, siste 7 dager, hittil i måneden, hendelser, henvisere) og Search Console (klikk, visninger, indekserte sider) via Chrome. Bare les – ikke endre innstillinger.
4. **Buffer:** antall dager i `data/schedule.json` minus dagens dagnummer. Kurater ved behov.
5. **Vekst:** gjør 1–2 punkter fra backloggen under (høyest effekt først), test lokalt, publiser.
6. **Logg:** skriv `rapporter/ÅÅÅÅ-MM-DD.md` (tall, hva som ble gjort, neste steg), oppdater «Status» og backlogg her, commit + push.
7. **Rapport til eier** (siste melding, norsk, kort): tallene, hva som ble gjort, hva som skjer i morgen, og bare hvis nødvendig: hva eieren må gjøre (kun betaling/kontoer).

## Status
- 2026-11-26: **LANSERT.** Domene live, Search Console bekreftet (sitemap sendt inn, forsiden bedt indeksert), GoatCounter aktiv, IndexNow svarer 202, NOINDEX fjernet. 307 kuraterte bilder (1860–1954); dag 1–24 planlagt (120 bilder), 187 spart til blanding med 1955–2005. Tidsbilde #1 = fredag 27.11.2026. Innsamling 1860–2005 er ferdig (alle kandidatfiler i `data/candidates/`). Neste: kurater 1955–1969 og 1970–2005 (2 kuratorer), deretter `node tools/schedule.mjs 21` + `node tools/make-day-og.mjs`. Delingsside per dag (backlogg 1–2) er gjort.
- **2026-11-26 (gjelder bare økten denne dagen):** lanseringen pågår i hovedøkten. Dagens daglige økt skal KUN lese og rapportere status – ikke kurater, ikke endre filer i `data/`, ikke commit. Fra 2026-11-27 gjelder vanlig rutine.

## Backlogg (vekst, i prioritert rekkefølge)
1. ~~Delingsside per dag + «Klarer du å slå meg?»~~ (gjort 2026-11-26).
2. Etter `make-day-og.mjs`: husk at nye dager trenger forhåndsvisningsbilde (kjør etter hver schedule).
3. Kurater 1955–2005 (etterkrigstid, 50-, 60-, 70-tallet – sterk nostalgi for målgruppen).
4. Widget «Dagens Tidsbilde» (iframe/script) for historielag, bibliotek og lokalaviser.
5. Stedssider per fylke («Gamle bilder fra Vestland»), bedre intern lenking, «Dette skjedde i …»-tekst per tiår.
6. Mediekit + liste over pressekontakter, historielag og institusjoner (til samlet utsendelse når prosjektets e-post finnes).
7. Be eier om prosjektets e-postkonto og sosiale kontoer når det er 2+ uker med spill ute (samlet forespørsel).
8. Sponsorplass i resultatet (tom til vi har en sponsor), jf. `KOMMERSIALISERING.md`.
