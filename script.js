"use strict";

/*
  COSMICO BEACH DASHBOARD

  Live dashboard voor Cosmico Beach.
  Gebruikt Open-Meteo en de productie-API van Strand App.
*/

const CONFIG = {
  latitude: 52.374,
  longitude: 4.525,
  timezone: "Europe/Amsterdam",

  weatherUrl:
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=52.374" +
    "&longitude=4.525" +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m," +
    "weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m," +
    "precipitation,visibility" +
    "&hourly=temperature_2m,weather_code,precipitation_probability" +
    "&daily=uv_index_max,sunrise,sunset" +
    "&timezone=Europe%2FAmsterdam" +
    "&forecast_days=2",

  marineUrl:
    "https://marine-api.open-meteo.com/v1/marine" +
    "?latitude=52.39" +
    "&longitude=4.45" +
    "&current=wave_height,wave_direction,wave_period," +
    "sea_surface_temperature,sea_level_height_msl" +
    "&minutely_15=sea_level_height_msl" +
    "&forecast_minutely_15=192" +
    "&timezone=Europe%2FAmsterdam",

  beachPostsUrl:
    "https://dashboard.strand-app.nl/api/beachposts/v1/overview" +
    "?municipality=zandvoort",

  dataRefreshMs: 10 * 60 * 1000,
  retryDelayMs: 60 * 1000,
  requestTimeoutMs: 15 * 1000,
  slideDurationMs: 20 * 1000
};

/*
  Voeg later promo's toe als extra objecten in deze lijst.

  Voorbeeld afbeelding:
  {
    type: "image",
    title: "Cocktail special",
    badge: "SPECIAL",
    src: "assets/aperol.jpg",
    alt: "Aperol Spritz special"
  }

  Voorbeeld video:
  {
    type: "video",
    title: "Sunset Session",
    badge: "VANAVOND",
    src: "assets/sunset-session.mp4"
  }
*/
const MEDIA_SLIDES = [
  {
    type: "youtube",
    title: "Live vanuit Zandvoort",
    badge: "LIVE",
    videoId: "q0-DDh1zdY4"
  }
];

let activeSlideIndex = 0;
let slideTimer = null;

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value, fallback = "—") {
  const element = byId(id);

  if (!element) {
    return;
  }

  const text =
    value === undefined || value === null || value === ""
      ? fallback
      : value;

  element.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numberText(value, decimals = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(decimals)
    : "—";
}

function formatClockTime(date) {
  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatApiTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : formatClockTime(date);
}

function updateClock() {
  const now = new Date();

  setText("clockTime", formatClockTime(now));

  setText(
    "clockDate",
    now.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long"
    })
  );
}

function weatherInfo(code) {
  const map = {
    0: ["Onbewolkt", "☀️"],
    1: ["Vrij zonnig", "🌤️"],
    2: ["Halfbewolkt", "⛅"],
    3: ["Bewolkt", "☁️"],
    45: ["Mist", "🌫️"],
    48: ["Rijpmist", "🌫️"],
    51: ["Lichte motregen", "🌦️"],
    53: ["Motregen", "🌦️"],
    55: ["Stevige motregen", "🌧️"],
    61: ["Lichte regen", "🌦️"],
    63: ["Regen", "🌧️"],
    65: ["Zware regen", "🌧️"],
    71: ["Lichte sneeuw", "🌨️"],
    73: ["Sneeuw", "🌨️"],
    75: ["Zware sneeuw", "❄️"],
    80: ["Lichte buien", "🌦️"],
    81: ["Buien", "🌧️"],
    82: ["Zware buien", "⛈️"],
    95: ["Onweer", "⛈️"],
    96: ["Onweer met hagel", "⛈️"],
    99: ["Zwaar onweer", "⛈️"]
  };

  return map[Number(code)] || ["Onbekend", "🌤️"];
}

