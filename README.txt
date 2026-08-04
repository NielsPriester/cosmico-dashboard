COSMICO BEACH DASHBOARD 3.1 — VERBETERDE RELEASE
=================================================

Wat is er veranderd t.o.v. 3.0.3:
- Dag/nacht-adaptief thema: kleuren en achtergrond schuiven automatisch mee
  met zonsopgang/-ondergang (dawn / day / dusk / night), incl. sterrenhemel
  en maan 's nachts. Werkt zonder herladen, ook tussen twee databeurten in.
- Weerpictogram en omschrijving wisselen 's nachts naar een nachtvariant
  (bijv. "Onbewolkt" ☀️ wordt "Helder" 🌙) in plaats van een zon bij het
  invallen van de duisternis.
- Zonkaart onderin wisselt automatisch tussen "Zonsondergang" en
  "Zonsopgang" (met tijd van morgen) zodra het nacht is geworden.
- Windmetric heeft nu een roterend pijltje dat de actuele windrichting
  visueel toont, naast de bestaande tekstwaarde.
- Getijden-tegel heeft een kleine live sparkline (SVG) van de
  waterstand rond het huidige moment, met een stip op "nu".
  Basisdata en disclaimer blijven ongewijzigd (modelindicatie).
- Eerstvolgende uur in de 6-uursverwachting krijgt een lichte
  markering, zodat meteen duidelijk is welk blokje "nu" is.
- prefers-reduced-motion wordt gerespecteerd: alle animaties pauzeren
  voor bezoekers die minder beweging willen zien.
- Belangrijkste tekstvelden (temperatuur, advies, strandposten,
  verbindingsstatus) hebben aria-live, voor betere toegankelijkheid
  op schermlezers.
- Advies-tekst laat 's nachts geen UV-waarschuwing meer zien en geeft
  een rustiger avondboodschap.

Alle bestaande functionaliteit is behouden: live webcam, weer,
zes-uursverwachting, beide reddingsposten via Strand App, golfhoogte,
zeetemperatuur, golfrichting/-periode, luchtvochtigheid, lokale cache
met back-off bij storingen, en de tv/laptop/mobiel-modi.

INSTALLEREN
1. Overschrijf in de hoofdmap van de website:
   - index.html
   - style.css
   - script.js
2. Wacht tot de website opnieuw gepubliceerd is.
3. Open de pagina met cacheversie 310 (query ?v=310 zit al in de bestanden).

TV / FULLY KIOSK
https://dashboard.cosmicobeach.nl/?mode=tv&v=310

LAPTOP
https://dashboard.cosmicobeach.nl/?mode=laptop&v=310

MOBIEL
https://dashboard.cosmicobeach.nl/?mode=mobile&v=310

BELANGRIJK
- De getijden- en waterstandgegevens zijn een modelindicatie boven gemiddeld zeeniveau en niet bedoeld voor navigatie of zwemveiligheidsbeslissingen.
- Officiële strandvlaggen en instructies van de reddingsbrigade blijven altijd leidend.
- De webcam gebruikt de bestaande YouTube-livestream van Zandvoort Boulevard en strand.
- Open-Meteo en Strand App gegevens worden lokaal gecachet als een bron tijdelijk uitvalt.
- Strand App gebruikt time-out en oplopende back-off bij storingen of rate-limits.

RELEASE
Versie: 3.1.0
Cacheversie: 310
Datum: 4 augustus 2026
