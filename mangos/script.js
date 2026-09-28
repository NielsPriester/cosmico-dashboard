"use strict";

/* =========================================================
   MANGO'S BEACHBAR DASHBOARD 3.6.0
   Bewust geschreven zonder ?. / ?? / replaceAll / Promise.allSettled,
   zodat het ook draait op oudere tv-browsers (PEAQ / Android TV WebView).
   Elke render-stap staat los in een try/catch: één fout blokkeert niet meer
   de rest van het scherm.
   ========================================================= */

var VERSION = "3.6.1";
var LAT = "52.3765", LON = "4.5330";
var WEATHER_BASE =
  "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
  "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code," +
  "wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,is_day" +
  "&hourly=temperature_2m,weather_code,precipitation_probability,precipitation,sunshine_duration," +
  "cloud_cover,is_day,wind_speed_10m,wind_direction_10m" +
  "&daily=uv_index_max,sunrise,sunset" +
  "&timezone=Europe%2FAmsterdam&timeformat=unixtime&forecast_days=2&wind_speed_unit=kmh";

var CONFIG = {
  weatherUrl: WEATHER_BASE + "&models=knmi_seamless",
  weatherFallbackUrl: WEATHER_BASE,
  marineUrl:
    "https://marine-api.open-meteo.com/v1/marine?latitude=52.39&longitude=4.45" +
    "&current=wave_height,wave_direction,wave_period" +
    "&hourly=sea_surface_temperature,sea_level_height_msl" +
    "&timezone=Europe%2FAmsterdam&timeformat=unixtime&past_days=1&forecast_days=2",
  beachPostsUrl: "https://dashboard.strand-app.nl/api/beachposts/v1/overview?municipality=zandvoort",
  refreshMs: 10 * 60 * 1000,
  retryMs: 60 * 1000,
  requestTimeoutMs: 12 * 1000,
  hardReloadMs: 6 * 60 * 60 * 1000,
  cacheKey: "mangos-dashboard-360-cache",
  canvasW: 1920,
  canvasH: 1080
};

/* ---------- Helpers ---------- */
function $(id) { return document.getElementById(id); }
function get(obj, path, fallback) {
  var cur = obj;
  for (var i = 0; i < path.length; i++) {
    if (cur === null || cur === undefined) return fallback;
    cur = cur[path[i]];
  }
  return (cur === null || cur === undefined) ? fallback : cur;
}
function setText(id, value, fallback) {
  var node = $(id);
  if (!node) return;
  node.textContent = (value === undefined || value === null || value === "") ? (fallback || "—") : value;
}
function num(value, decimals) {
  var n = Number(value);
  return isFinite(n) && value !== null && value !== "" ? n.toFixed(decimals || 0) : "—";
}
function pad(n) { return n < 10 ? "0" + n : String(n); }
function hhmm(ms) {
  if (!isFinite(ms)) return "--:--";
  var d = new Date(ms);
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}
function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function safe(label, fn) {
  try { fn(); } catch (err) { if (window.console) console.error("[Mango's] " + label + " mislukt:", err); }
}
function toMs(unixArr) {
  var out = [];
  for (var i = 0; i < (unixArr || []).length; i++) out.push(Number(unixArr[i]) * 1000);
  return out;
}

var DAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
var MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

/* ---------- Modus + schalen ---------- */
/* Schermmaat meten via een 100vw x 100vh probe: sommige tv-WebViews (Fully Kiosk)
   geven via innerWidth fysieke pixels door i.p.v. CSS-pixels. */
