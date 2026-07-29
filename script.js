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

const beachPostsUrl =
  `https://dashboard.staging.strand-app.nl/api/beachposts/v1/overview` +
  `?municipality=zandvoort`;

const BEACH_CACHE_KEY = "cosmicoBeachStatus";
const BEACH_CACHE_DATE_KEY = "cosmicoBeachStatusDate";

const $ = (id) => document.getElementById(id);

const windDirections = [
  "N", "NNO", "NO", "ONO",
  "O", "OZO", "ZO", "ZZO",
  "Z", "ZZW", "ZW", "WZW",
  "W", "WNW", "NW", "NNW"
];

function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent = value;
  }
}

function setHtml(id, value) {
  const element = $(id);

  if (element) {
    element.innerHTML = value;
  }
}

function number(value, decimals = 0) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue.toFixed(decimals)
    : "--";
}

function windDirection(degrees) {
  const parsedDegrees = Number(degrees);

  if (!Number.isFinite(parsedDegrees)) {
    return "--";
  }

  const normalized = ((parsedDegrees % 360) + 360) % 360;

  return windDirections[
    Math.round(normalized / 22.5) % 16
  ];
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

  setText(
    "clock",
    now.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit"
    })
  );

  setText(
    "date",
    now.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long"
    })
  );
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCachedBeachStatus() {
  try {
    const cached = localStorage.getItem(BEACH_CACHE_KEY);

    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.warn("Opgeslagen strandstatus kon niet worden gelezen:", error);
    return null;
  }
}

function saveBeachStatus(data) {
  try {
    localStorage.setItem(
      BEACH_CACHE_KEY,
      JSON.stringify(data)
    );

    localStorage.setItem(
      BEACH_CACHE_DATE_KEY,
      localDateKey()
    );
  } catch (error) {
    console.warn("Strandstatus kon niet worden opgeslagen:", error);
  }
}

function shouldRefreshBeachStatus() {
  const now = new Date();
  const cachedDate = localStorage.getItem(BEACH_CACHE_DATE_KEY);

  const isAfterTwelve =
    now.getHours() >= 12;

  const alreadyUpdatedToday =
    cachedDate === localDateKey(now);

  return isAfterTwelve && !alreadyUpdatedToday;
}

function summarizeBeachPosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return null;
  }

  const southPost =
    posts.find((post) =>
      String(post.name || "").toLowerCase().includes("zuid")
    ) || posts[0];

  const activeFlagPost =
    posts.find((post) => post.flag_status === true);

  const selectedPost =
    activeFlagPost || southPost;

  const flagText =
    selectedPost.flag_text ||
    selectedPost.state_text ||
    selectedPost.state ||
    "Geen actuele vlaginformatie beschikbaar.";

  const extendedText =
    selectedPost.flag_extended_text || "";

  return {
    name: selectedPost.name || "Zandvoort aan Zee",
    flag: selectedPost.flag || "",
    flagColor: selectedPost.flag_color || "333333",
    flagImage:
      selectedPost.flag_img_no_text ||
      selectedPost.flag_img ||
      "",
    flagStatus: selectedPost.flag_status === true,
    stateStatus: selectedPost.state_status === true,
    title: flagText,
    description: extendedText,
    updatedAt: new Date().toISOString()
  };
}

