"use strict";

/* =========================================================
   COSMICO BEACH DASHBOARD
   Zandvoort
   ========================================================= */

const CONFIG = {
  latitude: 52.374,
  longitude: 4.525,
  timezone: "Europe/Amsterdam",

  weatherUrl:
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=52.374" +
    "&longitude=4.525" +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m," +
    "weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m" +
    "&hourly=temperature_2m,weather_code,precipitation_probability" +
    "&daily=uv_index_max,sunrise,sunset" +
    "&timezone=Europe%2FAmsterdam" +
    "&forecast_days=2",

  marineUrl:
    "https://marine-api.open-meteo.com/v1/marine" +
    "?latitude=52.374" +
    "&longitude=4.525" +
    "&current=wave_height,wave_direction,wave_period,sea_surface_temperature" +
    "&timezone=Europe%2FAmsterdam",

  beachPostsUrl:
    "https://dashboard.staging.strand-app.nl/api/beachposts/v1/overview" +
    "?municipality=zandvoort",

  refreshInterval: 10 * 60 * 1000
};

/* =========================================================
   HULPFUNCTIES
   ========================================================= */

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = byId(id);

  if (element) {
    element.textContent =
      value === undefined || value === null || value === ""
        ? "—"
        : value;
  }
}

function setHtml(id, value) {
  const element = byId(id);

  if (element) {
    element.innerHTML = value;
  }
}

function safeNumber(value, decimals = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toFixed(decimals);
}