function viewportSize() {
  var w = 0, h = 0;
  var p = $("vpProbe");
  if (p) { var r = p.getBoundingClientRect(); w = r.width; h = r.height; }
  var de = document.documentElement;
  var cands = [[w, h], [de.clientWidth, de.clientHeight], [window.innerWidth, window.innerHeight]];
  if (window.visualViewport) cands.push([window.visualViewport.width, window.visualViewport.height]);
  // Neem de kleinste geldige maat: nooit groter schalen dan wat echt zichtbaar is.
  var bw = Infinity, bh = Infinity;
  for (var i = 0; i < cands.length; i++) {
    if (cands[i][0] > 50 && cands[i][1] > 50 && cands[i][0] * cands[i][1] < bw * bh) { bw = cands[i][0]; bh = cands[i][1]; }
  }
  if (!isFinite(bw)) { bw = window.innerWidth || 1920; bh = window.innerHeight || 1080; }
  return { w: bw, h: bh };
}
function getMode() {
  var q = (window.location.search.match(/[?&]mode=([a-z]+)/i) || [])[1];
  q = q ? q.toLowerCase() : "";
  if (q === "mobile") return "mobile";
  if (q === "tv" || q === "laptop" || q === "kiosk") return "tv";
  return viewportSize().w < 760 ? "mobile" : "tv";
}
var lastFit = "";
function fitStage() {
  var mode = getMode();
  document.documentElement.setAttribute("data-mode", mode);
  var stage = $("stage");
  if (!stage) return;
  if (mode === "mobile") { stage.style.transform = ""; stage.style.webkitTransform = ""; stage.style.left = ""; stage.style.top = ""; lastFit = ""; return; }
  var vp = viewportSize();
  var s = Math.min(vp.w / CONFIG.canvasW, vp.h / CONFIG.canvasH);
  var key = vp.w + "x" + vp.h;
  if (key === lastFit) return;
  lastFit = key;
  stage.style.webkitTransform = "scale(" + s + ")";
  stage.style.transform = "scale(" + s + ")";
  stage.style.left = Math.max(0, (vp.w - CONFIG.canvasW * s) / 2) + "px";
  stage.style.top = Math.max(0, (vp.h - CONFIG.canvasH * s) / 2) + "px";
}

/* ---------- Zon / thema ---------- */
var sky = { sunrise: null, sunset: null, sunriseNext: null, sunsetNext: null, code: null, isNight: false };

function isNightNow() {
  var now = Date.now();
  if (!sky.sunrise || !sky.sunset) { var h = new Date().getHours(); return h < 7 || h >= 21; }
  return now < sky.sunrise || now > sky.sunset;
}
function applyTheme() {
  var night = isNightNow();
  document.documentElement.setAttribute("data-theme", night ? "night" : "day");
  if (night !== sky.isNight) {
    sky.isNight = night;
    if (sky.code !== null) {
      var info = weatherInfo(sky.code, night);
      setText("weatherIcon", info[1]);
      setText("condition", info[0]);
    }
  }
  updateSun();
}
function updateSun() {
  var now = Date.now();
  if (sky.sunset && now < sky.sunset && (!sky.sunrise || now >= sky.sunrise)) {
    setText("sunLabel", "Zonsondergang"); setText("sunIcon", "🌅");
    setText("sunTime", hhmm(sky.sunset)); setText("sunSub", "vandaag");
  } else {
    var next = (sky.sunrise && now < sky.sunrise) ? sky.sunrise : sky.sunriseNext;
    setText("sunLabel", "Zonsopgang"); setText("sunIcon", "🌄");
    setText("sunTime", next ? hhmm(next) : "--:--");
    setText("sunSub", (sky.sunrise && now < sky.sunrise) ? "vandaag" : "morgen");
  }
}

