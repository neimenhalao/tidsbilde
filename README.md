# Tidsbilde

Daglig norsk bildespill: fem historiske bilder fra Norge hver dag – gjett årstallet og sett en nål på kartet.

## Flyt
1. `node tools/harvest.mjs 1860 2005` – henter kandidater fra Wikimedia Commons (`data/candidates/`, ikke i git).
2. Kurateringsteam velger bilder etter `data/KURATERING.md` → `data/curated/*.json`.
3. `node tools/fetch-images.mjs` – laster ned og skalerer bilder → `data/img/`, `data/photos.json`.
4. `node tools/schedule.mjs` – legger ubrukte bilder inn på nye dager i `data/schedule.json` (eksisterende dager endres aldri).
5. `node tools/build.mjs` – bygger `dist/`. GitHub Actions bygger og publiserer ved push og hver kveld 22:05 UTC.

Lokalt: `node tools/serve.mjs` → http://localhost:4321

## Innstillinger (GitHub → Settings → Variables)
- `SITE_DOMAIN` – f.eks. `tidsbilde.no`
- `BASE_PATH` – `/tidsbilde` når siden ligger på github.io, tom på eget domene
- `NOINDEX` – `1` på forhåndsvisning
- `GOATCOUNTER` – kode for anonym besøksstatistikk

Kart: © Kartverket (CC BY 4.0) via robhop/fylker-og-kommuner; naboland fra Natural Earth (offentlig eie).
Bilder: Wikimedia Commons, fri lisens eller falt i det fri – kreditt og lisens ved hvert bilde.
