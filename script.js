"use strict";

/* COSMICO BEACH DASHBOARD 3.0.2 */
const CONFIG = {
  timezone: "Europe/Amsterdam",
  weatherUrl:
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=52.3765&longitude=4.5330" +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code," +
    "wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,visibility" +
    "&hourly=temperature_2m,weather_code,precipitation_probability" +
    "&daily=temperature_2m_max,uv_index_max,sunrise,sunset" +
    "&timezone=Europe%2FAmsterdam&forecast_days=2&wind_speed_unit=kmh",
  marineUrl:
    "https://marine-api.open-meteo.com/v1/marine" +
    "?latitude=52.39&longitude=4.45" +
    "&current=wave_height,wave_direction,wave_period" +
    "&hourly=sea_surface_temperature,wave_height,wave_direction,wave_period" +
    "&timezone=Europe%2FAmsterdam&forecast_days=2",
  beachPostsUrl:
    "https://dashboard.strand-app.nl/api/beachposts/v1/overview?municipality=zandvoort",
  refreshMs: 10 * 60 * 1000,
  retryMs: 60 * 1000,
  requestTimeoutMs: 12 * 1000,
  hardReloadMs: 6 * 60 * 60 * 1000,
  cacheKey: "cosmico-dashboard-302-cache"
};

document.documentElement.dataset.motion = "on";

const $ = (id) => document.getElementById(id);
let refreshTimer = null;

function setMode() {
  const params = new URLSearchParams(window.location.search);
  const requested = (params.get("mode") || "").toLowerCase();
  let mode = requested;

  if (!["tv", "laptop", "mobile"].includes(mode)) {
    if (window.innerWidth <= 700) mode = "mobile";
    else if (window.innerWidth >= 1500 && window.innerHeight >= 800) mode = "tv";
    else mode = "laptop";
  }

  document.documentElement.dataset.mode = mode;
  if ($("modeName")) $("modeName").textContent = mode.toUpperCase();
}

function setText(id, value, fallback = "—") {
  const node = $(id);
  if (node) node.textContent = value === undefined || value === null || value === "" ? fallback : value;
}

function numberText(value, decimals = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(decimals) : "—";
}

function formatClock(date) {
  return date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function updateClock() {
  const now = new Date();
  setText("clockTime", formatClock(now));
  setText("clockDate", now.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }));
}

function formatApiTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : formatClock(date);
}

function weatherInfo(code) {
  const map = {
    0: ["Onbewolkt", "☀️"], 1: ["Vrij zonnig", "🌤️"], 2: ["Halfbewolkt", "⛅"], 3: ["Bewolkt", "☁️"],
    45: ["Mist", "🌫️"], 48: ["Rijpmist", "🌫️"], 51: ["Lichte motregen", "🌦️"], 53: ["Motregen", "🌦️"],
    55: ["Stevige motregen", "🌧️"], 61: ["Lichte regen", "🌦️"], 63: ["Regen", "🌧️"], 65: ["Zware regen", "🌧️"],
    71: ["Lichte sneeuw", "🌨️"], 73: ["Sneeuw", "🌨️"], 75: ["Zware sneeuw", "❄️"],
    80: ["Lichte buien", "🌦️"], 81: ["Buien", "🌧️"], 82: ["Zware buien", "⛈️"],
    95: ["Onweer", "⛈️"], 96: ["Onweer met hagel", "⛈️"], 99: ["Zwaar onweer", "⛈️"]
  };
  return map[Number(code)] || ["Wisselend", "🌤️"];
}

