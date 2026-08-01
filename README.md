# Cosmico Beach Dashboard — v1.0 Stable

Live dashboard voor Cosmico Beach in Zandvoort.

## Uploaden

Vervang in de root van de GitHub-repository:

- `index.html`
- `style.css`
- `script.js`
- `CNAME`
- de map `assets`

GitHub Pages blijft publiceren via `dashboard.cosmicobeach.nl`.

Na upload kun je een harde refresh doen met `Cmd + Shift + R`.

## In deze versie

- productie-API van Strand App;
- afzonderlijke foutafhandeling voor weer, zee en strandposten;
- behoud van laatst bekende gegevens tijdens een storing;
- retry na één minuut;
- normale update iedere tien minuten;
- time-out na vijftien seconden;
- bescherming tegen dubbele gelijktijdige updates;
- fullscreen- en mobiele layout.
