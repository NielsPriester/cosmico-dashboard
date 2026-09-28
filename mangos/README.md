# Mango's Beachbar Dashboard 3.6.0

## Wat is er opgelost
- **Script crashte op de tv**: `replaceAll`, `?.`, `??` en `Promise.allSettled` eruit. Die bestaan niet in de oudere browser van de PEAQ-tv. Daardoor bleven Reddingsbrigade, advies en "Gegevens laden…" hangen.
- **Elke blok rendert los** (try/catch): valt één bron uit, dan werkt de rest gewoon door.
- **Nooit meer eeuwig "laden…"**: bij storing verschijnt een duidelijke fallback ("Geen live verbinding met Strand App · let op de vlaggen").
- **Camera**: geen `aspect-ratio` meer (werkt niet op oude tv-browsers). Het frame heeft nu een vaste maat.
- **Getij**: eerst hoog- en laagwater bepalen, daarna pas de status. Opkomend/afgaand en de eb/vloed-tijden kunnen elkaar niet meer tegenspreken. Eb/vloed tonen altijd de *volgende* tijd.
- **Wind** staat nu prominent in beeld (Bft + richting + pijl + km/u + stoten), ook per uur in de verwachting.

## Layout
- Vaste canvas van 1920×1080 die als geheel meeschaalt naar elk tv-scherm. Er valt niets meer weg en niets overlapt.
- Alle tekst en waardes zijn fors groter, leesbaar vanaf de bar.
- Anton (Google Fonts) als koptekstfont, omdat Impact niet op Android-tv's staat.
- `?mode=mobile` (of een smal scherm): scrollbare telefoonweergave.

## Data
- Weer: KNMI Seamless via Open-Meteo (valt automatisch terug op Best Match)
- Zee/getij: Open-Meteo Marine (modelindicatie, niet voor navigatie)
- Strandposten: Strand App Zandvoort

## Installeren
Vervang `index.html`, `style.css` en `script.js`. De map `assets/` (roundel en host-illustratie) blijft zoals hij is.
Cacheversie: 360
