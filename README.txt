COSMICO BEACH DASHBOARD 3.0.1
==============================

BESTANDEN
- index.html
- style.css
- script.js

INSTALLEREN OP GITHUB PAGES
1. Overschrijf de oude index.html, style.css en script.js.
2. Upload deze drie bestanden naar de hoofdmap van de repository.
3. Wacht tot GitHub Pages opnieuw gepubliceerd is.
4. Open de pagina eenmalig met ?v=301 om oude browsercache te omzeilen.

VERSIES / URL'S
- Automatische layout:
  https://jouwdomein.nl/?v=301

- TV / Fully Kiosk:
  https://jouwdomein.nl/?mode=tv&v=301

- Laptop geforceerd:
  https://jouwdomein.nl/?mode=laptop&v=301

- Mobiel geforceerd:
  https://jouwdomein.nl/?mode=mobile&v=301

AANBEVOLEN VOOR DE TV
Gebruik in Fully Kiosk exact de TV-url met ?mode=tv&v=301.
Zet browserzoom op 100%, verberg navigatiebalken en gebruik volledig scherm.
De weer- en zeedata worden iedere 10 minuten vernieuwd. De pagina herlaadt iedere 6 uur.

BRONBEVEILIGING
- Elke aanvraag heeft een time-out van 12 seconden, zodat een vastgelopen bron de TV niet blokkeert.
- De Strand App wordt zonder cookies/inloggegevens aangeroepen.
- Bij een 401, 403, 429, time-out of andere fout blijven de laatst bekende strandgegevens zichtbaar.
- Bij herhaalde Strand App-fouten wordt de wachttijd automatisch langer: 5, 10, 20, 40 en maximaal 60 minuten.
- Een storing van alleen de Strand App veroorzaakt niet langer iedere minuut extra aanvragen bij Open-Meteo.
- Een Retry-After-header van de server wordt gerespecteerd wanneer die aanwezig is.

SCHERMFORMATEN
- Normale 1920×1080-tv-layout.
- Extra compacte TV-regel voor 1366×768 en vergelijkbare resoluties/scalers.
- Test de uiteindelijke weergave altijd op het echte scherm met browserzoom 100%.

ZICHT
Open-Meteo levert zicht standaard in meters. Dashboard 3.0.1 leest daarnaast de meegeleverde unit uit current_units.visibility. Wanneer Open-Meteo ooit kilometers teruggeeft, wordt niet opnieuw door 1000 gedeeld.

LIVE BRONNEN
- Open-Meteo Weather API
- Open-Meteo Marine API
- Strand App Zandvoort productie-endpoint

WIJZIGINGEN IN 3.0.1
- Time-out en exponentiële back-off voor de Strand App.
- Bescherming tegen rate-limit- en authenticatiefouten.
- Unitbewuste omzetting van zicht naar kilometers.
- Compacte TV-layout voor 1366×768.
- Cache-busting verhoogd naar 301.

RELEASE
Versie: 3.0.1
Cacheversie: 301
Datum: 3 augustus 2026
