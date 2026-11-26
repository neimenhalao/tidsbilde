# Kurateringsinstruks – Tidsbilde

Tidsbilde er et daglig norsk spill: spilleren ser et gammelt bilde fra Norge, gjetter **årstallet** og setter en **nål på Norgeskartet**. Fem bilder per dag. Din jobb er å velge gode bilder fra kandidatfilene og skrive en ren, korrekt post for hvert.

## Kilde
`data/candidates/{år}.json` – hver fil er en liste med kandidater fra Wikimedia Commons (`Category:{år} in Norway` + underkategorier). Felter: `year` (fra kategorien), `foundIn` (kategorien), `title` (Commons-filnavn), `thumb` (1400px-URL), `page` (Commons-side), `license`, `artist`, `credit`, `date`, `objectName`, `description`, `categories`, `coords`.

Alle kandidater har allerede fri lisens (offentlig eie, CC0, CC BY, CC BY-SA). Ikke ta med noe med NC/ND.

## Krav for å ta med et bilde (alle må oppfylles)
1. **Sikkert år.** Ett bestemt år, og `date`-feltet / beskrivelsen må stemme med `year`. Hopp over «ca.», «circa», «before», «between», intervaller, eller der `date` bare er opplastingsdato og beskrivelsen ikke bekrefter året.
2. **Sikkert sted på fastlands-Norge** (ikke Svalbard/Jan Mayen/utlandet), minst på nivå med tettsted/bygd/gård/gate. «Norge» eller bare et fylke er ikke godt nok. Koordinater må du fastsette selv (se under).
3. **Et ekte fotografi** av et sted, en hendelse eller hverdagsliv. Ikke: portretter av én person i studio, malerier, tegninger, kart, dokumenter, gjenstander på hvit bakgrunn, flyfoto uten kjennemerker, nesten svarte/ødelagte bilder.
4. **Ikke røpe svaret.** Unngå bilder der årstall eller stedsnavn står tydelig skrevet i selve bildet (påtrykt postkorttekst, skilt med årstall). Et butikkskilt i bakgrunnen er greit.
5. **Ikke sensitivt.** Ikke døde/skadde mennesker, krigsgrusomheter, fremtredende hakekors/NS-propaganda, nakenhet, eller bilder som henger ut enkeltpersoner. Hverdagsliv under okkupasjonen er greit.
6. **Spillverdi.** Bildet bør ha ledetråder spilleren kan resonnere med: klær, kjøretøy, bygninger, landskap, teknologi, kjente steder. Varier motivene: byliv, bygdeliv, havn og båter, samferdsel, arbeid, fritid, vinter, hendelser.

## Slik ser du på bildene
Bruk **PowerShell** til nedlasting (Bash-sandkassen når ikke nettet). Lag en egen mappe i din scratchpad, og last ned små versjoner ved å bytte `1400px-` med `400px-` i `thumb`-URL-en:
```powershell
Invoke-WebRequest -Uri $url -OutFile $fil -UseBasicParsing -Headers @{ 'User-Agent' = 'TidsbildeBot/0.2 (https://tidsbilde.no/om/)' }
```
Se på bildet med Read-verktøyet. Filtrer først på metadata (sted + år i beskrivelsen), og se bare på de lovende. Vent ca. 0,3 sek mellom nedlastinger.

## Koordinater
Bruk Kartverkets åpne stedsnavn-API når du er usikker:
`https://api.kartverket.no/stedsnavn/v1/navn?sok=Gjølanger&fuzzy=true&utkoordsys=4258&treffPerSide=5`
(svaret har `navn[].representasjonspunkt.nord/øst` = lat/lon, og `kommuner[].kommunenavn`, `fylker[].fylkesnavn`). Bruk dagens kommune- og fylkesnavn (2024-inndelingen, f.eks. Vestland, Innlandet, Buskerud, Akershus, Østfold, Telemark, Vestfold, Agder, Rogaland, Møre og Romsdal, Trøndelag, Nordland, Troms, Finnmark, Oslo). Kontroller at punktet faktisk ligger der bildet er tatt (ikke en annen plass med samme navn).

## Utdata
Skriv **én JSON-fil**: `data/curated/{ditt-intervall}.json` (f.eks. `1905-1929.json`), en liste med objekter:
```json
{
  "commonsTitle": "File:Grovfoss kraftstasjon.jpg",
  "thumb": "<thumb-URL fra kandidaten, 1400px>",
  "page": "<page-URL fra kandidaten>",
  "year": 1925,
  "title": "Grovfoss kraftstasjon",
  "place": "Geithus, Modum",
  "kommune": "Modum",
  "fylke": "Buskerud",
  "lat": 59.93, "lon": 9.95,
  "caption": "Kraftstasjonen ved Grovfoss i Drammenselva, rett nedenfor Geithus. På 1920-tallet ble det bygd kraftverk i mange norske elver for å skaffe strøm til industri og hjem.",
  "photographer": "Ukjent",
  "credit": "Foto: Ukjent / NVE Vassdragsarkivet",
  "license": "Public domain",
  "licenseUrl": null,
  "difficulty": 2,
  "quality": 3,
  "tags": ["industri", "elv"]
}
```
Feltregler:
- `title`: kort norsk tittel, maks ca. 6 ord, **uten årstall**, uten «Bilde av».
- `place`: «Sted, Kommune» eller bare kommunen hvis stedet er byen selv (f.eks. «Bryggen, Bergen», «Tromsø»).
- `caption`: 1–3 setninger på enkel norsk bokmål, **med egne ord** (ikke oversatt/kopiert ordrett fra Commons). Beskriv hva vi ser og gjerne én interessant, sikker fakta om tiden eller stedet. **Ikke dikt opp noe**; er du usikker, hold deg til det kilden sier.
- `photographer`: fotografens navn fra `artist`, ellers «Ukjent».
- `credit`: «Foto: {fotograf} / {institusjon eller samling}» (institusjon fra `credit`/beskrivelse, f.eks. Nasjonalbiblioteket, Riksarkivet, Norsk Folkemuseum, Oslo Museum). Står det ingen institusjon: «Foto: {fotograf} / Wikimedia Commons».
- `license`: nøyaktig lisensnavn fra kandidaten (f.eks. «Public domain», «CC BY 4.0», «CC BY-SA 4.0»). `licenseUrl`: URL til lisensen for CC-lisenser (f.eks. `https://creativecommons.org/licenses/by/4.0/`), ellers `null`.
- `difficulty`: 1 = lett (kjent sted eller tydelige tidsspor), 2 = middels, 3 = vanskelig.
- `quality`: 1–5, der 5 = slående bilde med mennesker/stemning som folk vil snakke om. Ta bare med 3 eller høyere.
- `tags`: 1–3 korte norske stikkord.

Til slutt: kjør en rask sjekk på at fila er gyldig JSON (`node -e "JSON.parse(require('fs').readFileSync('fil','utf8'))"`), og rapporter antall bilder, fordeling per tiår og per fylke, og hvor mange du forkastet og hvorfor (kort).