function weatherInfo(code, night) {
  var map = {
    0: ["Onbewolkt", "☀️"], 1: ["Vrij zonnig", "🌤️"], 2: ["Halfbewolkt", "⛅"], 3: ["Bewolkt", "☁️"],
    45: ["Mist", "🌫️"], 48: ["Rijpmist", "🌫️"], 51: ["Lichte motregen", "🌦️"], 53: ["Motregen", "🌦️"],
    55: ["Motregen", "🌧️"], 61: ["Lichte regen", "🌦️"], 63: ["Regen", "🌧️"], 65: ["Zware regen", "🌧️"],
    71: ["Lichte sneeuw", "🌨️"], 73: ["Sneeuw", "🌨️"], 75: ["Zware sneeuw", "❄️"],
    80: ["Lichte buien", "🌦️"], 81: ["Buien", "🌧️"], 82: ["Zware buien", "⛈️"],
    95: ["Onweer", "⛈️"], 96: ["Onweer met hagel", "⛈️"], 99: ["Zwaar onweer", "⛈️"]
  };
  var c = Number(code);
  var r = map[c] || ["Wisselend", "🌤️"];
  if (night) {
    if (c === 0) return ["Helder", "🌙"];
    if (c === 1) return ["Licht bewolkt", "🌙"];
  }
  return r;
}

/* ---------- Klok ---------- */
function updateClock() {
  var d = new Date();
  setText("clockTime", pad(d.getHours()) + ":" + pad(d.getMinutes()));
  setText("clockDate", DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()]);
  safe("thema", applyTheme);
  safe("nu-marker", updateNowMarker);
}

/* ---------- Wind ---------- */
function compass(deg) {
  var v = Number(deg);
  if (!isFinite(v)) return "—";
  var labels = ["N","NNO","NO","ONO","O","OZO","ZO","ZZO","Z","ZZW","ZW","WZW","W","WNW","NW","NNW"];
  return labels[Math.round((((v % 360) + 360) % 360) / 22.5) % 16];
}
function beaufort(kmh) {
  var v = Number(kmh);
  if (!isFinite(v)) return "—";
  var limits = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  for (var i = 0; i < limits.length; i++) if (v < limits[i]) return String(i);
  return "12";
}
function setWindArrow(deg) {
  var arrow = $("windArrow");
  var v = Number(deg);
  if (!arrow || !isFinite(v)) return;
  // Pijl wijst waar de wind naartoe waait.
  arrow.style.transform = "rotate(" + ((v + 180) % 360) + "deg)";
}

/* ---------- Fetch ---------- */
function fetchJson(url) {
  return new Promise(function (resolve, reject) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
      reject(new Error("timeout"));
    }, CONFIG.requestTimeoutMs);
    var opts = { cache: "no-store", credentials: "omit" };
    if (controller) opts.signal = controller.signal;
    fetch(url, opts).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (json) { clearTimeout(timer); resolve(json); })
      .catch(function (err) { clearTimeout(timer); reject(err); });
  });
}
function settle(p) {
  return p.then(function (v) { return { ok: true, value: v }; }, function (e) { return { ok: false, error: e }; });
}
function loadWeather() {
  return fetchJson(CONFIG.weatherUrl).then(function (d) { d._source = "KNMI"; return d; }, function () {
    return fetchJson(CONFIG.weatherFallbackUrl).then(function (d) { d._source = "MODEL"; return d; });
  });
}

var beachFailures = 0, beachNextAttempt = 0;
function loadBeachPosts() {
  if (Date.now() < beachNextAttempt) return Promise.reject(new Error("backoff"));
  return fetchJson(CONFIG.beachPostsUrl).then(function (data) {
    if (!data || data.getstrandposten !== "success" || !(data.strandposten instanceof Array)) throw new Error("Ongeldige Strand App-response");
    beachFailures = 0; beachNextAttempt = 0;
    return data.strandposten;
  }, function (err) {
    beachFailures += 1;
    beachNextAttempt = Date.now() + Math.min(60, 5 * Math.pow(2, beachFailures - 1)) * 60 * 1000;
    throw err;
  });
}