function compassDirection(degrees) {
  const value = Number(degrees);

  if (!Number.isFinite(value)) {
    return "—";
  }

  const labels = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"];
  return labels[Math.round(value / 45) % 8];
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    CONFIG.requestTimeoutMs
  );

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildMediaSlide(slide, index) {
  const activeClass = index === 0 ? " active" : "";

  if (slide.type === "youtube") {
    const src =
      `https://www.youtube.com/embed/${encodeURIComponent(slide.videoId)}` +
      "?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1";

    return `
      <div class="media-slide${activeClass}" data-slide-index="${index}">
        <iframe
          src="${src}"
          title="${escapeHtml(slide.title)}"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    `;
  }

  if (slide.type === "image") {
    return `
      <div class="media-slide${activeClass}" data-slide-index="${index}">
        <img src="${escapeHtml(slide.src)}" alt="${escapeHtml(slide.alt || slide.title)}">
      </div>
    `;
  }

  if (slide.type === "video") {
    return `
      <div class="media-slide${activeClass}" data-slide-index="${index}">
        <video autoplay muted loop playsinline>
          <source src="${escapeHtml(slide.src)}">
        </video>
      </div>
    `;
  }

  return `
    <div class="media-slide${activeClass}" data-slide-index="${index}">
      <div class="promo-slide">
        <small>${escapeHtml(slide.kicker || "COSMICO BEACH")}</small>
        <strong>${escapeHtml(slide.title || "Vandaag bij Cosmico")}</strong>
        <p>${escapeHtml(slide.text || "")}</p>
      </div>
    </div>
  `;
}

function initMediaSlider() {
  const slider = byId("mediaSlider");
  const dots = byId("slideDots");

  if (!slider || !dots || MEDIA_SLIDES.length === 0) {
    return;
  }

  slider.innerHTML = MEDIA_SLIDES.map(buildMediaSlide).join("");

  dots.innerHTML = MEDIA_SLIDES.map((_, index) => `
    <button
      class="slide-dot${index === 0 ? " active" : ""}"
      data-dot-index="${index}"
      aria-label="Ga naar slide ${index + 1}"
    ></button>
  `).join("");

  dots.querySelectorAll(".slide-dot").forEach((button) => {
    button.addEventListener("click", () => {
      showSlide(Number(button.dataset.dotIndex));
      restartSlideTimer();
    });
  });

  showSlide(0);
  restartSlideTimer();
}

function showSlide(index) {
  if (MEDIA_SLIDES.length === 0) {
    return;
  }

  activeSlideIndex =
    ((index % MEDIA_SLIDES.length) + MEDIA_SLIDES.length) %
    MEDIA_SLIDES.length;

  document.querySelectorAll(".media-slide").forEach((slide) => {
    slide.classList.toggle(
      "active",
      Number(slide.dataset.slideIndex) === activeSlideIndex
    );
  });

  document.querySelectorAll(".slide-dot").forEach((dot) => {
    dot.classList.toggle(
      "active",
      Number(dot.dataset.dotIndex) === activeSlideIndex
    );
  });

  const current = MEDIA_SLIDES[activeSlideIndex];
  setText("mediaTitle", current.title);
  setText("mediaBadge", current.badge || "ACTUEEL");
}

function restartSlideTimer() {
  if (slideTimer) {
    window.clearInterval(slideTimer);
  }

  if (MEDIA_SLIDES.length > 1) {
    slideTimer = window.setInterval(() => {
      showSlide(activeSlideIndex + 1);
    }, CONFIG.slideDurationMs);
  }
}

function renderHourly(hourly) {
  const container = byId("hourlyForecast");

  if (!container || !Array.isArray(hourly?.time)) {
    return;
  }

  const now = new Date();

  let startIndex = hourly.time.findIndex((value) => {
    const date = new Date(value);
    return date >= now;
  });

  if (startIndex < 0) {
    startIndex = 0;
  }

  const cards = [];

  for (
    let index = startIndex;
    index < Math.min(startIndex + 6, hourly.time.length);
    index += 1
  ) {
    const date = new Date(hourly.time[index]);
    const [, icon] = weatherInfo(hourly.weather_code?.[index]);

    cards.push(`
      <div class="hour">
        <span class="time">${formatClockTime(date)}</span>
        <span class="icon">${icon}</span>
        <strong class="degrees">${numberText(hourly.temperature_2m?.[index])}°</strong>
        <span class="rain">💧 ${numberText(hourly.precipitation_probability?.[index])}%</span>
      </div>
    `);
  }

  container.innerHTML = cards.join("");
}

function findPost(posts, terms) {
  return posts.find((post) => {
    const name = String(post.name || "").toLowerCase();
    return terms.some((term) => name.includes(term));
  });
}

