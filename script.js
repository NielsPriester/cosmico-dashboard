"use strict";

/* COSMICO BEACH DASHBOARD 3.2.2 — versterkte strandveiligheid en tv-weergave */
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
    "&hourly=sea_surface_temperature,sea_level_height_msl,wave_height,wave_direction,wave_period" +
    "&timezone=Europe%2FAmsterdam&forecast_days=2",
  beachPostsUrl:
    "https://dashboard.strand-app.nl/api/beachposts/v1/overview?municipality=zandvoort",
  refreshMs: 10 * 60 * 1000,
  retryMs: 60 * 1000,
  requestTimeoutMs: 12 * 1000,
  hardReloadMs: 6 * 60 * 60 * 1000,
  cacheKey: "cosmico-dashboard-320-cache",
  dawnDuskWindowMs: 45 * 60 * 1000
};

document.documentElement.dataset.motion = "on";
const $ = (id) => document.getElementById(id);
let refreshTimer = null;
let beachFailureCount = 0;
let beachNextAttemptAt = 0;

/* Houdt de meest recente zon- en weerinfo bij zodat het dag/nacht-thema
   ook tussen twee databeurten door kan bijwerken (elke klok-tick). */
const sky = { sunrise: null, sunset: null, sunriseNext: null, weatherCode: null, theme: null, isNight: false };

function setMode() {
  const requested = (new URLSearchParams(window.location.search).get("mode") || "").toLowerCase();
  let mode = requested;
  if (!["tv", "laptop", "mobile", "web", "advice"].includes(mode)) {
    if (window.innerWidth <= 700) mode = "mobile";
    else if (window.innerWidth >= 1500 && window.innerHeight >= 800) mode = "tv";
    else mode = "laptop";
  }
  document.documentElement.dataset.mode = mode;
  setText("modeName", mode.toUpperCase());
}

function setText(id, value, fallback = "—") {
  const node = $(id);
  if (node) node.textContent = value === undefined || value === null || value === "" ? fallback : value;
}

function numberText(value, decimals = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(decimals) : "—";
}