/* ---------- Weer nu ---------- */
function renderNow(w) {
  var cur = w.current || {};
  var daily = w.daily || {};
  var dSunrise = toMs(daily.sunrise), dSunset = toMs(daily.sunset);
  sky.sunrise = dSunrise[0] || sky.sunrise; sky.sunset = dSunset[0] || sky.sunset;
  sky.sunriseNext = dSunrise[1] || sky.sunriseNext; sky.sunsetNext = dSunset[1] || sky.sunsetNext;
  sky.code = cur.weather_code !== undefined ? cur.weather_code : sky.code;
  sky.isNight = isNightNow();
  applyTheme();

  var info = weatherInfo(cur.weather_code, sky.isNight);
  setText("weatherIcon", info[1]);
  setText("condition", info[0]);
  setText("temperature", num(cur.temperature_2m) + "°");
  setText("feelsLike", num(cur.apparent_temperature) + "°");
  setText("uvIndex", num(get(daily, ["uv_index_max", 0], null), 0));
  setText("precipitation", num(cur.precipitation, 1) + " mm");
  setText("humidity", num(cur.relative_humidity_2m) + "%");

  setText("windBft", beaufort(cur.wind_speed_10m));
  setText("windDir", compass(cur.wind_direction_10m));
  setText("windKmh", num(cur.wind_speed_10m) + " km/u · stoten " + num(cur.wind_gusts_10m) + " km/u");
  setWindArrow(cur.wind_direction_10m);
  setText("forecastSource", (w._source === "MODEL" ? "WEERMODEL" : "KNMI") + " · 8 UUR");
}

/* ---------- Uurverwachting ---------- */
var forecastRange = null;

function skyColor(code, night, cloud) {
  var c = Number(code);
  cloud = isFinite(Number(cloud)) ? Number(cloud) : 50;
  if (night) return cloud >= 75 ? "#263543" : "#12304c";
  if (c >= 95) return "#525967";
  if ([51,53,55,61,63,65,80,81,82].indexOf(c) >= 0) return "#5f7580";
  if (cloud >= 88 || c === 3) return "#6f8591";
  if (cloud >= 60 || c === 2) return "#4f8fa6";
  if (cloud >= 30 || c === 1) return "#2f94b8";
  return "#1f8fc9";
}

function renderHourly(hourly) {
  var container = $("hourlyForecast");
  if (!container || !hourly || !hourly.time) return;
  var times = toMs(hourly.time);
  var startHour = new Date(); startHour.setMinutes(0, 0, 0);
  var start = -1;
  for (var i = 0; i < times.length; i++) if (times[i] >= startHour.getTime()) { start = i; break; }
  if (start < 0) start = 0;

  var html = [], stops = [];
  var count = Math.min(8, times.length - start);
  for (var k = 0; k < count; k++) {
    var idx = start + k;
    var night = hourly.is_day ? Number(hourly.is_day[idx]) === 0 : false;
    var info = weatherInfo(get(hourly, ["weather_code", idx]), night);
    var rain = Math.round(Number(get(hourly, ["precipitation_probability", idx], 0)) || 0);
    var mm = Number(get(hourly, ["precipitation", idx], 0)) || 0;
    var wind = get(hourly, ["wind_speed_10m", idx], null);
    var windDir = get(hourly, ["wind_direction_10m", idx], null);
    var chips = "";
    if (rain >= 20) chips += '<span class="fc-chip rain">🌧 ' + rain + '%' + (mm >= 0.2 ? " · " + mm.toFixed(1) + "mm" : "") + "</span>";
    chips += '<span class="fc-chip wind">' + beaufort(wind) + " Bft " + compass(windDir) + "</span>";

    html.push(
      '<div class="hour' + (k === 0 ? " is-now" : "") + '">' +
        '<div class="hour-left"><span class="time">' + hhmm(times[idx]) + '</span><span class="icon">' + info[1] + "</span></div>" +
        '<div class="hour-right"><strong class="degrees">' + num(get(hourly, ["temperature_2m", idx])) + '°</strong><span class="chips">' + chips + "</span></div>" +
      "</div>"
    );
    var col = skyColor(get(hourly, ["weather_code", idx]), night, get(hourly, ["cloud_cover", idx]));
    var a = (k / count * 100).toFixed(2), b = ((k + 1) / count * 100).toFixed(2);
    stops.push(col + " " + a + "%", col + " " + b + "%");
  }
  if (!count) return;
  container.style.background = "linear-gradient(90deg," + stops.join(",") + ")";
  container.innerHTML = '<div id="nowMarker" class="now-marker"><span>NU</span></div>' + html.join("");
  forecastRange = { start: times[start], count: count };
  updateNowMarker();
}
function updateNowMarker() {
  var m = $("nowMarker");
  if (!m || !forecastRange) return;
  var pos = ((Date.now() - forecastRange.start) / 3600000) / forecastRange.count * 100;
  m.style.left = Math.max(0.3, Math.min(99.5, pos)).toFixed(2) + "%";
}

