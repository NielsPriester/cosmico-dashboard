"use strict";

/* Mango's Dashboard 3.4.3 TECH
   Technische isolatielaag: ieder dashboardblok rendert zelfstandig,
   zodat een fout in forecast/reddingsbrigade/getij/advies de rest niet blokkeert. */
(function () {
  var techErrors = [];

  function messageOf(error) {
    if (!error) return "onbekende fout";
    return String(error.message || error).slice(0, 90);
  }

  function remember(name, error) {
    techErrors.push(name + ": " + messageOf(error));
    if (techErrors.length > 4) techErrors.shift();
  }

  function safe(name, fn, fallback) {
    try {
      return fn();
    } catch (error) {
      remember(name, error);
      try { if (fallback) fallback(error); } catch (_) { /* fallback mag nooit blokkeren */ }
      return null;
    }
  }

  function setHtml(id, html) {
    var node = document.getElementById(id);
    if (node) node.innerHTML = html;
  }

  function numberTextSafe(value, decimals) {
    var n = Number(value);
    return Number.isFinite(n) ? n.toFixed(decimals || 0) : "—";
  }

  /* Vervang applyData door een gesegmenteerde versie. De datalaag blijft
     hetzelfde als Cosmico; alleen het renderen wordt per kader geïsoleerd. */
  applyData = function (weatherData, marineData, posts, fromCache) {
    techErrors = [];

    var current = weatherData && weatherData.current ? weatherData.current : {};
    var daily = weatherData && weatherData.daily ? weatherData.daily : {};
    var marine = marineData && marineData.current ? marineData.current : {};
    var marineHourly = marineData && marineData.hourly ? marineData.hourly : {};
    var uv = daily.uv_index_max && daily.uv_index_max.length ? daily.uv_index_max[0] : null;

    safe("bron", function () {
      setText("forecastSource", ((weatherData && weatherData._cosmicoSource === "BEST MATCH") ? "WEERMODEL" : "KNMI") + " · 8 UUR");
    });

    safe("thema", function () {
      sky.sunrise = daily.sunrise && daily.sunrise[0] ? daily.sunrise[0] : sky.sunrise;
      sky.sunset = daily.sunset && daily.sunset[0] ? daily.sunset[0] : sky.sunset;
      sky.sunriseNext = daily.sunrise && daily.sunrise[1] ? daily.sunrise[1] : sky.sunriseNext;
      if (current.weather_code !== undefined && current.weather_code !== null) sky.weatherCode = current.weather_code;
      applyTheme();
      updateSunCard();
    });

    safe("actueel weer", function () {
      var weather = weatherInfo(current.weather_code, sky.isNight);
      var description = weather[0];
      var icon = weather[1];
      setText("weatherIcon", icon);
      setText("headerWeatherIcon", icon);
      setText("temperature", numberTextSafe(current.temperature_2m) + "°");
      setText("headerTemperature", numberTextSafe(current.temperature_2m) + "°");
      setText("condition", description);
      setText("headerCondition", description);
      setText("feelsLike", numberTextSafe(current.apparent_temperature) + "°C");
      setText("wind", numberTextSafe(current.wind_speed_10m) + " km/u " + compassDirection(current.wind_direction_10m));
      setWindArrow(current.wind_direction_10m);
      setText("windGusts", numberTextSafe(current.wind_gusts_10m) + " km/u");
      setText("uvIndex", numberTextSafe(uv, 1));
      setText("precipitation", numberTextSafe(current.precipitation, 1) + " mm");

      var visibilityValue = Number(current.visibility);
      var visibilityUnit = String((weatherData && weatherData.current_units && weatherData.current_units.visibility) || "m").toLowerCase();
      var visibilityKm = visibilityUnit === "km" ? visibilityValue : visibilityValue / 1000;
      setText("visibility", Number.isFinite(visibilityKm) ? visibilityKm.toFixed(0) + " km" : "—");
      setText("humidity", numberTextSafe(current.relative_humidity_2m) + "%");
    }, function () {
      setText("condition", "Weerdata tijdelijk niet beschikbaar");
    });

    safe("zeecondities", function () {
      setText("waveHeight", numberTextSafe(marine.wave_height, 1) + " m");
      setText("waveDirection", compassDirection(marine.wave_direction));
      setText("wavePeriod", numberTextSafe(marine.wave_period, 1) + " sec");
      setText("waterTemperature", numberTextSafe(nearestHourlyValue(marineHourly, "sea_surface_temperature"), 1) + "°C");
    });

    safe("getij", function () {
      renderTide(marineHourly);
    }, function () {
      setText("tideState", "Getij tijdelijk niet beschikbaar");
      setText("tideHeight", "Stand -- m");
      setText("nextHighTide", "--:--");
      setText("nextLowTide", "--:--");
    });

    safe("forecast", function () {
      if (weatherData && weatherData.hourly) {
        renderHourly(weatherData.hourly);
      } else {
        throw new Error("geen uurdata ontvangen");
      }
    }, function (error) {
      setHtml("hourlyForecast", '<div class="loading-copy">Verwachting tijdelijk niet beschikbaar<br><small>' + messageOf(error) + '</small></div>');
    });

    safe("reddingsbrigade", function () {
      renderRescuePosts(Array.isArray(posts) ? posts : []);
    }, function (error) {
      setHtml("rescuePosts", '<article class="rescue-post safety-unknown compact-rescue-post"><div class="rescue-copy"><h3>▲ NOORD</h3><strong>Status tijdelijk niet beschikbaar</strong></div></article><article class="rescue-post safety-unknown compact-rescue-post"><div class="rescue-copy"><h3>▼ ZUID</h3><strong>Status tijdelijk niet beschikbaar</strong></div></article>');
      remember("strand app", error);
    });

    safe("strandadvies", function () {
      setText("beachAdvice", buildAdvice(current, marine, uv));
    }, function () {
      setText("beachAdvice", "Actuele data is deels beschikbaar. Volg voor veiligheid altijd de aanwijzingen ter plaatse.");
    });

    var status = fromCache ? "Laatste opgeslagen gegevens" : "Bijgewerkt " + formatClock(new Date());
    if (techErrors.length) status += " · TECH: " + techErrors.join(" | ");
    setConnection(!fromCache && techErrors.length === 0, status);
  };

  /* Start na het overschrijven nog één schone laadcyclus. Dit voorkomt
     dat de eerste, al gestarte cyclus op de oude renderer blijft hangen. */
  window.setTimeout(function () {
    try { loadDashboard(); } catch (error) { remember("herladen", error); }
  }, 500);
})();