function signedNumberText(value, decimals = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number >= 0 ? "+" : ""}${number.toFixed(decimals)}`;
}

function formatClock(date) {
  return date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function formatApiTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : formatClock(date);
}

/* ---------- Dag/nacht thema ---------- */

function computeThemeState(sunriseIso, sunsetIso, now = Date.now()) {
  const sunrise = sunriseIso ? new Date(sunriseIso).getTime() : null;
  const sunset = sunsetIso ? new Date(sunsetIso).getTime() : null;
  const w = CONFIG.dawnDuskWindowMs;

  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) {
    // Geen zongegevens beschikbaar: ruwe schatting op basis van lokale klok.
    const hour = new Date(now).getHours();
    if (hour < 6 || hour >= 21) return { theme: "night", isNight: true };
    if (hour < 8) return { theme: "dawn", isNight: false };
    if (hour >= 19) return { theme: "dusk", isNight: false };
    return { theme: "day", isNight: false };
  }

  if (now < sunrise - w) return { theme: "night", isNight: true };
  if (now < sunrise + w) return { theme: "dawn", isNight: false };
  if (now < sunset - w) return { theme: "day", isNight: false };
  if (now < sunset + w) return { theme: "dusk", isNight: false };
  return { theme: "night", isNight: true };
}

function weatherInfo(code, isNight = false) {
  const map = {
    0: ["Onbewolkt", "☀️"], 1: ["Vrij zonnig", "🌤️"], 2: ["Halfbewolkt", "⛅"], 3: ["Bewolkt", "☁️"],
    45: ["Mist", "🌫️"], 48: ["Rijpmist", "🌫️"], 51: ["Lichte motregen", "🌦️"], 53: ["Motregen", "🌦️"],
    55: ["Stevige motregen", "🌧️"], 61: ["Lichte regen", "🌦️"], 63: ["Regen", "🌧️"], 65: ["Zware regen", "🌧️"],
    71: ["Lichte sneeuw", "🌨️"], 73: ["Sneeuw", "🌨️"], 75: ["Zware sneeuw", "❄️"],
    80: ["Lichte buien", "🌦️"], 81: ["Buien", "🌧️"], 82: ["Zware buien", "⛈️"],
    95: ["Onweer", "⛈️"], 96: ["Onweer met hagel", "⛈️"], 99: ["Zwaar onweer", "⛈️"]
  };
  const [description, icon] = map[Number(code)] || ["Wisselend", "🌤️"];
  if (isNight) {
    if (Number(code) === 0) return ["Helder", "🌙"];
    if (Number(code) === 1) return ["Licht bewolkt", "🌙"];
    if (Number(code) === 2) return ["Halfbewolkt", "🌥️"];
  }
  return [description, icon];
}

function applyTheme() {
  const result = computeThemeState(sky.sunrise, sky.sunset);
  if (result.theme !== sky.theme) {
    document.documentElement.dataset.theme = result.theme;
    sky.theme = result.theme;
  }
  if (result.isNight !== sky.isNight) {
    sky.isNight = result.isNight;
    if (sky.weatherCode !== null) {
      const [description, icon] = weatherInfo(sky.weatherCode, sky.isNight);
      setText("weatherIcon", icon);
      setText("headerWeatherIcon", icon);
      setText("condition", description);
      setText("headerCondition", description);
  setText("webWeatherIcon", icon);
  setText("webTemperature", `${numberText(current.temperature_2m)}°`);
  setText("webCondition", description);
    }
    updateSunCard();
  }
}

function updateSunCard() {
  if (sky.isNight) {
    setText("sunLabel", "Zonsopgang");
    setText("sunIcon", "🌄", "🌄");
    setText("sunset", sky.sunriseNext ? formatApiTime(sky.sunriseNext) : formatApiTime(sky.sunset));
  } else {
    setText("sunLabel", "Zonsondergang");
    setText("sunIcon", "🌅", "🌅");
    setText("sunset", formatApiTime(sky.sunset));
  }
}

function updateClock() {
  const now = new Date();
  setText("clockTime", formatClock(now));
  setText("clockDate", now.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }));
  applyTheme();
}

function compassDirection(degrees) {
  const value = Number(degrees);
  if (!Number.isFinite(value)) return "—";
  const labels = ["N","NNO","NO","ONO","O","OZO","ZO","ZZO","Z","ZZW","ZW","WZW","W","WNW","NW","NNW"];
  return labels[Math.round((((value % 360) + 360) % 360) / 22.5) % 16];
}

function setWindArrow(degrees) {
  const arrow = $("windArrow");
  if (!arrow) return;
  const value = Number(degrees);
  // De arrow wijst de richting op waar de wind naartoe waait (bron + 180°).
  const rotation = Number.isFinite(value) ? (value + 180) % 360 : 0;
  arrow.style.setProperty("--wind-deg", `${rotation}deg`);
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
    const response = await fetch(url, { cache: "no-store", credentials: "omit", signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      const retryAfter = response.headers.get("Retry-After");
      if (retryAfter) {
        const seconds = Number(retryAfter);
        error.retryAfterMs = Number.isFinite(seconds) ? seconds * 1000 : Math.max(0, new Date(retryAfter).getTime() - Date.now());
      }
      throw error;
    }
    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

function nearestHourlyIndex(hourly) {
  if (!Array.isArray(hourly?.time)) return -1;
  const now = Date.now();
  let bestIndex = 0;
  let distance = Infinity;
  hourly.time.forEach((value, index) => {
    const currentDistance = Math.abs(new Date(value).getTime() - now);
    if (currentDistance < distance) { distance = currentDistance; bestIndex = index; }
  });
  return bestIndex;
}

function nearestHourlyValue(hourly, field) {
  const index = nearestHourlyIndex(hourly);
  return index >= 0 && Array.isArray(hourly?.[field]) ? hourly[field][index] : null;
}

function renderHourly(hourly) {
  const container = $("hourlyForecast");
  if (!container || !Array.isArray(hourly?.time)) return;
  const now = new Date();
  let start = hourly.time.findIndex((value) => new Date(value) >= now);
  if (start < 0) start = 0;
  const cards = [];
  for (let i = start; i < Math.min(start + 6, hourly.time.length); i += 1) {
    const [, icon] = weatherInfo(hourly.weather_code?.[i], sky.isNight && i === start);
    const nowClass = i === start ? " is-now" : "";
    cards.push(`<div class="hour${nowClass}"><span class="time">${formatClock(new Date(hourly.time[i]))}</span><span class="icon">${icon}</span><strong class="degrees">${numberText(hourly.temperature_2m?.[i])}°</strong><span class="rain">💧 ${numberText(hourly.precipitation_probability?.[i])}%</span></div>`);
  }
  container.innerHTML = cards.join("");
}

function renderTideSpark(times, levels, windowStart, windowEnd, nowIndex) {
  const line = $("tideSparkLine");
  const dot = $("tideSparkNow");
  if (!line || !dot) return;
  const slice = levels.slice(windowStart, windowEnd).map(Number).filter(Number.isFinite);
  if (slice.length < 2) { line.setAttribute("points", ""); return; }

  const min = Math.min(...slice);
  const max = Math.max(...slice);
  const span = Math.max(max - min, 0.05);
  const count = windowEnd - windowStart;
  const padY = 3;
  const usableH = 34 - padY * 2;

  const points = [];
  for (let i = windowStart; i < windowEnd; i += 1) {
    const value = Number(levels[i]);
    const x = ((i - windowStart) / (count - 1)) * 120;
    const y = Number.isFinite(value) ? padY + (1 - (value - min) / span) * usableH : 17;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  line.setAttribute("points", points.join(" "));

  const relativeNow = Math.min(Math.max(nowIndex - windowStart, 0), count - 1);
  const nowValue = Number(levels[windowStart + relativeNow]);
  const nowX = (relativeNow / (count - 1)) * 120;
  const nowY = Number.isFinite(nowValue) ? padY + (1 - (nowValue - min) / span) * usableH : 17;
  dot.setAttribute("cx", nowX.toFixed(1));
  dot.setAttribute("cy", nowY.toFixed(1));
}

function renderTide(hourly) {
  const times = hourly?.time;
  const levels = hourly?.sea_level_height_msl;
  if (!Array.isArray(times) || !Array.isArray(levels) || times.length < 4) {
    setText("tideState", "Model tijdelijk niet beschikbaar");
    setText("tideHeight", "Stand -- m");
    setText("nextHighTide", "--:--");
    setText("nextLowTide", "--:--");
    const line = $("tideSparkLine");
    if (line) line.setAttribute("points", "");
    return;
  }

  const now = Date.now();
  let nearest = nearestHourlyIndex(hourly);
  nearest = Math.max(1, Math.min(nearest, levels.length - 2));
  const current = Number(levels[nearest]);
  const previous = Number(levels[nearest - 1]);
  const next = Number(levels[nearest + 1]);
  const delta = next - previous;
  const state = delta > 0.025 ? "Opkomend water" : delta < -0.025 ? "Afgaand water" : "Kentering rond hoog/laag water";

  let nextHigh = null;
  let nextLow = null;
  for (let i = Math.max(1, nearest); i < levels.length - 1; i += 1) {
    const time = new Date(times[i]).getTime();
    if (time < now - 60 * 60 * 1000) continue;
    const a = Number(levels[i - 1]);
    const b = Number(levels[i]);
    const c = Number(levels[i + 1]);
    if (!nextHigh && b >= a && b > c) nextHigh = new Date(times[i]);
    if (!nextLow && b <= a && b < c) nextLow = new Date(times[i]);
    if (nextHigh && nextLow) break;
  }

  setText("tideState", state);
  setText("tideHeight", `Stand ${signedNumberText(current, 2)} m`);
  setText("nextHighTide", nextHigh ? formatClock(nextHigh) : "--:--");
  setText("nextLowTide", nextLow ? formatClock(nextLow) : "--:--");

  const windowStart = Math.max(0, nearest - 8);
  const windowEnd = Math.min(levels.length, windowStart + 24);
  renderTideSpark(times, levels, windowStart, windowEnd, nearest);
}

function findPost(posts, terms) {
  return posts.find((post) => {
    const name = String(post?.name || "").toLowerCase();
    return terms.some((term) => name.includes(term));
  });
}

function rescueSeverity(post, active) {
  const text = [
    post?.flag_text,
    post?.flag_extended_text,
    post?.state_text,
    post?.state
  ].filter(Boolean).join(" ").toLowerCase();

  if (
    text.includes("verboden") ||
    text.includes("niet zwemmen") ||
    text.includes("zeer gevaarlijk") ||
    text.includes("rode vlag") ||
    text.includes("red flag")
  ) {
    return "danger";
  }

  if (
    post?.flag_status === true ||
    text.includes("waarschuwing") ||
    text.includes("gevaarlijk") ||
    text.includes("gele vlag") ||
    text.includes("oranje vlag") ||
    text.includes("warning")
  ) {
    return "warning";
  }

  return active ? "guarded" : "off";
}

function rescueIcon(severity, active) {
  if (severity === "danger") return "⛔";
  if (severity === "warning") return "⚠";
  if (active) return "🛟";
  return "◼";
}

function compactFlagText(post) {
  const text = String(post?.flag_text || "").trim();

  if (!text) {
    return post?.flag_status ? "Waarschuwing actief" : "Geen actieve waarschuwing";
  }

  return text
    .replace(/^let op[!:\s-]*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderFlag(post, severity) {
  if (!post?.flag_status) {
    return `
      <div class="safety-message safety-message-clear">
        <span class="safety-mini-icon">✓</span>
        <div>
          <strong>Geen actieve waarschuwing</strong>
          <span>Controleer altijd de vlaggen ter plaatse.</span>
        </div>
      </div>
    `;
  }

  const image = post.flag_img_no_text || post.flag_img || "";
  const text = compactFlagText(post);
  const extended = post.flag_extended_text || "";

  return `
    <div class="safety-message safety-message-${severity}">
      ${
        image
          ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(text)}">`
          : `<span class="safety-mini-icon">${severity === "danger" ? "⛔" : "⚠"}</span>`
      }
      <div>
        <strong>${escapeHtml(text)}</strong>
        ${extended ? `<span>${escapeHtml(extended)}</span>` : ""}
      </div>
    </div>
  `;
}

function renderRescuePost(post, label) {
  if (!post) {
    return `
      <article class="rescue-post safety-unknown">
        <div class="rescue-copy">
          <div class="rescue-post-top">
            <h3>${escapeHtml(label)}</h3>
            <div class="lifeguard-status status-unknown">
              <span class="status-light"></span>
              STATUS ONBEKEND
            </div>
          </div>

          <p class="rescue-state">De actuele status kon niet worden opgehaald.</p>

          <div class="safety-message safety-message-clear">
            <span class="safety-mini-icon">?</span>
            <div>
              <strong>Controleer ter plaatse</strong>
              <span>Volg de actuele vlaggen en aanwijzingen.</span>
            </div>
          </div>
        </div>

        <div class="rescue-symbol" aria-hidden="true">
          <span>?</span>
          <strong>ONBEKEND</strong>
        </div>
      </article>
    `;
  }

  const active = post.state_status === true;
  const severity = rescueSeverity(post, active);
  const stateText =
    post.state_text ||
    post.state ||
    (active
      ? "Lifeguards houden toezicht."
      : "Geen toezicht. Zwemmen op eigen risico.");

  const statusText = active ? "BEWAAKT" : "GEEN TOEZICHT";
  const symbolText =
    severity === "danger"
      ? "NIET ZWEMMEN"
      : severity === "warning"
        ? "WAARSCHUWING"
        : active
          ? "LIFEGUARD"
          : "EIGEN RISICO";

  return `
    <article class="rescue-post safety-${severity}">
      <div class="rescue-copy">
        <div class="rescue-post-top">
          <h3>${escapeHtml(label)}</h3>

          <div class="lifeguard-status status-${active ? "guarded" : "off"}">
            <span class="status-light ${active ? "on" : "off"}"></span>
            ${statusText}
          </div>
        </div>

        <p class="rescue-state">${escapeHtml(stateText)}</p>
        ${renderFlag(post, severity)}
      </div>

      <div class="rescue-symbol" aria-hidden="true">
        <span>${rescueIcon(severity, active)}</span>
        <strong>${symbolText}</strong>
      </div>
    </article>
  `;
}

function renderRescuePosts(posts) {
  const container = $("rescuePosts");
  if (!container) return;

  const north =
    findPost(posts, ["zvt noord", "zandvoort noord"]) ||
    findPost(posts, ["noord"]);

  const south =
    findPost(posts, ["zvt zuid", "zandvoort zuid"]) ||
    findPost(posts, ["zuid"]);

  container.innerHTML =
    renderRescuePost(north, "▲ NOORD") +
    renderRescuePost(south, "▼ ZUID");
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
  else if (sky.isNight) parts.push("Rustig aan het strand vanavond.");
  else if (temperature >= 22) parts.push("Heerlijk strandweer.");
  else if (temperature < 16) parts.push("Het is fris aan zee.");
  else parts.push("Prima weer voor een bezoek aan het strand.");
  if (wind >= 40 || gusts >= 55) parts.push("Veel wind: zet losse spullen goed vast.");
  else if (wind >= 25) parts.push("Er staat een stevige zeewind.");
  if (wave >= 1.5) parts.push("Stevige golven: wees extra voorzichtig in zee.");
  else if (wave >= .8) parts.push("Houd rekening met merkbare golfslag.");
  if (!sky.isNight && uvIndex >= 6) parts.push("UV is hoog, dus goed en regelmatig insmeren.");
  else if (!sky.isNight && uvIndex >= 3) parts.push("Bescherm je huid tegen de zon.");
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
  try { return JSON.parse(localStorage.getItem(CONFIG.cacheKey) || "null")?.data || null; } catch (_) { return null; }
}


function updateWebGuardStatus(posts) {
  const north = findPost(posts, ["zvt noord", "zandvoort noord", "noord"]);
  const south = findPost(posts, ["zvt zuid", "zandvoort zuid", "zuid"]);
  const available = [north, south].filter(Boolean);
  const guarded = available.filter((post) => post.state_status === true).length;
  const node = $("webGuardStatus");
  if (!node) return;

  node.classList.remove("is-guarded", "is-off", "is-unknown");
  if (!available.length) {
    node.textContent = "Status onbekend";
    node.classList.add("is-unknown");
  } else if (guarded === available.length) {
    node.textContent = "Bewaakt";
    node.classList.add("is-guarded");
  } else if (guarded > 0) {
    node.textContent = "Deels bewaakt";
    node.classList.add("is-guarded");
  } else {
    node.textContent = "Geen toezicht";
    node.classList.add("is-off");
  }
}

function applyData(weatherData, marineData, posts, fromCache = false) {
  const current = weatherData?.current || {};
  const daily = weatherData?.daily || {};
  const marine = marineData?.current || {};
  const marineHourly = marineData?.hourly || {};
  const uv = daily.uv_index_max?.[0];

  sky.sunrise = daily.sunrise?.[0] || sky.sunrise;
  sky.sunset = daily.sunset?.[0] || sky.sunset;
  sky.sunriseNext = daily.sunrise?.[1] || sky.sunriseNext;
  sky.weatherCode = current.weather_code ?? sky.weatherCode;
  applyTheme();
  updateSunCard();

  const [description, icon] = weatherInfo(current.weather_code, sky.isNight);

  setText("weatherIcon", icon);
  setText("headerWeatherIcon", icon);
  setText("temperature", `${numberText(current.temperature_2m)}°`);
  setText("headerTemperature", `${numberText(current.temperature_2m)}°`);
  setText("condition", description);
  setText("headerCondition", description);
  setText("webWeatherIcon", icon);
  setText("webTemperature", `${numberText(current.temperature_2m)}°`);
  setText("webCondition", description);
  setText("feelsLike", `${numberText(current.apparent_temperature)}°C`);
  setText("wind", `${numberText(current.wind_speed_10m)} km/u ${compassDirection(current.wind_direction_10m)}`);
  setText("webWind", `${numberText(current.wind_speed_10m)} km/u ${compassDirection(current.wind_direction_10m)}`);
  setWindArrow(current.wind_direction_10m);
  setText("windGusts", `${numberText(current.wind_gusts_10m)} km/u`);
  setText("uvIndex", numberText(uv, 1));
  setText("precipitation", `${numberText(current.precipitation, 1)} mm`);

  const visibilityValue = Number(current.visibility);
  const visibilityUnit = String(weatherData?.current_units?.visibility || "m").toLowerCase();
  const visibilityKm = visibilityUnit === "km" ? visibilityValue : visibilityValue / 1000;
  setText("visibility", Number.isFinite(visibilityKm) ? `${visibilityKm.toFixed(0)} km` : "—");
  setText("humidity", `${numberText(current.relative_humidity_2m)}%`);

  setText("waveHeight", `${numberText(marine.wave_height, 1)} m`);
  setText("webWaveHeight", `${numberText(marine.wave_height, 1)} m`);
  setText("waveDirection", compassDirection(marine.wave_direction));
  setText("wavePeriod", `${numberText(marine.wave_period, 1)} sec`);
  setText("waterTemperature", `${numberText(nearestHourlyValue(marineHourly, "sea_surface_temperature"), 1)}°C`);
  setText("webWaterTemperature", `${numberText(nearestHourlyValue(marineHourly, "sea_surface_temperature"), 1)}°C`);
  renderTide(marineHourly);

  if (weatherData?.hourly) renderHourly(weatherData.hourly);
  renderRescuePosts(Array.isArray(posts) ? posts : []);
  updateWebGuardStatus(Array.isArray(posts) ? posts : []);
  const advice = buildAdvice(current, marine, uv);
  setText("beachAdvice", advice);
  setText("webAdvice", advice);
  setConnection(!fromCache, fromCache ? "Laatste opgeslagen gegevens" : `Bijgewerkt ${formatClock(new Date())}`);
}

async function loadBeachPosts() {
  if (Date.now() < beachNextAttemptAt) {
    const error = new Error("Strand App tijdelijk overgeslagen tijdens back-off");
    error.skipped = true;
    throw error;
  }
  try {
    const data = await fetchJson(CONFIG.beachPostsUrl);
    if (data?.getstrandposten !== "success" || !Array.isArray(data.strandposten)) throw new Error("Ongeldige Strand App-response");
    beachFailureCount = 0;
    beachNextAttemptAt = 0;
    return data.strandposten;
  } catch (error) {
    beachFailureCount += 1;
    const backoffMinutes = Math.min(60, 5 * (2 ** Math.max(0, beachFailureCount - 1)));
    const backoffMs = Number.isFinite(error.retryAfterMs) && error.retryAfterMs > 0 ? error.retryAfterMs : backoffMinutes * 60 * 1000;
    beachNextAttemptAt = Date.now() + backoffMs;
    throw error;
  }
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
    const combined = {
      weatherData: weatherData || cache.weatherData,
      marineData: marineData || cache.marineData,
      posts: posts || cache.posts || []
    };
    applyData(combined.weatherData, combined.marineData, combined.posts, loaded < 3);
    saveCache(combined);
    scheduleLoad((weatherData || marineData) ? CONFIG.refreshMs : CONFIG.retryMs);
  } else {
    const cache = loadCache();
    if (cache) applyData(cache.weatherData, cache.marineData, cache.posts, true);
    else {
      setConnection(false, "Live gegevens niet beschikbaar");
      const fallbackAdvice = "De live gegevens konden niet worden opgehaald. Volg de officiële informatie en aanwijzingen ter plaatse.";
      setText("beachAdvice", fallbackAdvice);
      setText("webAdvice", fallbackAdvice);
      renderRescuePosts([]);
      renderTide(null);
    }
    scheduleLoad(CONFIG.retryMs);
  }
}

setMode();
applyTheme();
updateClock();
window.setInterval(updateClock, 1000);
loadDashboard();
window.setTimeout(() => window.location.reload(), CONFIG.hardReloadMs);
window.addEventListener("resize", setMode);
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadDashboard(); });