/* ---------- Getij ----------
   Nieuw in 3.6: eerst hoog- en laagwater bepalen (met parabolische interpolatie
   en filtering van kleine rimpels), daarna pas de status. Daardoor kunnen
   "opkomend/afgaand" en de getoonde eb/vloed-tijden elkaar niet meer tegenspreken. */
function findExtremes(t, v) {
  var ext = [];
  for (var i = 1; i < v.length - 1; i++) {
    var a = v[i - 1], b = v[i], c = v[i + 1];
    if (!isFinite(a) || !isFinite(b) || !isFinite(c)) continue;
    var isHigh = b >= a && b > c, isLow = b <= a && b < c;
    if (!isHigh && !isLow) continue;
    var denom = a - 2 * b + c;
    var off = denom !== 0 ? 0.5 * (a - c) / denom : 0;
    if (off > 0.5) off = 0.5; if (off < -0.5) off = -0.5;
    var step = t[i + 1] - t[i];
    ext.push({ type: isHigh ? "high" : "low", t: t[i] + off * step, v: b - 0.25 * (a - c) * off });
  }
  // Rimpels (<20 cm verschil) weghalen; herhalen tot stabiel.
  var changed = true;
  while (changed) {
    changed = false;
    for (var j = 0; j < ext.length - 1; j++) {
      if (ext[j].type === ext[j + 1].type) {
        var keep = ext[j].type === "high" ? (ext[j].v >= ext[j + 1].v ? j : j + 1) : (ext[j].v <= ext[j + 1].v ? j : j + 1);
        ext.splice(keep === j ? j + 1 : j, 1); changed = true; break;
      }
      if (Math.abs(ext[j].v - ext[j + 1].v) < 0.2) { ext.splice(j, 2); changed = true; break; }
    }
  }
  return ext;
}
function interp(t, v, at) {
  for (var i = 0; i < t.length - 1; i++) {
    if (at >= t[i] && at <= t[i + 1]) {
      var f = (at - t[i]) / (t[i + 1] - t[i]);
      return v[i] + (v[i + 1] - v[i]) * f;
    }
  }
  return NaN;
}
function renderTide(hourly) {
  var t = toMs(hourly && hourly.time);
  var raw = (hourly && hourly.sea_level_height_msl) || [];
  var v = [];
  for (var i = 0; i < raw.length; i++) v.push(raw[i] === null ? NaN : Number(raw[i]));
  if (t.length < 6 || v.length !== t.length) {
    setText("tideState", "Getij niet beschikbaar");
    setText("nextHighTide", "--:--"); setText("nextLowTide", "--:--");
    $("tideSparkLine").setAttribute("points", "");
    return;
  }
  var now = Date.now();
  var ext = findExtremes(t, v);
  var prev = null, nextHigh = null, nextLow = null, next = null;
  for (var k = 0; k < ext.length; k++) {
    if (ext[k].t <= now) prev = ext[k];
    else {
      if (!next) next = ext[k];
      if (!nextHigh && ext[k].type === "high") nextHigh = ext[k];
      if (!nextLow && ext[k].type === "low") nextLow = ext[k];
    }
  }
  var state;
  var near = function (e) { return e && Math.abs(e.t - now) <= 30 * 60 * 1000; };
  if (near(prev) || near(next)) {
    var e = near(prev) ? prev : next;
    state = e.type === "high" ? "Hoogwater" : "Laagwater";
  } else if (next) {
    state = next.type === "high" ? "Opkomend water" : "Afgaand water";
  } else if (prev) {
    state = prev.type === "low" ? "Opkomend water" : "Afgaand water";
  } else {
    state = "Getij onbekend";
  }
  setText("tideState", state);
  setText("nextHighTide", nextHigh ? hhmm(nextHigh.t) : "--:--");
  setText("nextLowTide", nextLow ? hhmm(nextLow.t) : "--:--");

  // Sparkline: 6 uur terug t/m 18 uur vooruit.
  var from = now - 6 * 3600000, to = now + 18 * 3600000;
  var pts = [], vals = [];
  for (var j = 0; j < t.length; j++) if (t[j] >= from - 3600000 && t[j] <= to + 3600000 && isFinite(v[j])) vals.push(v[j]);
  if (vals.length < 2) return;
  var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  var span = Math.max(max - min, 0.1);
  var W = 240, H = 80, P = 8;
  function y(val) { return P + (1 - (val - min) / span) * (H - 2 * P); }
  function x(ms) { return (ms - from) / (to - from) * W; }
  for (var n = 0; n < t.length; n++) {
    if (t[n] < from - 3600000 || t[n] > to + 3600000 || !isFinite(v[n])) continue;
    pts.push(x(t[n]).toFixed(1) + "," + y(v[n]).toFixed(1));
  }
  $("tideSparkLine").setAttribute("points", pts.join(" "));
  var cur = interp(t, v, now);
  var nx = x(now).toFixed(1);
  $("tideNowLine").setAttribute("x1", nx); $("tideNowLine").setAttribute("x2", nx);
  $("tideSparkNow").setAttribute("cx", nx);
  $("tideSparkNow").setAttribute("cy", isFinite(cur) ? y(cur).toFixed(1) : H / 2);
}

