# Cosmico Beach Dashboard 3.3.5

## Nieuw
- Reddingsbrigade-blok met herkenbaar oranje accent; rood/groen blijft exclusief voor veiligheidsstatus.
- Lifeguard-status: 🛟 LIFEGUARD ON DUTY / ❌ NO LIFEGUARD.
- Webcam vult TV/kiosk en desktop/laptop zoveel mogelijk zonder vervorming.
- Uurverwachting groter en beter leesbaar op afstand.
- Slimme uurregel: bij minder dan 10% regenkans geen regenmelding.
- Vanaf 10% verschijnt 🌧️ met het actuele regenpercentage.
- Zon én regenkans worden gecombineerd, bijvoorbeeld: ☀️ 25 MIN · 🌧️ 30% REGEN.
- Minuten zon per uur komen uit Open-Meteo `sunshine_duration`.
- Onderste adviesbalk bevat dynamische Cosmico-weer-oneliners met een knipoog.
- Oneliner extra prominent op mobiel en in het losse Wix-adviesblok.

Cacheversie: 335

- 3.3.5: officieel Reddingsbrigade-oranje (#ff5a00) duidelijker zichtbaar; layout ongewijzigd.


## Kiosk animatie 3.3.5
Alleen in TV/kiosk-modus komen de zeven conditie-items onderaan één voor één 2 seconden vergroot naar voren. Daarna volgt 3 seconden rust voordat het volgende item wordt uitgelicht. Desktop, mobiel en Wix-embeds blijven statisch.

- 3.3.5: kiosk focusanimatie vertraagd: circa 1,05 s rustig vergroten, circa 2 s volledig groot, circa 1,05 s rustig verkleinen, daarna 3 s rust.


## 3.3.5 — bewegend COSMICO BEACH in kiosk
Alleen in TV/kiosk-modus beweegt de grote COSMICO BEACH-merknaam langzaam van links naar rechts en terug. De weer-pill en klok blijven op hun vaste plek en liggen visueel boven de bewegende merknaam.