function formatTime(dateString) {
  if (!dateString) {
    return "—";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   KLOK
   ========================================================= */

function updateClock() {
  const now = new Date();

  const timeText = now.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const dateText = now.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const timeElement =
    document.getElementById("clockTime") ||
    document.getElementById("time") ||
    document.querySelector(".clock strong");

  const dateElement =
    document.getElementById("clockDate") ||
    document.getElementById("date") ||
    document.querySelector(".clock span");

  if (timeElement) {
    timeElement.textContent = timeText;
  }

  if (dateElement) {
    dateElement.textContent = dateText;
  }
}

updateClock();
setInterval(updateClock, 1000);

/* =========================================================
   WEERCODES
   ========================================================= */

function weatherInfo(code) {
  const weatherCodes = {
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

  return weatherCodes[code] || ["Onbekend", "🌤️"];
}

function windDirection(degrees) {
  if (!Number.isFinite(Number(degrees))) {
    return "—";
  }

  const directions = [
    "N",
    "NO",
    "O",
    "ZO",
    "Z",
    "ZW",
    "W",
    "NW"
  ];

  const index = Math.round(Number(degrees) / 45) % 8;

  return directions[index];
}

/* =========================================================
   DATA OPHALEN
   ========================================================= */

async function fetchJson(url) {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `HTTP-fout ${response.status} bij ${url}`
    );
  }

  return response.json();
}

async function loadBeachPosts() {
  try {
    const data = await fetchJson(CONFIG.beachPostsUrl);

    if (
      data.getstrandposten !== "success" ||
      !Array.isArray(data.strandposten)
    ) {
      throw new Error("Ongeldige Strand App-response");
    }

    return data.strandposten;
  } catch (error) {
    console.error("Strandposten konden niet worden geladen:", error);
    return [];
  }
}

/* =========================================================
   REDDINGSPOSTEN TONEN
   ========================================================= */

function findBeachPost(posts, searchTerm) {
  const term = searchTerm.toLowerCase();

  return posts.find((post) =>
    String(post.name || "")
      .toLowerCase()
      .includes(term)
  );
}

function lifeguardStatus(post) {
  if (!post) {
    return {
      active: false,
      icon: "⚪",
      label: "Status niet beschikbaar",
      text: "De actuele status kon niet worden opgehaald."
    };
  }

  const active = post.state_status === true;

  return {
    active,
    icon: active ? "🟢" : "⚫",
    label: active
      ? "Lifeguards aanwezig"
      : "Geen toezicht",
    text:
      post.state_text ||
      post.state ||
      (active
        ? "Lifeguards houden toezicht."
        : "Zwemmen op eigen risico.")
  };
}

function getFlagInformation(post) {
  if (!post || post.flag_status !== true) {
    return null;
  }

  return {
    name: post.flag || "Actieve vlag",
    text:
      post.flag_text ||
      "Er is een waarschuwingsvlag actief.",
    extendedText:
      post.flag_extended_text || "",
    image:
      post.flag_img_no_text ||
      post.flag_img ||
      ""
  };
}

function beachPostCard(post, fallbackName) {
  const status = lifeguardStatus(post);
  const flag = getFlagInformation(post);

  const name = escapeHtml(
    post?.name || fallbackName
  );

  const statusText = escapeHtml(status.text);

  let flagHtml = `
    <div style="
      margin-top:0.45vh;
      color:var(--muted);
      font-size:0.58vw;
    ">
      Geen actieve waarschuwingsvlag gemeld
    </div>
  `;

  if (flag) {
    const imageHtml = flag.image
      ? `
        <img
          src="${escapeHtml(flag.image)}"
          alt="${escapeHtml(flag.name)}"
          style="
            width:2.6vw;
            height:3.8vh;
            object-fit:contain;
            flex-shrink:0;
          "
        >
      `
      : `<span style="font-size:1.4vw;">🚩</span>`;

    flagHtml = `
      <div style="
        display:flex;
        align-items:center;
        gap:0.55vw;
        margin-top:0.45vh;
        padding-top:0.45vh;
        border-top:1px solid rgba(255,255,255,0.10);
      ">
        ${imageHtml}

        <div style="min-width:0;">
          <strong style="
            display:block;
            color:var(--gold);
            font-size:0.67vw;
          ">
            ${escapeHtml(flag.text)}
          </strong>

          ${
            flag.extendedText
              ? `
                <span style="
                  display:block;
                  margin-top:0.15vh;
                  color:var(--muted);
                  font-size:0.5vw;
                  line-height:1.2;
                ">
                  ${escapeHtml(flag.extendedText)}
                </span>
              `
              : ""
          }
        </div>
      </div>
    `;
  }

  return `
    <div style="
      min-width:0;
      height:100%;
      padding:0.75vh 0.8vw;
      border-radius:0.7vw;
      background:rgba(255,255,255,0.07);
      border:1px solid rgba(255,255,255,0.06);
      overflow:hidden;
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:0.5vw;
      ">
        <strong style="
          color:var(--cream);
          font-size:0.78vw;
          line-height:1.1;
        ">
          ${name}
        </strong>

        <span style="
          flex-shrink:0;
          font-size:0.72vw;
          font-weight:900;
          color:${status.active ? "var(--green)" : "var(--cream-soft)"};
        ">
          ${status.icon}
          ${escapeHtml(status.label)}
        </span>
      </div>

      <div style="
        margin-top:0.35vh;
        color:var(--cream-soft);
        font-size:0.56vw;
        line-height:1.25;
      ">
        ${statusText}
      </div>

      ${flagHtml}
    </div>
  `;
}

function updateBeachStatusBanner(posts) {
  const beachStatus = byId("beachStatus");

  if (!beachStatus) {
    return;
  }

  const north =
    findBeachPost(posts, "zvt noord") ||
    findBeachPost(posts, "noord");

  const south =
    findBeachPost(posts, "zvt zuid") ||
    findBeachPost(posts, "zuid");

  const hasPosts = north || south;

  beachStatus.innerHTML = `
    <div class="beach-status-icon">
      🛟
    </div>

    <div class="beach-status-content">
      <div class="beach-status-label">
        ACTUELE INFORMATIE STRAND APP
      </div>

      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:1vw;
        margin-bottom:0.55vh;
      ">
        <h2 style="margin:0;">
          Reddingsbrigade Zandvoort
        </h2>

        <span style="
          color:var(--muted);
          font-size:0.5vw;
          white-space:nowrap;
        ">
          Live status van beide strandposten
        </span>
      </div>

      ${
        hasPosts
          ? `
            <div style="
              display:grid;
              grid-template-columns:1fr 1fr;
              gap:0.7vw;
              height:7.1vh;
            ">
              ${beachPostCard(
                north,
                "Reddingspost ZVT Noord"
              )}

              ${beachPostCard(
                south,
                "Reddingspost ZVT Zuid"
              )}
            </div>
          `
          : `
            <div style="
              padding:0.8vh 0.8vw;
              border-radius:0.7vw;
              background:rgba(255,255,255,0.07);
              color:var(--cream-soft);
              font-size:0.7vw;
            ">
              De actuele reddingsbrigadestatus kon niet worden opgehaald.
              Volg altijd de vlaggen en aanwijzingen op het strand.
            </div>
          `
      }
    </div>
  `;
}

/* =========================================================
   UURVERWACHTING
   ========================================================= */

function renderHourlyForecast(hourly) {
  const container = byId("hourlyForecast");

  if (!container || !hourly?.time) {
    return;
  }

  const now = new Date();
  const currentHour = now.getHours();

  let startIndex = hourly.time.findIndex((time) => {
    const date = new Date(time);

    return (
      date.getDate() === now.getDate() &&
      date.getHours() >= currentHour
    );
  });

  if (startIndex < 0) {
    startIndex = 0;
  }

  const items = [];

  for (
    let index = startIndex;
    index < Math.min(startIndex + 6, hourly.time.length);
    index += 1
  ) {
    const date = new Date(hourly.time[index]);
    const [, icon] = weatherInfo(
      hourly.weather_code?.[index]
    );

    items.push(`
      <div class="hour">
        <div class="time">
          ${date.toLocaleTimeString("nl-NL", {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </div>

        <div class="icon">${icon}</div>

        <div class="degrees">
          ${safeNumber(
            hourly.temperature_2m?.[index],
            0
          )}°
        </div>

        <div class="rain">
          💧 ${safeNumber(
            hourly.precipitation_probability?.[index],
            0
          )}%
        </div>
      </div>
    `);
  }

  container.innerHTML = items.join("");
}

/* =========================================================
   STRANDADVIES
   ========================================================= */

function createBeachAdvice(weather, marine, uvIndex) {
  const temperature = Number(weather.temperature_2m);
  const windSpeed = Number(weather.wind_speed_10m);
  const gusts = Number(weather.wind_gusts_10m);
  const waveHeight = Number(marine.wave_height);
  const uv = Number(uvIndex);
  const weatherCode = Number(weather.weather_code);

  const warnings = [];
  const positives = [];

  if (weatherCode >= 95) {
    warnings.push(
      "Onweer mogelijk. Ga bij onweer direct van het strand."
    );
  } else if (
    [61, 63, 65, 80, 81, 82].includes(weatherCode)
  ) {
    warnings.push("Houd rekening met regen of buien.");
  }

  if (windSpeed >= 40 || gusts >= 55) {
    warnings.push(
      "Er staat veel wind. Losse spullen kunnen wegwaaien."
    );
  } else if (windSpeed >= 25) {
    warnings.push(
      "Het is behoorlijk winderig op het strand."
    );
  } else {
    positives.push("De wind is redelijk rustig.");
  }

  if (waveHeight >= 1.5) {
    warnings.push(
      "Er staan stevige golven. Wees extra voorzichtig in zee."
    );
  } else if (waveHeight >= 0.8) {
    warnings.push(
      "Er is merkbare golfslag. Houd kinderen goed in de gaten."
    );
  } else {
    positives.push("De golfhoogte is beperkt.");
  }

  if (uv >= 6) {
    warnings.push(
      "De UV-straling is hoog. Smeer regelmatig met zonnebrand."
    );
  } else if (uv >= 3) {
    warnings.push(
      "Bescherm je huid tegen de zon."
    );
  }

  if (temperature >= 22) {
    positives.push(
      "Het is een aangename strandtemperatuur."
    );
  } else if (temperature < 16) {
    warnings.push(
      "Het voelt fris aan op het strand."
    );
  }

  if (warnings.length === 0) {
    return `
      <strong>Goed strandweer</strong>
      <small>
        ${escapeHtml(
          positives.join(" ")
        )}
        Blijf altijd letten op de vlaggen en aanwijzingen van de lifeguards.
      </small>
    `;
  }

  return `
    <strong>${escapeHtml(warnings[0])}</strong>
    <small>
      ${escapeHtml(
        [...warnings.slice(1), ...positives]
          .slice(0, 3)
          .join(" ")
      )}
      De officiële strandstatus hierboven is altijd leidend.
    </small>
  `;
}

/* =========================================================
   DASHBOARD LADEN
   ========================================================= */

async function loadDashboard() {
  setText("connectionStatus", "Gegevens worden bijgewerkt...");

  try {
    const [
      weatherData,
      marineData,
      beachPosts
    ] = await Promise.all([
      fetchJson(CONFIG.weatherUrl),
      fetchJson(CONFIG.marineUrl),
      loadBeachPosts()
    ]);

    const current = weatherData.current || {};
    const hourly = weatherData.hourly || {};
    const daily = weatherData.daily || {};
    const marine = marineData.current || {};

    const [description, icon] =
      weatherInfo(current.weather_code);

    /* Reddingsbrigade */

    updateBeachStatusBanner(beachPosts);

    /* Huidig weer */

    setText(
      "weatherIcon",
      icon
    );

    setText(
      "temperature",
      `${safeNumber(current.temperature_2m, 0)}°`
    );

    setText(
      "condition",
      description
    );

    setText(
      "feelsLike",
      `${safeNumber(
        current.apparent_temperature,
        0
      )}°C`
    );

    setText(
      "humidity",
      `${safeNumber(
        current.relative_humidity_2m,
        0
      )}%`
    );

    setText(
      "wind",
      `${safeNumber(
        current.wind_speed_10m,
        0
      )} km/u ${windDirection(
        current.wind_direction_10m
      )}`
    );

    setText(
      "windGusts",
      `${safeNumber(
        current.wind_gusts_10m,
        0
      )} km/u`
    );

    /* Uurverwachting */

    renderHourlyForecast(hourly);

    /* Zee */

    setText(
      "waveHeight",
      `${safeNumber(
        marine.wave_height,
        1
      )} m`
    );

    setText(
      "wavePeriod",
      `${safeNumber(
        marine.wave_period,
        1
      )} sec`
    );

    setText(
      "waveDirection",
      windDirection(
        marine.wave_direction
      )
    );

    setText(
      "seaTemperature",
      Number.isFinite(
        Number(marine.sea_surface_temperature)
      )
        ? `${safeNumber(
            marine.sea_surface_temperature,
            1
          )}°C`
        : "Niet beschikbaar"
    );

    /* Daggegevens */

    const uvIndex = daily.uv_index_max?.[0];

    setText(
      "uvIndex",
      safeNumber(uvIndex, 1)
    );

    setText(
      "sunrise",
      formatTime(daily.sunrise?.[0])
    );

    setText(
      "sunset",
      formatTime(daily.sunset?.[0])
    );

    /* Advies */

    setHtml(
      "advice",
      createBeachAdvice(
        current,
        marine,
        uvIndex
      )
    );

    /* Footer */

    setText(
      "lastUpdated",
      `Bijgewerkt om ${new Date().toLocaleTimeString(
        "nl-NL",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      )}`
    );

    setText(
      "connectionStatus",
      "Live gegevens actief"
    );

    const statusElement = byId("status");

    if (statusElement) {
      statusElement.classList.add("online");
    }
  } catch (error) {
    console.error("Dashboardfout:", error);

    setText(
      "connectionStatus",
      "Niet alle gegevens zijn beschikbaar"
    );

    const statusElement = byId("status");

    if (statusElement) {
      statusElement.classList.remove("online");
    }

    updateBeachStatusBanner([]);
  }
}

/* =========================================================
   STARTEN EN VERVERSEN
   ========================================================= */

loadDashboard();

setInterval(
  loadDashboard,
  CONFIG.refreshInterval
);