/* ---------- Zee ---------- */
function nearestIndex(t) {
  var now = Date.now(), best = -1, dist = Infinity;
  for (var i = 0; i < t.length; i++) { var d = Math.abs(t[i] - now); if (d < dist) { dist = d; best = i; } }
  return best;
}
function renderMarine(m) {
  var cur = m.current || {};
  var hourly = m.hourly || {};
  setText("waveHeight", num(cur.wave_height, 1) + " m");
  setText("waveDirection", "uit " + compass(cur.wave_direction));
  setText("wavePeriod", num(cur.wave_period, 1) + " s");
  var idx = nearestIndex(toMs(hourly.time));
  setText("waterTemperature", num(get(hourly, ["sea_surface_temperature", idx], null), 1) + "°");
  renderTide(hourly);
}

/* ---------- Reddingsbrigade ---------- */
function findPost(posts, terms) {
  for (var i = 0; i < posts.length; i++) {
    var name = String((posts[i] && posts[i].name) || "").toLowerCase();
    for (var j = 0; j < terms.length; j++) if (name.indexOf(terms[j]) >= 0) return posts[i];
  }
  return null;
}
function severity(post) {
  var text = [post.flag_text, post.flag_extended_text, post.state_text, post.state].join(" ").toLowerCase();
  if (/verboden|niet zwemmen|zeer gevaarlijk|rode vlag|red flag/.test(text)) return "danger";
  if (post.flag_status === true || /waarschuwing|gevaarlijk|gele vlag|oranje vlag|warning/.test(text)) return "warning";
  return "clear";
}
function renderPost(post, label, unavailable) {
  if (!post) {
    return '<div class="post"><div class="post-top"><h3>' + label + '</h3><span class="post-status">STATUS ONBEKEND</span></div>' +
      '<div class="post-flag"><span class="flag-icon">?</span><div>' +
      (unavailable ? "Geen live verbinding met Strand App" : "Post niet gevonden") +
      '<span class="ext">Let op de vlaggen bij de strandpost</span></div></div></div>';
  }
  var active = post.state_status === true;
  var sev = severity(post);
  var flag;
  if (!post.flag_status) {
    flag = '<span class="flag-icon">✓</span><div>Geen actieve waarschuwing</div>';
  } else {
    var img = post.flag_img_no_text || post.flag_img || "";
    var text = String(post.flag_text || "Waarschuwing actief").replace(/^let op[!:\s-]*/i, "").replace(/\s+/g, " ");
    flag = (img ? '<img src="' + escapeHtml(img) + '" alt="">' : '<span class="flag-icon">' + (sev === "danger" ? "⛔" : "⚠") + "</span>") +
      "<div>" + escapeHtml(text) + (post.flag_extended_text ? '<span class="ext">' + escapeHtml(post.flag_extended_text) + "</span>" : "") + "</div>";
  }
  return '<div class="post ' + sev + '"><div class="post-top"><h3>' + label + "</h3>" +
    '<span class="post-status ' + (active ? "on" : "off") + '">' + (active ? "BEWAAKT" : "NIET BEWAAKT") + "</span></div>" +
    '<div class="post-flag">' + flag + "</div></div>";
}
function renderRescue(posts, unavailable) {
  var list = posts instanceof Array ? posts : [];
  var north = findPost(list, ["zvt noord", "zandvoort noord"]) || findPost(list, ["noord"]);
  var south = findPost(list, ["zvt zuid", "zandvoort zuid"]) || findPost(list, ["zuid"]);
  $("rescuePosts").innerHTML = renderPost(north, "▲ NOORD", unavailable) + renderPost(south, "▼ ZUID", unavailable);
}