async function fetchBeachStatus() {
  const response = await fetch(beachPostsUrl, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Strand App gaf foutcode ${response.status}`
    );
  }

  const data = await response.json();

  if (
    data.getstrandposten !== "success" ||
    !Array.isArray(data.strandposten)
  ) {
    throw new Error(
      "Strand App gaf geen geldige strandposten terug"
    );
  }

  const beachStatus =
    summarizeBeachPosts(data.strandposten);

  if (!beachStatus) {
    throw new Error(
      "Geen strandstatus gevonden"
    );
  }

  saveBeachStatus(beachStatus);

  return beachStatus;
}

async function loadBeachStatus() {
  const cachedStatus = getCachedBeachStatus();

  /*
   * Voor 12:00 uur gebruiken we de laatst opgeslagen status.
   * Na 12:00 uur halen we maximaal één keer per dag nieuwe data op.
   * Wanneer er nog nooit data is opgeslagen, proberen we direct op te halen.
   */
  if (cachedStatus && !shouldRefreshBeachStatus()) {
    return cachedStatus;
  }

  try {
    return await fetchBeachStatus();
  } catch (error) {
    console.error("Strand App fout:", error);

    if (cachedStatus) {
      return cachedStatus;
    }

    return {
      name: "Zandvoort aan Zee",
      flag: "",
      flagColor: "333333",
      flagImage: "",
      flagStatus: false,
      stateStatus: false,
      title: "Officiële strandstatus tijdelijk niet beschikbaar.",
      description: "",
      updatedAt: null
    };
  }
}

function beachStatusHtml(beachStatus) {
  if (!beachStatus) {
    return "";
  }

  const imageHtml = beachStatus.flagImage
    ? `
      <img
        src="${beachStatus.flagImage}"
        alt="Actuele strandvlag"
        class="beach-flag-image"
      >
    `
    : "";

  const updateText = beachStatus.updatedAt
    ? new Date(beachStatus.updatedAt).toLocaleString("nl-NL", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "tijd onbekend";

  return `
    <div class="official-beach-status">
      ${imageHtml}

      <div class="official-beach-status-text">
        <div class="official-label">
          Officiële strandinformatie
        </div>

        <strong>${beachStatus.title}</strong>

        ${
          beachStatus.description
            ? `<p>${beachStatus.description}</p>`
            : ""
        }

        <small>
          ${beachStatus.name} · bijgewerkt ${updateText}
        </small>
      </div>
    </div>
  `;
}

function weatherAdvice(gusts, waves, uv, weatherCode) {
  const messages = [];

  if (weatherCode >= 95) {
    messages.push(
      "Kans op onweer. Volg de aanwijzingen van medewerkers en hulpdiensten."
    );
  } else if (weatherCode >= 61) {
    messages.push(
      "Er worden buien verwacht. Houd de actuele lucht goed in de gaten."
    );
  }

  if (gusts >= 55) {
    messages.push(
      "Het waait zeer stevig. Let extra op losse spullen en parasols."
    );
  } else if (gusts >= 40) {
    messages.push(
      "Er staat een stevige wind. Houd lichte spullen goed vast."
    );
  }

  if (waves >= 1.5) {
    messages.push(
      "De zee is onrustig. Volg altijd de strandvlaggen."
    );
  } else if (waves >= 1) {
    messages.push(
      "Er staat merkbare golfslag. Let extra op kinderen bij de waterlijn."
    );
  }

  if (uv >= 6) {
    messages.push(
      "De UV-kracht is hoog. Smeer regelmatig en zoek op tijd de schaduw op."
    );
  }

  if (messages.length === 0) {
    messages.push(
      "Prima strandweer. Geniet ervan en blijf de strandvlaggen volgen."
    );
  }

  return messages.join(" ");
}

function completeBeachAdvice(
  beachStatus,
  gusts,
  waves,
  uv,
  weatherCode
) {
  return `
    ${beachStatusHtml(beachStatus)}

    <div class="weather-beach-advice">
      ${weatherAdvice(
        gusts,
        waves,
        uv,
        weatherCode
      )}

      <small>
        De vlaggen op het strand en instructies van hulpdiensten zijn altijd leidend.
      </small>
    </div>
  `;
}

async function loadDashboard() {
  try {
    const [
      weatherResponse,
      marineResponse,
      beachStatus
    ] = await Promise.all([
      fetch(weatherUrl, {
        cache: "no-store"
      }),

      fetch(marineUrl, {
        cache: "no-store"
      }),

      loadBeachStatus()
    ]);

    if (!weatherResponse.ok) {
      throw new Error(
        `Weerbron gaf foutcode ${weatherResponse.status}`
      );
    }

    if (!marineResponse.ok) {
      throw new Error(
        `Marinebron gaf foutcode ${marineResponse.status}`
      );
    }

    const weatherData =
      await weatherResponse.json();

    const marineData =
      await marineResponse.json();

    const current =
      weatherData.current || {};

    const marine =
      marineData.current || {};

    const [description, icon] =
      weatherInfo(current.weather_code);

    setText(
      "temperature",
      `${number(current.temperature_2m)}°`
    );

    setText(
      "weatherIcon",
      icon
    );

    setText(
      "condition",
      description
    );

    setText(
      "feelsLike",
      `${number(current.apparent_temperature)}°`
    );

    setText(
      "wind",
      `${windDirection(current.wind_direction_10m)} ` +
      `${number(current.wind_speed_10m)} km/u`
    );

    setText(
      "gusts",
      `${number(current.wind_gusts_10m)} km/u`
    );

    setText(
      "precipitation",
      `${number(current.precipitation, 1)} mm`
    );

    setText(
      "humidity",
      `${number(current.relative_humidity_2m)}%`
    );

    let hourIndex =
      weatherData.hourly.time.indexOf(current.time);

    if (hourIndex < 0) {
      const currentHour =
        current.time?.slice(0, 13);

      hourIndex =
        weatherData.hourly.time.findIndex(
          (time) => time.slice(0, 13) === currentHour
        );
    }

    if (hourIndex < 0) {
      hourIndex = 0;
    }

    const currentUv =
      weatherData.hourly.uv_index[hourIndex];

    const maximumUv =
      weatherData.daily.uv_index_max[0];

    setText(
      "uvIndex",
      number(currentUv, 1)
    );

    setText(
      "uvMax",
      number(maximumUv, 1)
    );

    setText(
      "visibility",
      `${number(
        weatherData.hourly.visibility[hourIndex] / 1000,
        1
      )} km`
    );

    setText(
      "sunrise",
      weatherData.daily.sunrise[0].slice(11, 16)
    );

    setText(
      "sunset",
      weatherData.daily.sunset[0].slice(11, 16)
    );

    setText(
      "waveHeight",
      `${number(marine.wave_height, 1)} m`
    );

    setText(
      "waveDirection",
      windDirection(marine.wave_direction)
    );

    setText(
      "wavePeriod",
      `${number(marine.wave_period, 1)} s`
    );

    let forecastHtml = "";

    for (let step = 0; step < 6; step += 1) {
      const index = Math.min(
        hourIndex + step * 2,
        weatherData.hourly.time.length - 1
      );

      const [, forecastIcon] =
        weatherInfo(
          weatherData.hourly.weather_code[index]
        );

      forecastHtml += `
        <div class="hour">
          <div class="time">
            ${weatherData.hourly.time[index].slice(11, 16)}
          </div>

          <div class="icon">
            ${forecastIcon}
          </div>

          <div class="degrees">
            ${number(
              weatherData.hourly.temperature_2m[index]
            )}°
          </div>

          <div class="rain">
            💧 ${number(
              weatherData.hourly
                .precipitation_probability[index]
            )}%
          </div>
        </div>
      `;
    }

    setHtml(
      "hourlyForecast",
      forecastHtml
    );

    setHtml(
      "beachAdvice",
      completeBeachAdvice(
        beachStatus,
        Number(current.wind_gusts_10m) || 0,
        Number(marine.wave_height) || 0,
        Number(maximumUv) || 0,
        Number(current.weather_code) || 0
      )
    );

    const statusElement = $("status");

    if (statusElement) {
      statusElement.classList.add("online");
    }

    setText(
      "updated",
      `bijgewerkt ${new Date().toLocaleTimeString(
        "nl-NL",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      )}`
    );

  } catch (error) {
    console.error("Dashboardfout:", error);

    setText(
      "condition",
      "Live gegevens tijdelijk niet beschikbaar"
    );

    setText(
      "updated",
      "geen live verbinding"
    );

    const statusElement = $("status");

    if (statusElement) {
      statusElement.classList.remove("online");
    }
  }
}

updateClock();

setInterval(
  updateClock,
  1000
);

loadDashboard();

setInterval(
  loadDashboard,
  300000
);