function renderFlag(post) {
  if (!post?.flag_status) {
    return `<div class="no-flag">Geen actieve waarschuwingsvlag gemeld.</div>`;
  }

  const image = post.flag_img_no_text || post.flag_img || "";
  const text = post.flag_text || "Waarschuwingsvlag actief";
  const extended = post.flag_extended_text || "";

  return `
    <div class="flag-block">
      ${
        image
          ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(text)}">`
          : `<span style="font-size:1.7vw">🚩</span>`
      }
      <div>
        <strong>${escapeHtml(text)}</strong>
        ${extended ? `<span>${escapeHtml(extended)}</span>` : ""}
      </div>
    </div>
  `;
}

function renderRescuePost(post, fallbackName) {
  if (!post) {
    return `
      <article class="rescue-post">
        <div class="rescue-post-top">
          <h3>${escapeHtml(fallbackName)}</h3>

          <div class="lifeguard-status unknown">
            <span class="status-light"></span>
            STATUS ONBEKEND
          </div>
        </div>

        <p class="rescue-state">
          De actuele status kon niet worden opgehaald.
        </p>

        <div class="no-flag">
          Controleer altijd de vlaggen en aanwijzingen ter plaatse.
        </div>
      </article>
    `;
  }

  const active = post.state_status === true;
  const stateText =
    post.state_text ||
    post.state ||
    (active
      ? "Lifeguards houden toezicht."
      : "Geen toezicht. Zwemmen op eigen risico.");

  return `
    <article class="rescue-post ${active ? "is-open" : "is-closed"}">
      <div class="rescue-post-top">
        <h3>${escapeHtml(fallbackName)}</h3>

        <div class="lifeguard-status ${active ? "open" : "closed"}">
          <span class="status-light ${active ? "on" : "off"}"></span>
          ${active ? "BEWAAKT" : "GEEN TOEZICHT"}
        </div>
      </div>

      <p class="rescue-state">${escapeHtml(stateText)}</p>
      ${renderFlag(post)}
    </article>
  `;
}

function renderRescuePosts(posts) {
  const container = byId("rescuePosts");

  if (!container) {
    return;
  }

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

function buildBeachAdvice(weather, marine, uv) {
  const temperature = Number(weather.temperature_2m);
  const wind = Number(weather.wind_speed_10m);
  const gusts = Number(weather.wind_gusts_10m);
  const wave = Number(marine.wave_height);
  const seaTemperature = Number(marine.sea_surface_temperature);
  const uvIndex = Number(uv);
  const code = Number(weather.weather_code);

  const messages = [];

  function add(priority, text) {
    messages.push({ priority, text });
  }

  if (code >= 95) {
    add(100, "⛈️ Bij onweer direct het strand en het water verlaten.");
  } else if ([65, 82].includes(code)) {
    add(90, "🌧️ Zware buien mogelijk. Zoek tijdig een veilige plek.");
  } else if ([61, 63, 80, 81].includes(code)) {
    add(55, "🌦️ Houd rekening met regen of een bui.");
  } else if (temperature >= 24) {
    add(35, "☀️ Perfect strandweer.");
  } else if (temperature >= 20) {
    add(25, "☀️ Heerlijk weer voor een bezoek aan het strand.");
  } else if (temperature < 16) {
    add(30, "🧥 Het is fris aan zee.");
  }

  if (wind >= 40 || gusts >= 55) {
    add(85, "🌬️ Het waait hard. Zet parasols en losse spullen goed vast.");
  } else if (wind >= 25 || gusts >= 40) {
    add(50, "🌬️ Er staat een stevige zeewind.");
  }

  if (wave >= 1.5) {
    add(80, "🌊 Hoge golven: wees extra voorzichtig in zee.");
  } else if (wave >= 0.8) {
    add(45, "🌊 Houd rekening met duidelijke golfslag.");
  } else if (Number.isFinite(wave)) {
    add(15, "🌊 De zee is relatief rustig.");
  }

  if (uvIndex >= 8) {
    add(75, "🧴 UV is zeer hoog. Zoek schaduw en smeer vaak.");
  } else if (uvIndex >= 6) {
    add(65, "🧴 UV is hoog. Smeer je goed en regelmatig in.");
  } else if (uvIndex >= 3) {
    add(30, "🧴 Bescherm je huid tegen de zon.");
  }

  if (Number.isFinite(seaTemperature) && seaTemperature < 16) {
    add(40, "🌡️ Het zeewater is koud; koel niet te snel af.");
  }

  messages.sort((a, b) => b.priority - a.priority);

  const selected = messages.slice(0, 3).map((item) => item.text);
  selected.push("🚩 De officiële vlaggen en aanwijzingen zijn altijd leidend.");

  return selected.join(" ");
}

function setConnection(online, text) {
  const wrapper = byId("connectionState");

  if (wrapper) {
    wrapper.classList.toggle("online", online);
  }

  setText("connectionText", text);
}

let dashboardTimer = null;
let dashboardIsLoading = false;

let lastWeatherData = null;
let lastMarineData = null;
let lastBeachPosts = null;

async function loadWeatherData() {
  try {
    const data = await fetchJson(CONFIG.weatherUrl);

    if (!data?.current || !data?.hourly || !data?.daily) {
      throw new Error("Ongeldige weerdata-response");
    }

    return data;
  } catch (error) {
    console.error("Weerdata-fout:", error);
    return null;
  }
}

async function loadMarineData() {
  try {
    const data = await fetchJson(CONFIG.marineUrl);

    if (!data?.current) {
      throw new Error("Ongeldige marinedata-response");
    }

    return data;
  } catch (error) {
    console.error("Marinedata-fout:", error);
    return null;
  }
}

async function loadBeachPosts() {
  try {
    const data = await fetchJson(CONFIG.beachPostsUrl);

    if (
      data?.getstrandposten !== "success" ||
      !Array.isArray(data?.strandposten)
    ) {
      throw new Error("Ongeldige Strand App-response");
    }

    return data.strandposten;
  } catch (error) {
    console.error("Strand App-fout:", error);
    return null;
  }
}

function scheduleNextLoad(delayMs) {
  if (dashboardTimer) {
    window.clearTimeout(dashboardTimer);
  }

  dashboardTimer = window.setTimeout(() => {
    dashboardTimer = null;
    loadDashboard();
  }, delayMs);
}

function findTideEvents(marineData) {
  const series = marineData?.minutely_15 || marineData?.hourly || {};
  const times = Array.isArray(series.time) ? series.time : [];
  const levels = Array.isArray(series.sea_level_height_msl)
    ? series.sea_level_height_msl.map(Number)
    : [];

  if (times.length < 3 || times.length !== levels.length) {
    return {
      state: "Onbekend",
      nextHigh: null,
      nextLow: null
    };
  }

  const now = Date.now();
  const events = [];

  for (let index = 1; index < levels.length - 1; index += 1) {
    const previous = levels[index - 1];
    const current = levels[index];
    const next = levels[index + 1];
    const time = new Date(times[index]);

    if (
      !Number.isFinite(previous) ||
      !Number.isFinite(current) ||
      !Number.isFinite(next) ||
      Number.isNaN(time.getTime()) ||
      time.getTime() < now - 30 * 60 * 1000
    ) {
      continue;
    }

    if (current > previous && current >= next) {
      events.push({ type: "high", time });
    }

    if (current < previous && current <= next) {
      events.push({ type: "low", time });
    }
  }

  const future = events.filter((event) => event.time.getTime() >= now);
  const nextHigh = future.find((event) => event.type === "high")?.time || null;
  const nextLow = future.find((event) => event.type === "low")?.time || null;

  let currentIndex = times.findIndex(
    (value) => new Date(value).getTime() >= now
  );

  if (currentIndex < 1) {
    currentIndex = 1;
  }

  const currentLevel = levels[currentIndex];
  const previousLevel = levels[currentIndex - 1];

  let state = "Kentering";

  if (Number.isFinite(currentLevel) && Number.isFinite(previousLevel)) {
    const difference = currentLevel - previousLevel;

    if (difference > 0.005) {
      state = "Opkomend water";
    } else if (difference < -0.005) {
      state = "Afgaand water";
    }
  }

  return { state, nextHigh, nextLow };
}

function renderWeatherData(weatherData) {
  const current = weatherData.current || {};
  const hourly = weatherData.hourly || {};
  const daily = weatherData.daily || {};
  const [description, icon] = weatherInfo(current.weather_code);
  const uv = daily.uv_index_max?.[0];

  setText("weatherIcon", icon);
  setText("headerWeatherIcon", icon);
  setText("temperature", `${numberText(current.temperature_2m)}°`);
  setText("headerTemperature", `${numberText(current.temperature_2m)}°`);
  setText("condition", description);
  setText("headerCondition", description);
  setText("feelsLike", `${numberText(current.apparent_temperature)}°C`);

  setText(
    "wind",
    `${numberText(current.wind_speed_10m)} km/u ${compassDirection(
      current.wind_direction_10m
    )}`
  );

  setText("windGusts", `${numberText(current.wind_gusts_10m)} km/u`);
  setText("uvIndex", numberText(uv, 1));
  setText("precipitation", `${numberText(current.precipitation, 1)} mm`);

  const visibilityKm = Number(current.visibility) / 1000;

  setText(
    "visibility",
    Number.isFinite(visibilityKm)
      ? `${visibilityKm.toFixed(0)} km`
      : "—"
  );

  setText("humidity", `${numberText(current.relative_humidity_2m)}%`);
  setText("sunset", formatApiTime(daily.sunset?.[0]));

  renderHourly(hourly);
}

function renderMarineData(marineData) {
  const marine = marineData.current || {};
  const tides = findTideEvents(marineData);

  setText("waveHeight", `${numberText(marine.wave_height, 1)} m`);
  setText("waveDirection", compassDirection(marine.wave_direction));
  setText("wavePeriod", `${numberText(marine.wave_period, 1)} sec`);
  setText(
    "seaTemperature",
    `${numberText(marine.sea_surface_temperature, 1)}°C`
  );

  setText("tideState", tides.state);
  setText(
    "nextHighTide",
    tides.nextHigh ? formatClockTime(tides.nextHigh) : "—"
  );
  setText(
    "nextLowTide",
    tides.nextLow ? formatClockTime(tides.nextLow) : "—"
  );
}

function renderCurrentAdvice() {
  const current = lastWeatherData?.current || {};
  const daily = lastWeatherData?.daily || {};
  const marine = lastMarineData?.current || {};
  const uv = daily.uv_index_max?.[0];

  if (lastWeatherData || lastMarineData) {
    setText("beachAdvice", buildBeachAdvice(current, marine, uv));
  } else {
    setText(
      "beachAdvice",
      "Niet alle live gegevens konden worden opgehaald. Volg de officiële informatie ter plaatse."
    );
  }
}

async function loadDashboard() {
  if (dashboardIsLoading) {
    return;
  }

  dashboardIsLoading = true;
  setConnection(false, "Gegevens laden…");

  try {
    const [weatherData, marineData, beachPosts] = await Promise.all([
      loadWeatherData(),
      loadMarineData(),
      loadBeachPosts()
    ]);

    let loadedParts = 0;

    if (weatherData) {
      loadedParts += 1;
      lastWeatherData = weatherData;
      renderWeatherData(weatherData);
    } else if (lastWeatherData) {
      renderWeatherData(lastWeatherData);
    }

    if (marineData) {
      loadedParts += 1;
      lastMarineData = marineData;
      renderMarineData(marineData);
    } else if (lastMarineData) {
      renderMarineData(lastMarineData);
    }

    if (Array.isArray(beachPosts)) {
      loadedParts += 1;
      lastBeachPosts = beachPosts;
      renderRescuePosts(beachPosts);
    } else if (Array.isArray(lastBeachPosts)) {
      renderRescuePosts(lastBeachPosts);
    } else {
      renderRescuePosts([]);
    }

    renderCurrentAdvice();

    if (loadedParts === 3) {
      setConnection(true, `Bijgewerkt ${formatClockTime(new Date())}`);
      scheduleNextLoad(CONFIG.dataRefreshMs);
    } else if (loadedParts > 0) {
      setConnection(false, "Deels bijgewerkt · nieuwe poging over 1 minuut");
      scheduleNextLoad(CONFIG.retryDelayMs);
    } else if (lastWeatherData || lastMarineData || lastBeachPosts) {
      setConnection(false, "Tijdelijk offline · laatst bekende gegevens");
      scheduleNextLoad(CONFIG.retryDelayMs);
    } else {
      setConnection(false, "Live gegevens niet beschikbaar");
      scheduleNextLoad(CONFIG.retryDelayMs);
    }
  } catch (error) {
    console.error("Onverwachte dashboardfout:", error);
    setConnection(false, "Live gegevens niet beschikbaar");
    scheduleNextLoad(CONFIG.retryDelayMs);
  } finally {
    dashboardIsLoading = false;
  }
}

updateClock();
window.setInterval(updateClock, 1000);

initMediaSlider();
loadDashboard();