/* ---------- Strandadvies ---------- */
function buildAdvice(w) {
  var cur = (w && w.current) || {};
  var t = Number(cur.temperature_2m), wind = Number(cur.wind_speed_10m), gusts = Number(cur.wind_gusts_10m);
  var code = Number(cur.weather_code), hour = new Date().getHours();
  var lines;
  if (code >= 95) lines = ["Onweer boven zee. Zoek een veilige plek binnen.", "Bliksem aan de kust: volg de aanwijzingen ter plaatse."];
  else if ([61,63,65,80,81,82].indexOf(code) >= 0) lines = ["Tropische bui aan zee. Binnen blijft de sfeer zonnig.", "Regen op het zand, warme Latin sfeer binnen.", "Buien boven playa Zandvoort. Neem je tijd."];
  else if (wind >= 35 || gusts >= 50) lines = ["Stevige zeewind. Houd losse spullen goed vast.", "Wind in je haar, uitzicht op zee."];
  else if (sky.isNight || hour >= 20) lines = ["De zon zakt, la noche begint.", "Avond aan zee. Sin prisa, geen haast."];
  else if (t >= 23) lines = ["Sol, playa, Zandvoort. SPF niet vergeten.", "Strandweer met hoofdletters. Zoek ook de schaduw op.", "Dit is waarom Mango's aan zee zit."];
  else if (t < 16) lines = ["Fris aan zee. De tropische sfeer blijft warm.", "Trui aan, uitzicht aan. Buena idea."];
  else if ([0,1,2].indexOf(code) >= 0) lines = ["Genoeg zon voor la terraza. De rest regelen wij.", "Golven aan. Modo vacaciones aan.", "Zeezicht inbegrepen. Buen humor aanbevolen."];
  else lines = ["De zon doet rustig aan. Mango's houdt de kleur erin.", "Geen perfect strandweer nodig voor een fijne stranddag.", "Zand onder je voeten. Caribe aan de kust."];
  return lines[Math.floor(Date.now() / 3600000) % lines.length];
}