function compassDirection(degrees) {
  const value = Number(degrees);
  if (!Number.isFinite(value)) return "—";
  const labels = ["N", "NNO", "NO", "ONO", "O", "OZO", "ZO", "ZZO", "Z", "ZZW", "ZW", "WZW", "W", "WNW", "NW", "NNW"];
  return labels[Math.round((((value % 360) + 360) % 360) / 22.5) % 16];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function fetchJson(url, timeoutMs = CONFIG.requestTimeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      const retryAfter = response.headers.get("Retry-After");
      if (retryAfter) {
        const seconds = Number(retryAfter);
        error.retryAfterMs = Number.isFinite(seconds)
          ? seconds * 1000
          : Math.max(0, new Date(retryAfter).getTime() - Date.now());
      }
      throw error;
    }
    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

function nearestHourlyValue(hourly, field) {
  if (!Array.isArray(hourly?.time) || !Array.isArray(hourly?.[field])) return null;
  const now = Date.now();
  let best = 0;
  let distance = Infinity;
  hourly.time.forEach((value, index) => {
    const currentDistance = Math.abs(new Date(value).getTime() - now);
    if (currentDistance < distance) { distance = currentDistance; best = index; }
  });
  return hourly[field][best];
}

function renderHourly(hourly) {
  const container = $("hourlyForecast");
  if (!container || !Array.isArray(hourly?.time)) return;
  const now = new Date();
  let start = hourly.time.findIndex((value) => new Date(value) >= now);
  if (start < 0) start = 0;
  const cards = [];
  for (let i = start; i < Math.min(start + 6, hourly.time.length); i += 1) {
    const [, icon] = weatherInfo(hourly.weather_code?.[i]);
    cards.push(`
      <div class="hour">
        <span class="time">${formatClock(new Date(hourly.time[i]))}</span>
        <span class="icon">${icon}</span>
        <strong class="degrees">${numberText(hourly.temperature_2m?.[i])}°</strong>
        <span class="rain">💧 ${numberText(hourly.precipitation_probability?.[i])}%</span>
      </div>`);
  }
  container.innerHTML = cards.join("");
}

function findPost(posts, terms) {
  return posts.find((post) => {
    const name = String(post?.name || "").toLowerCase();
    return terms.some((term) => name.includes(term));
  });
}

function renderFlag(post) {
  if (!post?.flag_status) return '<div class="no-flag">Geen actieve waarschuwingsvlag gemeld.</div>';
  const image = post.flag_img_no_text || post.flag_img || "";
  const text = post.flag_text || "Waarschuwingsvlag actief";
  const extended = post.flag_extended_text || "";
  return `
    <div class="flag-block">
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(text)}">` : "<span>🚩</span>"}
      <div><strong>${escapeHtml(text)}</strong>${extended ? `<span>${escapeHtml(extended)}</span>` : ""}</div>
    </div>`;
}

function renderRescuePost(post, fallbackName) {
  if (!post) {
    return `<article class="rescue-post"><div class="rescue-post-top"><h3>${fallbackName}</h3><div class="lifeguard-status"><span class="status-light"></span>Status onbekend</div></div><p class="rescue-state">De actuele status kon niet worden opgehaald.</p><div class="no-flag">Controleer de vlaggen en aanwijzingen ter plaatse.</div></article>`;
  }
  const active = post.state_status === true;
  const stateText = post.state_text || post.state || (active ? "Lifeguards houden toezicht." : "Geen toezicht. Zwemmen op eigen risico.");
  return `
    <article class="rescue-post">
      <div class="rescue-post-top">
        <h3>${escapeHtml(post.name || fallbackName)}</h3>
        <div class="lifeguard-status"><span class="status-light ${active ? "on" : "off"}"></span>${active ? "Lifeguards aanwezig" : "Geen toezicht"}</div>
      </div>
      <p class="rescue-state">${escapeHtml(stateText)}</p>
      ${renderFlag(post)}
    </article>`;
}

function renderRescuePosts(posts) {
  const container = $("rescuePosts");
  if (!container) return;
  const north = findPost(posts, ["zvt noord", "zandvoort noord"]) || findPost(posts, ["noord"]);
  const south = findPost(posts, ["zvt zuid", "zandvoort zuid"]) || findPost(posts, ["zuid"]);
  container.innerHTML = renderRescuePost(north, "Reddingspost ZVT Noord") + renderRescuePost(south, "Reddingspost ZVT Zuid");
}

function buildAdvice(weather, marine, uv) {
  const temperature = Number(weather.temperature_2m);
  const wind = Number(weather.wind_speed_10m);
  const gusts = Number(weather.wind_gusts_10m);
  const wave = Number(marine.wave_height);
  const uvIndex = Number(uv);
  const code = Number(weather.weather_code);
  const parts = [];

  if (code >= 95) parts.push("Bij onweer direct het strand en het water verlaten.");
  else if ([61,63,65,80,81,82].includes(code)) parts.push("Houd rekening met regen of buien.");
  else if (temperature >= 22) parts.push("Heerlijk strandweer.");
  else if (temperature < 16) parts.push("Het is fris aan zee.");
  else parts.push("Prima weer voor een bezoek aan het strand.");

  if (wind >= 40 || gusts >= 55) parts.push("Veel wind: zet losse spullen goed vast.");
  else if (wind >= 25) parts.push("Er staat een stevige zeewind.");

  if (wave >= 1.5) parts.push("Stevige golven: wees extra voorzichtig in zee.");
  else if (wave >= .8) parts.push("Houd rekening met merkbare golfslag.");

  if (uvIndex >= 6) parts.push("UV is hoog, dus goed en regelmatig insmeren.");
  else if (uvIndex >= 3) parts.push("Bescherm je huid tegen de zon.");

  return parts.slice(0, 3).concat("De officiële vlaggen en aanwijzingen zijn altijd leidend.").join(" ");
}

function setConnection(online, text) {
  const wrapper = $("connectionState");
  if (wrapper) wrapper.classList.toggle("online", online);
  setText("connectionText", text);
}

function saveCache(data) {
  try { localStorage.setItem(CONFIG.cacheKey, JSON.stringify({ savedAt: Date.now(), data })); } catch (_) { /* opslag niet beschikbaar */ }
}

function loadCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG.cacheKey) || "null");
    return parsed?.data || null;
  } catch (_) { return null; }
}

function applyData(weatherData, marineData, posts, fromCache = false) {
  const current = weatherData?.current || {};
  const daily = weatherData?.daily || {};
  const marine = marineData?.current || {};
  const marineHourly = marineData?.hourly || {};
  const uv = daily.uv_index_max?.[0];
  const [description, icon] = weatherInfo(current.weather_code);

  setText("weatherIcon", icon);
  setText("headerWeatherIcon", icon);
  setText("temperature", `${numberText(current.temperature_2m)}°`);
  setText("headerTemperature", `${numberText(current.temperature_2m)}°`);
  setText("condition", description);
  setText("headerCondition", description);
  setText("feelsLike", `${numberText(current.apparent_temperature)}°C`);
  setText("wind", `${numberText(current.wind_speed_10m)} km/u`);
  setText("windGusts", `${numberText(current.wind_gusts_10m)} km/u`);
  setText("uvIndex", numberText(uv, 1));
  setText("precipitation", `${numberText(current.precipitation, 1)} mm`);
  const visibilityValue = Number(current.visibility);
  const visibilityUnit = String(weatherData?.current_units?.visibility || "m").toLowerCase();
  const visibilityKm = visibilityUnit === "km" ? visibilityValue : visibilityValue / 1000;
  setText("visibility", Number.isFinite(visibilityKm) ? `${visibilityKm.toFixed(0)} km` : "—");
  setText("humidity", `${numberText(current.relative_humidity_2m)}%`);
  setText("sunset", formatApiTime(daily.sunset?.[0]));
  setText("dayMaximum", `${numberText(daily.temperature_2m_max?.[0])}°C`);
  setText("windDirection", compassDirection(current.wind_direction_10m));

  const compass = document.querySelector(".wind-compass");
  if (compass && Number.isFinite(Number(current.wind_direction_10m))) compass.style.setProperty("--wind-rotation", `${Number(current.wind_direction_10m)}deg`);

  setText("waveHeight", `${numberText(marine.wave_height, 1)} m`);
  setText("waveDirection", compassDirection(marine.wave_direction));
  setText("wavePeriod", `${numberText(marine.wave_period, 1)} sec`);
  setText("waterTemperature", `${numberText(nearestHourlyValue(marineHourly, "sea_surface_temperature"), 1)}°C`);

  if (weatherData?.hourly) renderHourly(weatherData.hourly);
  renderRescuePosts(Array.isArray(posts) ? posts : []);
  setText("beachAdvice", buildAdvice(current, marine, uv));
  setConnection(!fromCache, fromCache ? "Laatste opgeslagen gegevens" : `Bijgewerkt ${formatClock(new Date())}`);
}

async function loadBeachPosts() {
  const data = await fetchJson(CONFIG.beachPostsUrl);
  if (data?.getstrandposten !== "success" || !Array.isArray(data.strandposten)) throw new Error("Ongeldige Strand App-response");
  return data.strandposten;
}

function scheduleLoad(delay) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(loadDashboard, delay);
}

async function loadDashboard() {
  setConnection(false, "Gegevens laden…");
  const results = await Promise.allSettled([fetchJson(CONFIG.weatherUrl), fetchJson(CONFIG.marineUrl), loadBeachPosts()]);
  const weatherData = results[0].status === "fulfilled" ? results[0].value : null;
  const marineData = results[1].status === "fulfilled" ? results[1].value : null;
  const posts = results[2].status === "fulfilled" ? results[2].value : null;
  const loaded = [weatherData, marineData, posts].filter(Boolean).length;

  if (weatherData || marineData || posts) {
    const cache = loadCache() || {};
    const combined = { weatherData: weatherData || cache.weatherData, marineData: marineData || cache.marineData, posts: posts || cache.posts || [] };
    applyData(combined.weatherData, combined.marineData, combined.posts, loaded < 3);
    saveCache(combined);
    // Een storing van alleen de Strand App mag Open-Meteo niet iedere minuut opnieuw belasten.
    const coreSourcesAvailable = Boolean(weatherData || marineData);
    scheduleLoad(coreSourcesAvailable ? CONFIG.refreshMs : CONFIG.retryMs);
  } else {
    const cache = loadCache();
    if (cache) applyData(cache.weatherData, cache.marineData, cache.posts, true);
    else {
      setConnection(false, "Live gegevens niet beschikbaar");
      setText("beachAdvice", "De live gegevens konden niet worden opgehaald. Volg de officiële informatie en aanwijzingen ter plaatse.");
      renderRescuePosts([]);
    }
    scheduleLoad(CONFIG.retryMs);
  }
}

setMode();
updateClock();
window.setInterval(updateClock, 1000);
loadDashboard();
window.setTimeout(() => window.location.reload(), CONFIG.hardReloadMs);
window.addEventListener("resize", setMode);
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadDashboard(); });
