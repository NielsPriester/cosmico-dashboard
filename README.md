# Cosmico Beach Dashboard 2.1

Deze versie bevat:

1. Getijdenindicatie met opkomend/afgaand water en volgende vloed/eb.
2. Zeetemperatuur.
3. Slim strandadvies op basis van weer, wind, golven, UV en zeetemperatuur.
4. Een grotere webcamweergave.
5. Duidelijke status van de Reddingsbrigade: BEWAAKT of GEEN TOEZICHT.

## Databronnen

- Open-Meteo Weather API
- Open-Meteo Marine API
- Productie-API van Strand App

## Belangrijk over getijden

De getijden zijn een modelindicatie uit de Open-Meteo Marine API. Ze zijn geschikt
als publieksinformatie, maar niet voor kustnavigatie. De officiële informatie en
aanwijzingen ter plaatse blijven altijd leidend.

## Uploaden

Vervang in de root van je GitHub-repository:

- index.html
- style.css
- script.js
- CNAME
- assets/cosmico-watermark.jpg

Daarna committen en pushen. De bestanden gebruiken cacheversie `v=210`.