/* ---------- Cache ---------- */
function saveCache(data) { try { localStorage.setItem(CONFIG.cacheKey, JSON.stringify({ at: Date.now(), data: data })); } catch (e) {} }
function loadCache() { try { var c = JSON.parse(localStorage.getItem(CONFIG.cacheKey) || "null"); return c ? c.data : null; } catch (e) { return null; } }

function setConnection(online, text) {
  var el = $("connectionState");
  if (el) el.className = "connection" + (online ? " online" : "");
  setText("connectionText", text);
}

/* ---------- Hoofdlus ---------- */
var refreshTimer = null;
function scheduleLoad(ms) { clearTimeout(refreshTimer); refreshTimer = setTimeout(loadDashboard, ms); }

function loadDashboard() {
  setConnection(false, "Gegevens verversen…");
  Promise.all([settle(loadWeather()), settle(fetchJson(CONFIG.marineUrl)), settle(loadBeachPosts())]).then(function (r) {
    var cache = loadCache() || {};
    var weather = r[0].ok ? r[0].value : cache.weather;
    var marine = r[1].ok ? r[1].value : cache.marine;
    var posts = r[2].ok ? r[2].value : cache.posts;

    if (weather) {
      safe("weer nu", function () { renderNow(weather); });
      safe("uurverwachting", function () { renderHourly(weather.hourly); });
    } else {
      safe("uurverwachting leeg", function () { $("hourlyForecast").innerHTML = '<div class="placeholder">Verwachting tijdelijk niet beschikbaar</div>'; });
    }
    if (marine) safe("zee", function () { renderMarine(marine); });
    else safe("getij leeg", function () { renderTide(null); });
    safe("reddingsbrigade", function () { renderRescue(posts, !r[2].ok && !posts); });
    safe("advies", function () { setText("beachAdvice", buildAdvice(weather)); });

    saveCache({ weather: weather, marine: marine, posts: posts });
    var live = [r[0].ok, r[1].ok, r[2].ok];
    var okCount = live.filter(Boolean).length;
    if (okCount === 3) setConnection(true, "Live · bijgewerkt " + hhmm(Date.now()));
    else if (okCount > 0) setConnection(true, "Deels live · " + hhmm(Date.now()) + (r[2].ok ? "" : " · Strand App offline"));
    else setConnection(false, weather ? "Offline · laatst bekende gegevens" : "Geen verbinding");

    scheduleLoad(r[0].ok || r[1].ok ? CONFIG.refreshMs : CONFIG.retryMs);
  }).catch(function (err) {
    if (window.console) console.error("[Mango's] laden mislukt", err);
    setConnection(false, "Fout bij laden · opnieuw proberen");
    scheduleLoad(CONFIG.retryMs);
  });
}

/* ---------- Focus-animatie condities (rustig, zonder overlap) ---------- */
var focusIndex = 0;
function cycleFocus() {
  var items = document.querySelectorAll(".conditions .cond");
  for (var i = 0; i < items.length; i++) items[i].className = items[i].className.replace(/\s?is-focus/g, "");
  if (document.documentElement.getAttribute("data-mode") !== "tv" || !items.length) return;
  items[focusIndex % items.length].className += " is-focus";
  focusIndex++;
}

/* ---------- Start ---------- */
fitStage();
updateClock();
setInterval(updateClock, 1000);
setInterval(cycleFocus, 4000);
loadDashboard();
setTimeout(function () { window.location.reload(); }, CONFIG.hardReloadMs);
window.addEventListener("resize", fitStage);
window.addEventListener("load", fitStage);
setTimeout(fitStage, 500); setTimeout(fitStage, 2000);
setInterval(fitStage, 5000);
document.addEventListener("visibilitychange", function () { if (!document.hidden) loadDashboard(); });
