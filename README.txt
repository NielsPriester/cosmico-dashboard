COSMICO BEACH DASHBOARD 3.0
============================

BESTANDEN
- index.html
- style.css
- script.js

INSTALLEREN OP GITHUB PAGES
1. Verwijder of overschrijf de oude index.html, style.css en script.js.
2. Upload deze drie nieuwe bestanden naar de hoofdmap van de repository.
3. Wacht tot GitHub Pages opnieuw gepubliceerd is.
4. Open de pagina eenmalig met ?v=30 om oude cache te omzeilen.

VERSIES / URL'S
- Automatische layout:
  https://jouwdomein.nl/?v=30

- TV / Fully Kiosk:
  https://jouwdomein.nl/?mode=tv&v=30

- Laptop geforceerd:
  https://jouwdomein.nl/?mode=laptop&v=30

- Mobiel geforceerd:
  https://jouwdomein.nl/?mode=mobile&v=30

AANBEVOLEN VOOR DE TV
Gebruik in Fully Kiosk exact de TV-url met ?mode=tv&v=30.
Zet browserzoom op 100%, verberg navigatiebalken en gebruik volledig scherm.
De dashboarddata wordt iedere 10 minuten vernieuwd. De pagina zelf herlaadt iedere 6 uur.

NIEUW IN 3.0
- Aparte tv-, laptop- en mobiele layout in dezelfde bestanden.
- TV-modus wordt niet meer afhankelijk van de Android/Fully Kiosk schermdetectie.
- Geanimeerde zon, golven, windrichting en statuslampjes.
- Watertemperatuur toegevoegd.
- Productie-endpoint van Strand App.
- Laatst geslaagde gegevens worden lokaal bewaard als een databron tijdelijk uitvalt.
- Automatische retry na 1 minuut bij een gedeeltelijke storing.

LIVE BRONNEN
- Open-Meteo weer
- Open-Meteo Marine
- Strand App Zandvoort

RELEASE
Versie: 3.0
Cacheversie: 30
Datum: 3 augustus 2026


ANIMATIES 3.0.2
----------------
De draaiende zonnestralen, pulserende zon, bewegende golven en schuivende schuimlijn zijn versneld en extra zichtbaar gemaakt. De eerdere reduced-motion blokkade is verwijderd, omdat dit dashboard bedoeld is voor bewegende narrowcasting in Fully Kiosk.


BRONBEVEILIGING
----------------
Netwerkaanvragen stoppen na 12 seconden. Er worden geen cookies of inloggegevens meegestuurd. Als alleen de Strand App niet reageert, blijven de laatst opgeslagen strandgegevens zichtbaar en worden de Open-Meteo-bronnen niet iedere minuut opnieuw bevraagd.
