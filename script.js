const LAT = 52.3765;
const LON = 4.5330;
const SEA_LAT = 52.39;
const SEA_LON = 4.45;

const weatherUrl =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${LAT}` +
  `&longitude=${LON}` +
  `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
  `&hourly=temperature_2m,precipitation_probability,weather_code,uv_index,visibility` +
  `&daily=sunrise,sunset,uv_index_max` +
  `&timezone=Europe%2FAmsterdam` +
  `&forecast_days=2` +
  `&wind_speed_unit=kmh`;

const marineUrl =
  `https://marine-api.open-meteo.com/v1/marine` +
  `?latitude=${SEA_LAT}` +
  `&longitude=${SEA_LON}` +
  `&current=wave_height,wave_direction,wave_period` +
  `&timezone=Europe%2FAmsterdam`;

const $ = (id) => document.getElementById(id);

const windDirections = [
  "N", "NNO", "NO", "ONO",
  "O", "OZO", "ZO", "ZZO",
  "Z", "ZZW", "ZW", "WZW",
  "W", "WNW", "NW", "NNW"
];

function number(value, decimals = 0) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "--";
}

function windDirection(degrees) {
  if (!Number.isFinite(degrees)) return "--";

  const normalized = ((degrees % 360) + 360) % 360;
  return windDirections[Math.round(normalized / 22.5) % 16];
}

function weatherInfo(code) {
  if (code === 0) return ["Zonnig", "☀️"];
  if (code <= 2) return ["Licht bewolkt", "🌤️"];
  if (code === 3) return ["Bewolkt", "☁️"];
  if (code === 45 || code === 48) return ["Mistig", "🌫️"];
  if (code >= 51 && code <= 57) return ["Motregen", "🌦️"];
  if (code >= 61 && code <= 67) return ["Regen", "🌧️"];
  if (code >= 80 && code <= 82) return ["Buien", "🌦️"];
  if (code >= 95) return ["Onweer", "⛈️"];

  return ["Wisselend", "🌥️"];
}

function updateClock() {
  const now = new Date();

  $("clock").textContent = now.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit"
  });

  $("date").textContent = now.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function beachAdvice(gusts, waves, uv, weatherCode) {
  const messages = [];

  if (weatherCode >= 95) {
    messages.push("Kans op onweer. Volg de aanwijzingen van medewerkers en hulpdiensten.");
  } else if (weatherCode >= 61) {
    messages.push("Er worden buien verwacht. Houd de actuele lucht goed in de gaten.");
  }

  if (gusts >= 55) {
    messages.push("Het waait zeer stevig. Let extra op losse spullen en parasols.");
  } else if (gusts >= 40) {
    messages.push("Er staat een stevige wind. Houd lichte spullen goed vast.");
  }

  if (waves >= 1.5) {
    messages.push("De zee is onrustig. Volg altijd de strandvlaggen.");
  } else if (waves >= 1) {
    messages.push("Er staat merkbare golfslag. Let extra op kinderen bij de waterlijn.");
  }

  if (uv >= 6) {
    messages.push("De UV-kracht is hoog. Smeer regelmatig en zoek op tijd de schaduw op.");
  }

  if (messages.length === 0) {
    messages.push("Prima strandweer. Geniet ervan en blijf de strandvlaggen volgen.");
  }

  return (
    messages.join(" ") +
    "<small>De officiële strandvlaggen en instructies van hulpdiensten zijn altijd leidend.</small>"
  );
}

async function loadDashboard() {
  try {
    const [weatherResponse, marineResponse] = await Promise.all([
      fetch(weatherUrl, { cache: "no-store" }),
      fetch(marineUrl, { cache: "no-store" })
    ]);

    if (!weatherResponse.ok || !marineResponse.ok) {
      throw new Error("Live databron niet bereikbaar");
    }

    const weatherData = await weatherResponse.json();
    const marineData = await marineResponse.json();

    const current = weatherData.current;
    const marine = marineData.current || {};

    const [description, icon] = weatherInfo(current.weather_code);

    $("temperature").textContent = `${number(current.temperature_2m)}°`;
    $("weatherIcon").textContent = icon;
    $("condition").textContent = description;

    $("feelsLike").textContent =
      `${number(current.apparent_temperature)}°`;

    $("wind").textContent =
      `${windDirection(current.wind_direction_10m)} ` +
      `${number(current.wind_speed_10m)} km/u`;

    $("gusts").textContent =
      `${number(current.wind_gusts_10m)} km/u`;

    $("precipitation").textContent =
      `${number(current.precipitation, 1)} mm`;

    $("humidity").textContent =
      `${number(current.relative_humidity_2m)}%`;

    let hourIndex = weatherData.hourly.time.indexOf(current.time);

    if (hourIndex < 0) {
      hourIndex = 0;
    }

    $("uvIndex").textContent =
      number(weatherData.hourly.uv_index[hourIndex], 1);

    $("uvMax").textContent =
      number(weatherData.daily.uv_index_max[0], 1);

    $("visibility").textContent =
      `${number(weatherData.hourly.visibility[hourIndex] / 1000, 1)} km`;

    $("sunrise").textContent =
      weatherData.daily.sunrise[0].slice(11, 16);

    $("sunset").textContent =
      weatherData.daily.sunset[0].slice(11, 16);

    $("waveHeight").textContent =
      `${number(marine.wave_height, 1)} m`;

    $("waveDirection").textContent =
      windDirection(marine.wave_direction);

    $("wavePeriod").textContent =
      `${number(marine.wave_period, 1)} s`;

    let forecastHtml = "";

    for (let step = 0; step < 6; step += 1) {
      const index = Math.min(
        hourIndex + step * 2,
        weatherData.hourly.time.length - 1
      );

      const [, forecastIcon] = weatherInfo(
        weatherData.hourly.weather_code[index]
      );

      forecastHtml += `
        <div class="hour">
          <div class="time">
            ${weatherData.hourly.time[index].slice(11, 16)}
          </div>

          <div class="icon">${forecastIcon}</div>

          <div class="degrees">
            ${number(weatherData.hourly.temperature_2m[index])}°
          </div>

          <div class="rain">
            💧 ${number(
              weatherData.hourly.precipitation_probability[index]
            )}%
          </div>
        </div>
      `;
    }

    $("hourlyForecast").innerHTML = forecastHtml;

    $("beachAdvice").innerHTML = beachAdvice(
      current.wind_gusts_10m,
      marine.wave_height || 0,
      weatherData.daily.uv_index_max[0],
      current.weather_code
    );

    $("status").classList.add("online");

    $("updated").textContent =
      `bijgewerkt ${new Date().toLocaleTimeString("nl-NL", {
        hour: "2-digit",
        minute: "2-digit"
      })}`;

  } catch (error) {
    console.error("Dashboardfout:", error);

    $("condition").textContent =
      "Live gegevens tijdelijk niet beschikbaar";

    $("updated").textContent =
      "geen live verbinding";

    $("status").classList.remove("online");
  }
}

updateClock();
setInterval(updateClock, 1000);

loadDashboard();
setInterval(loadDashboard, 300000);
