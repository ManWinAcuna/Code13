/* Code13's generalized Compatibility flow (2026-08-10). One question up
   front - "What are you comparing with?" Person / Object / Place - instead
   of numerology-app's today/date/imprint mode split, per the locked launch
   spec. All scoring reuses the established engines untouched:
   computeCompatibility (compat-engine.js) + computeDeepCompatibility
   (deep-compat.js) + renderCompatHero (compat-render.js). Person mode runs
   the person-vs-person deep blend; Object/Place run the event-date imprint
   blend - the same isPersonMode fork numerology-app's own modes use.

   Name lookups reuse db-core.js's real Wikipedia/Wikidata infra:
   - Person:  Wikipedia opensearch suggestions (famous.js's pattern) ->
              fetchWikidataId -> fetchKeyDate (P569 birth date)
   - Object:  lookupKeyDateByNameWithTitle with the prose fallback ON
              (founded/opened/released, same chain EMAX trusts)
   - Place:   lookupPlaceFoundingDate (country-fallback rule: a city
              resolves through its country's founding/union date first) */

let mode = null; // 'person' | 'object' | 'place'

const modeSelectEl = document.getElementById('modeSelect');
const compatFormEl = document.getElementById('compatForm');
const personInputsEl = document.getElementById('personInputs');
const compatResultsEl = document.getElementById('compatResults');
const compatModalOverlayEl = document.getElementById('compatModalOverlay');

function closeCompatModal() {
  compatModalOverlayEl.classList.remove('active');
}
document.getElementById('compatModalClose').addEventListener('click', closeCompatModal);
compatModalOverlayEl.addEventListener('click', (e) => {
  if (e.target === compatModalOverlayEl) closeCompatModal();
});

/* ---------------- Wikipedia lookup cache ----------------
   Launch-spec requirement: the personal tool's lookup volume was one
   user; a store app's isn't. Successful name->date resolutions are
   cached in localStorage so repeat lookups (the same famous person,
   the same company every curious new user tries) never re-hit
   Wikipedia/Wikidata. Founding/birth dates don't change, so entries
   have no TTL - just a size cap, trimmed oldest-first. */
const LOOKUP_CACHE_KEY = 'code13_lookup_cache_v1';
const LOOKUP_CACHE_MAX = 400;

function readLookupCache() {
  try { return JSON.parse(localStorage.getItem(LOOKUP_CACHE_KEY)) || {}; } catch (e) { return {}; }
}

function cacheGet(kind, name) {
  const hit = readLookupCache()[kind + ':' + name.toLowerCase()];
  return hit || null;
}

function cachePut(kind, name, result) {
  const cache = readLookupCache();
  cache[kind + ':' + name.toLowerCase()] = { ...result, ts: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > LOOKUP_CACHE_MAX) {
    keys.sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0))
      .slice(0, keys.length - LOOKUP_CACHE_MAX)
      .forEach((k) => { delete cache[k]; });
  }
  try { localStorage.setItem(LOOKUP_CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* storage full - lookups still work uncached */ }
}

/* ---------------- Input blocks ---------------- */

const MODE_COPY = {
  person: { label: 'Their birthday', search: 'Search a famous person...', verb: 'born' },
  object: { label: 'Its start date', search: 'Search a company, movie, brand...', verb: 'founded' },
  place: { label: 'Its founding date', search: 'Search a city, state, country...', verb: 'founded' },
};

// Place mode's "United States" quick-pick (2026-08-26, user: "a second
// potential entry pill... united states, and other country"). Every name
// here already resolves instantly through lookupPlaceFoundingDate's
// pinned US_PLACE_DATES table (db-core.js) - no network round trip, same
// path a typed-and-selected search result uses. City order matches the
// owner's source file (largest-by-recent-Census-estimate first, not
// necessarily traditional "biggest city" assumptions).
const US_PLACES = [
  { state: 'Alabama', cities: ['Huntsville', 'Birmingham'] },
  { state: 'Alaska', cities: ['Anchorage', 'Fairbanks'] },
  { state: 'Arizona', cities: ['Phoenix', 'Tucson'] },
  { state: 'Arkansas', cities: ['Little Rock', 'Fayetteville'] },
  { state: 'California', cities: ['Los Angeles', 'San Diego'] },
  { state: 'Colorado', cities: ['Denver', 'Colorado Springs'] },
  { state: 'Connecticut', cities: ['Bridgeport', 'Stamford'] },
  { state: 'Delaware', cities: ['Wilmington', 'Dover'] },
  { state: 'Florida', cities: ['Jacksonville', 'Miami'] },
  { state: 'Georgia', cities: ['Atlanta', 'Columbus'] },
  { state: 'Hawaii', cities: ['Honolulu', 'Hilo'] },
  { state: 'Idaho', cities: ['Boise', 'Meridian'] },
  { state: 'Illinois', cities: ['Chicago', 'Aurora'] },
  { state: 'Indiana', cities: ['Indianapolis', 'Fort Wayne'] },
  { state: 'Iowa', cities: ['Des Moines', 'Cedar Rapids'] },
  { state: 'Kansas', cities: ['Wichita', 'Overland Park'] },
  { state: 'Kentucky', cities: ['Louisville', 'Lexington'] },
  { state: 'Louisiana', cities: ['New Orleans', 'Baton Rouge'] },
  { state: 'Maine', cities: ['Portland', 'Lewiston'] },
  { state: 'Maryland', cities: ['Baltimore', 'Frederick'] },
  { state: 'Massachusetts', cities: ['Boston', 'Worcester'] },
  { state: 'Michigan', cities: ['Detroit', 'Grand Rapids'] },
  { state: 'Minnesota', cities: ['Minneapolis', 'Saint Paul'] },
  { state: 'Mississippi', cities: ['Jackson', 'Gulfport'] },
  { state: 'Missouri', cities: ['Kansas City', 'St. Louis'] },
  { state: 'Montana', cities: ['Billings', 'Missoula'] },
  { state: 'Nebraska', cities: ['Omaha', 'Lincoln'] },
  { state: 'Nevada', cities: ['Las Vegas', 'Henderson'] },
  { state: 'New Hampshire', cities: ['Manchester', 'Nashua'] },
  { state: 'New Jersey', cities: ['Newark', 'Jersey City'] },
  { state: 'New Mexico', cities: ['Albuquerque', 'Las Cruces'] },
  { state: 'New York', cities: ['New York City', 'Buffalo'] },
  { state: 'North Carolina', cities: ['Charlotte', 'Raleigh'] },
  { state: 'North Dakota', cities: ['Fargo', 'Bismarck'] },
  { state: 'Ohio', cities: ['Columbus', 'Cleveland'] },
  { state: 'Oklahoma', cities: ['Oklahoma City', 'Tulsa'] },
  { state: 'Oregon', cities: ['Portland', 'Eugene'] },
  { state: 'Pennsylvania', cities: ['Philadelphia', 'Pittsburgh'] },
  { state: 'Rhode Island', cities: ['Providence', 'Warwick'] },
  { state: 'South Carolina', cities: ['Charleston', 'Columbia'] },
  { state: 'South Dakota', cities: ['Sioux Falls', 'Rapid City'] },
  { state: 'Tennessee', cities: ['Nashville', 'Memphis'] },
  { state: 'Texas', cities: ['Houston', 'San Antonio'] },
  { state: 'Utah', cities: ['Salt Lake City', 'West Valley City'] },
  { state: 'Vermont', cities: ['Burlington', 'South Burlington'] },
  { state: 'Virginia', cities: ['Virginia Beach', 'Chesapeake'] },
  { state: 'Washington', cities: ['Seattle', 'Spokane'] },
  { state: 'West Virginia', cities: ['Charleston', 'Huntington'] },
  { state: 'Wisconsin', cities: ['Milwaukee', 'Madison'] },
  { state: 'Wyoming', cities: ['Cheyenne', 'Casper'] },
];

// Real photos, "literally just like emax" (user, 2026-08-26) - same
// technique as emax-popup.js's emaxFetchImage: Wikipedia's page/summary
// endpoint returns a real thumbnail in one request, no key needed. A
// second attempt (Wikidata's P18 claim, the same fetchPersonImageUrl
// chain Famous Lookup's photo pill already uses) catches the handful the
// summary endpoint alone misses. Cached in localStorage (place names
// don't change) so browsing the grid twice never re-fetches. A miss (or
// offline) leaves the colored-initials monogram fallback up - never a
// broken image or a guessed picture. v2 key (2026-08-27, was v1) - the
// old cache had 3 permanent nulls cached for titles that only failed
// because they were ambiguous (see US_STATE_IMAGE_TITLE below), and
// hasOwnProperty short-circuits a cached null forever.
const US_PLACE_IMAGE_CACHE_KEY = 'code13_us_place_images_v2';
let usPlaceImageCache = {};
try { usPlaceImageCache = JSON.parse(localStorage.getItem(US_PLACE_IMAGE_CACHE_KEY)) || {}; } catch (e) { /* ignore */ }

// A bare state name isn't always Wikipedia's primary topic for that exact
// title - Georgia the country, Washington D.C./George Washington, and New
// York City all outrank the U.S. state on the plain title, so the summary
// endpoint either 404s or returns the WRONG entity's photo. These 3 are
// the only collisions among the 50 (checked live, 2026-08-27) - every
// other state name is unambiguous.
const US_STATE_IMAGE_TITLE = {
  Georgia: 'Georgia (U.S. state)',
  'New York': 'New York (state)',
  Washington: 'Washington (state)',
};

function fetchPlaceImage(title) {
  if (Object.prototype.hasOwnProperty.call(usPlaceImageCache, title)) return Promise.resolve(usPlaceImageCache[title]);
  return fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    .then((res) => res.json())
    .then((data) => (data.thumbnail && data.thumbnail.source) || null)
    .catch(() => null)
    .then((url) => (url ? url : fetchWikidataId(title).then((qid) => (qid ? fetchPersonImageUrl(qid) : null)).catch(() => null)))
    .then((url) => {
      usPlaceImageCache[title] = url;
      try { localStorage.setItem(US_PLACE_IMAGE_CACHE_KEY, JSON.stringify(usPlaceImageCache)); } catch (e) { /* storage full - refetch next time */ }
      return url;
    });
}

// Same monogram EMAX itself falls back to (emax-popup.js's emaxMonogram) -
// a deterministic color from the name's own characters, not random, so
// the same place always gets the same fallback tint.
function placeMonogram(name) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `<div class="emax-monogram" style="--emax-hue:${hue}">${escapeHtml(initials)}</div>`;
}

// A handful of city names collide with a DIFFERENT state's pinned entry
// in db-core.js's flat US_PLACE_DATES map, since a plain city name isn't
// unique across states. "columbus" alone is pinned to Ohio's exact
// Feb 14, 1812 date - but Georgia's own Columbus only has a YEAR (1828)
// in the source PDF and must never silently inherit Ohio's day-exact one
// (checked against the source PDF text, 2026-08-27 - the only such
// collision among all 100 cities). Skipped cities fall through to a
// disambiguated "City, State" live lookup instead, same fix as the image
// title override above.
const US_CITY_PINNED_SKIP = new Set(['georgia::columbus']);

function resolvePlaceTileDate(name, stateName) {
  if (!stateName) return lookupPlaceFoundingDate(name); // states: all 50 pinned, unambiguous
  const skipKey = `${stateName.toLowerCase()}::${name.toLowerCase()}`;
  if (!US_CITY_PINNED_SKIP.has(skipKey)) {
    const pinned = lookupPinnedPlaceDate(name);
    if (pinned) return Promise.resolve(pinned);
  }
  return lookupPlaceFoundingDate(`${name}, ${stateName}`);
}

// Cache key includes the state so two different states' same-named city
// (Columbus, Portland, Charleston...) never overwrite each other's
// resolved date while both happen to be in memory at once.
function placeCacheKey(name, stateName) {
  return stateName ? `${stateName}::${name}` : name;
}

const placeDateCache = {}; // placeCacheKey -> { date, kind, via } | null

// Compact version of EMAX's own tile-corner score ring (emax-category.js's
// emaxRowScoreHtml) - the "little wheel that shows compatibility without
// even having to click them" (user, 2026-08-27). null (no birthday yet, or
// the date hasn't resolved) keeps the plain dash - a ring with nothing to
// show would be misleading.
function placeScoreRingHtml(score) {
  if (score == null) return '<div class="emax-score dim">&mdash;</div>';
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  return `
    <div class="emax-row-score">
      <svg viewBox="0 0 44 44" class="emax-row-score-ring ${scoreClass(score)}">
        <circle cx="22" cy="22" r="${r}" class="emax-row-score-ring-track"></circle>
        <circle cx="22" cy="22" r="${r}" class="emax-row-score-ring-fill" style="stroke-dasharray:${circumference};stroke-dashoffset:${offset};"></circle>
      </svg>
      <div class="emax-row-score-num">${score}</div>
    </div>`;
}

function currentYouDateISO() {
  const input = document.querySelector('#usPlacesYouRow .person-date[data-person="A"]');
  return input ? displayToISO(input.value) : null;
}

// deepScore (not the plain finalScore) so the wheel always matches the
// headline number the tap-through popup shows for the same pairing.
function tileScoreFromDates(dateAISO, placeDateISO) {
  if (!dateAISO || !placeDateISO) return null;
  const dateA = parseDateInput(dateAISO);
  const dateB = parseDateInput(placeDateISO);
  return computeDeepCompatibility(dateA, dateB, false).deepScore;
}

function refreshTileBadge(key) {
  const badge = document.getElementById(`usPlaceBadge-${key}`);
  if (!badge) return;
  const info = placeDateCache[key];
  const score = tileScoreFromDates(currentYouDateISO(), info && info.date);
  badge.innerHTML = placeScoreRingHtml(score);
}

function loadPlaceScore(name, stateName) {
  const key = placeCacheKey(name, stateName);
  return resolvePlaceTileDate(name, stateName).then((info) => {
    placeDateCache[key] = info;
    refreshTileBadge(key);
  });
}

// Best-to-worst (user, 2026-08-27: "make it also auto organize from best
// to worst") - same ordering rule as EMAX's own scoredEntries(): highest
// score first, scoreless entries sort last, alphabetical among themselves
// (so the grid is never scrambled while dates are still resolving or
// before a birthday's been typed in at all).
function sortPlacesByScore(names, stateName, dateAISO) {
  return names
    .map((name) => {
      const info = placeDateCache[placeCacheKey(name, stateName)];
      return { name, score: tileScoreFromDates(dateAISO, info && info.date) };
    })
    .sort((a, b) => {
      if (a.score == null && b.score == null) return a.name.localeCompare(b.name);
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score;
    })
    .map((x) => x.name);
}

// Renders every tile with the monogram fallback immediately (instant),
// or the already-cached photo if one's been fetched before (a repaint -
// re-sorting - must never regress an already-loaded photo back to its
// placeholder). .emax-tile-circle + the .logo media treatment
// (object-fit:contain, not cover) keeps a landscape flag/skyline photo
// fully visible instead of harshly cropped into a tall poster frame
// (user, 2026-08-27: "the pictures arent fully fitting it theyre cropped
// weird").
function placeTileHtml(name, key, imageUrl, extra) {
  const media = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">` : placeMonogram(name);
  return `
    <div class="emax-tile emax-tile-circle" ${extra}>
      <div class="emax-tile-media logo">
        <div class="emax-tile-media-img" id="usPlaceThumb-${escapeHtml(key)}">${media}</div>
        <div class="emax-tile-badge" id="usPlaceBadge-${escapeHtml(key)}">${placeScoreRingHtml(null)}</div>
      </div>
      <div class="emax-tile-info">
        <div class="emax-tile-name">${escapeHtml(name)}</div>
      </div>
    </div>
  `;
}

function cachedPlaceImageUrl(queryTitle) {
  return Object.prototype.hasOwnProperty.call(usPlaceImageCache, queryTitle) ? usPlaceImageCache[queryTitle] : null;
}

function loadPlaceThumb(key, queryTitle) {
  fetchPlaceImage(queryTitle).then((url) => {
    if (!url) return;
    const el = document.getElementById(`usPlaceThumb-${key}`);
    if (el) el.innerHTML = `<img src="${escapeHtml(url)}" alt="" loading="lazy">`;
  });
}

// "or pick a city" sits under each tile's name, added after the grid
// paints so it doesn't fight the tile's own click target.
function attachCityLinks() {
  document.querySelectorAll('#usPlacesGrid .emax-tile[data-state]').forEach((tile) => {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'us-cities-link';
    link.dataset.state = tile.dataset.state;
    link.textContent = 'or pick a city';
    tile.querySelector('.emax-tile-info').appendChild(link);
  });
}

// Which back-target #usPlacesBack resolves to - 'states' backs all the way
// out to the country picker, 'cities' backs up one level to the states grid.
let usPlacesLevel = 'states';
let usPlacesCurrentState = null;

// Paints from whatever's already known (placeDateCache/usPlaceImageCache) -
// no new fetches - so it's safe to call on every resort (birthday typed,
// or a batch of date lookups just resolved) without re-requesting
// anything or flashing already-loaded photos back to their placeholder.
function paintUsStatesGrid() {
  const dateAISO = currentYouDateISO();
  const names = dateAISO ? sortPlacesByScore(US_PLACES.map((p) => p.state), null, dateAISO) : US_PLACES.map((p) => p.state);
  document.getElementById('usPlacesHeading').textContent = 'A U.S. State';
  document.getElementById('usPlacesGrid').innerHTML = names.map((name) => {
    const key = placeCacheKey(name, null);
    const imageUrl = cachedPlaceImageUrl(US_STATE_IMAGE_TITLE[name] || name);
    return placeTileHtml(name, key, imageUrl, `data-state="${escapeHtml(name)}"`);
  }).join('');
  attachCityLinks();
  names.forEach((name) => refreshTileBadge(placeCacheKey(name, null)));
}

function renderUsStatesGrid() {
  usPlacesLevel = 'states';
  usPlacesCurrentState = null;
  paintUsStatesGrid();
  const resolved = US_PLACES.map((p) => loadPlaceScore(p.state, null));
  US_PLACES.forEach((p) => loadPlaceThumb(placeCacheKey(p.state, null), US_STATE_IMAGE_TITLE[p.state] || p.state));
  Promise.all(resolved).then(resortUsPlacesGrid);
}

function paintUsCitiesGrid(stateName) {
  const place = US_PLACES.find((p) => p.state === stateName);
  if (!place) return;
  const dateAISO = currentYouDateISO();
  const cities = dateAISO ? sortPlacesByScore(place.cities, stateName, dateAISO) : place.cities;
  document.getElementById('usPlacesHeading').textContent = stateName;
  document.getElementById('usPlacesGrid').innerHTML = cities.map((city) => {
    const key = placeCacheKey(city, stateName);
    const imageUrl = cachedPlaceImageUrl(`${city}, ${stateName}`);
    return placeTileHtml(city, key, imageUrl, `data-city="${escapeHtml(city)}" data-state="${escapeHtml(stateName)}"`);
  }).join('');
  cities.forEach((city) => refreshTileBadge(placeCacheKey(city, stateName)));
}

// User's call, 2026-08-26: tapping a state selects it right away - the
// "or pick a city" link on each tile is the one way into this drill-down.
function renderUsCitiesGrid(stateName) {
  const place = US_PLACES.find((p) => p.state === stateName);
  if (!place) return;
  usPlacesLevel = 'cities';
  usPlacesCurrentState = stateName;
  paintUsCitiesGrid(stateName);
  const resolved = place.cities.map((city) => loadPlaceScore(city, stateName));
  place.cities.forEach((city) => loadPlaceThumb(placeCacheKey(city, stateName), `${city}, ${stateName}`));
  Promise.all(resolved).then(resortUsPlacesGrid);
}

// Repaints (and so re-sorts) whichever level is currently on screen, from
// data that's already resolved - never kicks off new fetches itself, so
// it's safe to call both after a batch of lookups resolves and on every
// birthday keystroke without runaway re-fetching.
function resortUsPlacesGrid() {
  if (usPlacesScreenEl.style.display === 'none') return; // navigated away already
  if (usPlacesLevel === 'cities') paintUsCitiesGrid(usPlacesCurrentState);
  else paintUsStatesGrid();
}

let usPlacesResortTimer = null;
function scheduleUsPlacesResort() {
  clearTimeout(usPlacesResortTimer);
  usPlacesResortTimer = setTimeout(resortUsPlacesGrid, 200);
}

// Tapping any tile calculates and opens the results popup immediately -
// "you can calculate compatibility from there no need to autograb the
// date and make you calculate again" (user, 2026-08-27). Uses the same
// runCompatCalculation the Calculate button itself calls, so the popup is
// pixel-identical either way.
function handlePlaceTileTap(name, stateNameOrNull) {
  const dateAISO = currentYouDateISO();
  if (!dateAISO) { alert('Enter your birthday above first.'); return; }
  const nameA = document.querySelector('#usPlacesYouRow .person-name[data-person="A"]').value.trim() || 'You';
  const key = placeCacheKey(name, stateNameOrNull);
  const cached = placeDateCache[key];
  const infoPromise = (cached && cached.date) ? Promise.resolve(cached) : resolvePlaceTileDate(name, stateNameOrNull);
  infoPromise.then((info) => {
    if (!info || !info.date) { alert(`No exact date found for ${name} yet - try again in a moment, or search for it manually.`); return; }
    placeDateCache[key] = info;
    runCompatCalculation(dateAISO, info.date, nameA, name);
  });
}

// Delegated once on the static grid element - its innerHTML is swapped
// between the states grid and a state's cities grid, so listeners bound
// to individual tiles would be lost on every re-render.
document.getElementById('usPlacesGrid').addEventListener('click', (e) => {
  const citiesLink = e.target.closest('.us-cities-link');
  if (citiesLink) {
    e.stopPropagation();
    renderUsCitiesGrid(citiesLink.dataset.state);
    return;
  }
  const cityTile = e.target.closest('.emax-tile[data-city]');
  if (cityTile) {
    handlePlaceTileTap(cityTile.dataset.city, cityTile.dataset.state);
    return;
  }
  const stateTile = e.target.closest('.emax-tile[data-state]');
  if (stateTile) handlePlaceTileTap(stateTile.dataset.state, null);
});

const usPlacesScreenEl = document.getElementById('usPlacesScreen');
const usPlacesTitleRowEl = document.getElementById('usPlacesTitleRow');

// Reworked 2026-08-27 from a modal-overlay popup into a real full-screen
// section (user: "the whole thing shouldnt be a popup it should just take
// you into its own screen with the states") - same display-swap pattern
// modeSelect/placeCountrySelect already use, not .active on an overlay.
function openUsPlacesScreen() {
  personInputsEl.innerHTML = ''; // only one Person-A field lives in the DOM at a time
  usPlacesTitleRowEl.style.display = '';
  usPlacesScreenEl.style.display = '';
  const youRow = document.getElementById('usPlacesYouRow');
  youRow.innerHTML = youInputHTML();
  const dateInput = youRow.querySelector('.person-date[data-person="A"]');
  attachDateMask(dateInput);
  dateInput.addEventListener('input', scheduleUsPlacesResort);
  renderUsStatesGrid();
}

document.getElementById('usPlacesBack').addEventListener('click', (e) => {
  e.preventDefault();
  if (usPlacesLevel === 'cities') {
    renderUsStatesGrid();
    return;
  }
  usPlacesTitleRowEl.style.display = 'none';
  usPlacesScreenEl.style.display = 'none';
  document.getElementById('usPlacesYouRow').innerHTML = '';
  placeCountryTitleRowEl.style.display = '';
  placeCountrySelectEl.style.display = 'grid';
});

// "You" side: birthday only, prefilled from the saved profile so a
// returning user never retypes their own date. The other side is
// mode-shaped: a Wikipedia-backed name search (with a per-row status
// line for the async date resolution) or plain manual entry; person
// mode also offers the user's own saved Database people.
function youInputHTML() {
  const profile = loadProfile();
  const prefill = profile && profile.date ? isoToDisplay(profile.date) : '';
  return `
    <div class="person-input box" data-person="A">
      <div class="box-label">You</div>
      <div class="inline-form">
        <input type="text" class="person-name" data-person="A" placeholder="Name (optional)">
        <input type="text" class="person-date" data-person="A" inputmode="numeric" placeholder="MM/DD/YYYY" maxlength="10" autocomplete="off" value="${prefill}">
      </div>
    </div>
  `;
}

function otherInputHTML() {
  const copy = MODE_COPY[mode];
  const dbOption = mode === 'person' ? '<option value="database">🗂 My Database</option>' : '';
  return `
    <div class="person-input box" data-person="B">
      <div class="box-label">${copy.label}</div>
      <select class="db-picker source-picker" data-person="B">
        <option value="wiki">🔎 Look up by name</option>
        ${dbOption}
        <option value="manual">✍️ Type the date myself</option>
      </select>
      <div class="player-search-wrap source-search-wrap" data-person="B">
        <input type="text" class="player-search source-search" data-person="B" placeholder="${copy.search}" autocomplete="off">
        <div class="player-suggestions source-suggestions" data-person="B"></div>
      </div>
      <div class="famous-status" id="lookupStatus"></div>
      <div class="inline-form">
        <input type="text" class="person-name" data-person="B" placeholder="Name">
        <input type="text" class="person-date" data-person="B" inputmode="numeric" placeholder="MM/DD/YYYY" maxlength="10" autocomplete="off">
      </div>
    </div>
  `;
}

function setLookupStatus(message, isError) {
  const el = document.getElementById('lookupStatus');
  if (!el) return;
  el.textContent = message;
  el.className = 'famous-status' + (isError ? ' error' : '');
}

/* ---------------- Name search (suggestions) ---------------- */

let searchMatches = [];
let searchDebounceTimer = null;

function renderSuggestions(rows) {
  const container = document.querySelector('.source-suggestions[data-person="B"]');
  container.innerHTML = rows.length
    ? rows.map((m, idx) => `
      <div class="suggestion-item" data-index="${idx}">
        <span class="suggestion-name">${escapeHtml(m.title)}</span>
        <span class="suggestion-meta">${escapeHtml(m.description || '').slice(0, 40)}</span>
      </div>
    `).join('')
    : '<div class="suggestion-empty">No matches found</div>';
  container.classList.add('open');
}

function fetchWikiSuggestions(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=8&namespace=0&format=json&origin=*`;
  fetch(url)
    .then((res) => res.json())
    .then(([, titles, descriptions]) => {
      searchMatches = titles.map((title, i) => ({ title, description: descriptions[i] || '' }));
      renderSuggestions(searchMatches);
    })
    .catch(() => {
      searchMatches = [];
      const container = document.querySelector('.source-suggestions[data-person="B"]');
      container.innerHTML = '<div class="suggestion-empty">Search failed - check your connection</div>';
      container.classList.add('open');
    });
}

function searchDatabaseEntries(query) {
  const q = query.toLowerCase();
  const rows = [];
  loadDB().categories.forEach((cat) => {
    cat.entries.forEach((e) => {
      if (e.date && e.name.toLowerCase().includes(q)) rows.push({ title: e.name, description: cat.name, date: e.date });
    });
  });
  return rows.slice(0, 30);
}

function handleSearchInput(value) {
  const container = document.querySelector('.source-suggestions[data-person="B"]');
  const source = document.querySelector('.source-picker[data-person="B"]').value;
  const q = value.trim();
  if (!q) {
    searchMatches = [];
    container.innerHTML = '';
    container.classList.remove('open');
    return;
  }
  if (source === 'database') {
    searchMatches = searchDatabaseEntries(q);
    renderSuggestions(searchMatches);
    return;
  }
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => fetchWikiSuggestions(q), 300);
}

/* ---------------- Date resolution per pick ---------------- */

const KIND_VERB = { born: 'born', founded: 'founded', opened: 'opened', released: 'released' };

function resolvePickedDate(title) {
  const cached = cacheGet(mode, title);
  if (cached) return Promise.resolve(cached);

  let chain;
  if (mode === 'person') {
    chain = fetchWikidataId(title).then((qid) => (qid ? fetchKeyDate(qid) : null));
  } else if (mode === 'place') {
    chain = lookupPlaceFoundingDate(title);
  } else {
    chain = lookupKeyDateByNameWithTitle(title, true);
  }
  return chain.then((result) => {
    if (result) cachePut(mode, title, result);
    return result;
  });
}

function selectSuggestion(match) {
  const container = document.querySelector('.source-suggestions[data-person="B"]');
  container.innerHTML = '';
  container.classList.remove('open');
  document.querySelector('.source-search[data-person="B"]').value = match.title;
  document.querySelector('.person-name[data-person="B"]').value = match.title;

  // A Database pick already carries its date - no network involved.
  if (match.date) {
    document.querySelector('.person-date[data-person="B"]').value = isoToDisplay(match.date);
    setLookupStatus('', false);
    return;
  }

  setLookupStatus('Looking up date...', false);
  resolvePickedDate(match.title)
    .then((info) => {
      if (!info || !info.date) {
        setLookupStatus(`No exact date found for ${match.title}. You can type it manually below.`, true);
        return;
      }
      document.querySelector('.person-date[data-person="B"]').value = isoToDisplay(info.date);
      const verb = KIND_VERB[info.kind] || MODE_COPY[mode].verb;
      const via = info.via === 'country' ? ' (via its country)' : '';
      setLookupStatus(`✓ ${info.title || match.title} · ${verb} ${info.date}${via}`, false);
    })
    .catch(() => setLookupStatus('Lookup failed. Try again, or type the date manually.', true));
}

/* ---------------- Wiring ---------------- */

function wireInputs() {
  document.querySelectorAll('.person-date').forEach((input) => attachDateMask(input));

  const picker = document.querySelector('.source-picker[data-person="B"]');
  picker.addEventListener('change', () => {
    const wrap = document.querySelector('.source-search-wrap[data-person="B"]');
    const searchInput = document.querySelector('.source-search[data-person="B"]');
    wrap.hidden = picker.value === 'manual';
    setLookupStatus('', false);
    if (!wrap.hidden) { searchInput.value = ''; searchInput.focus(); }
    document.querySelector('.source-suggestions[data-person="B"]').classList.remove('open');
  });

  document.querySelector('.source-search[data-person="B"]').addEventListener('input', (e) => {
    handleSearchInput(e.target.value);
  });

  document.querySelector('.source-suggestions[data-person="B"]').addEventListener('click', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (!item) return;
    const match = searchMatches[Number(item.dataset.index)];
    if (match) selectSuggestion(match);
  });
}

document.addEventListener('click', (e) => {
  document.querySelectorAll('.source-suggestions.open').forEach((container) => {
    const searchInput = document.querySelector('.source-search[data-person="B"]');
    if (e.target !== searchInput && !container.contains(e.target)) container.classList.remove('open');
  });
});

// 31 free checks, one-time lifetime cap (locked gating spec) - the meter
// line is visible from the very first use, under the Calculate button.
function refreshCompatMeterLine() {
  let line = document.getElementById('compatMeterLine');
  if (!line) {
    line = document.createElement('div');
    line.id = 'compatMeterLine';
    document.getElementById('calculateBtn').insertAdjacentElement('afterend', line);
  }
  line.innerHTML = c13MeterLineHtml('compat');
}

const placeCountrySelectEl = document.getElementById('placeCountrySelect');
const placeCountryTitleRowEl = document.getElementById('placeCountryTitleRow');

function enterCompatForm() {
  // Defensive - the US-places screen and this form share personInputsEl's
  // one Person-A field and must never both be visible at once.
  usPlacesTitleRowEl.style.display = 'none';
  usPlacesScreenEl.style.display = 'none';
  document.getElementById('usPlacesYouRow').innerHTML = '';
  compatFormEl.classList.add('active');
  closeCompatModal();
  compatResultsEl.innerHTML = '';
  personInputsEl.innerHTML = youInputHTML() + otherInputHTML();
  wireInputs();
  refreshCompatMeterLine();
}

document.querySelectorAll('#modeSelect .mode-card').forEach((card) => {
  card.addEventListener('click', () => {
    mode = card.dataset.mode;
    modeSelectEl.style.display = 'none';
    // Place mode gets its own follow-up question first (2026-08-26, user:
    // "once you click place another menu shows up again and prompts us
    // or other") - every other mode goes straight into the form as before.
    if (mode === 'place') {
      placeCountryTitleRowEl.style.display = '';
      placeCountrySelectEl.style.display = 'grid';
    } else {
      enterCompatForm();
    }
  });
});

document.querySelectorAll('#placeCountrySelect .mode-card').forEach((card) => {
  card.addEventListener('click', () => {
    placeCountryTitleRowEl.style.display = 'none';
    placeCountrySelectEl.style.display = 'none';
    if (card.dataset.country === 'us') {
      openUsPlacesScreen();
    } else {
      enterCompatForm();
      const searchInput = document.querySelector('.source-search[data-person="B"]');
      if (searchInput) searchInput.focus();
    }
  });
});

document.getElementById('backToModesFromPlace').addEventListener('click', (e) => {
  e.preventDefault();
  placeCountryTitleRowEl.style.display = 'none';
  placeCountrySelectEl.style.display = 'none';
  modeSelectEl.style.display = 'grid';
});

document.getElementById('backToModes').addEventListener('click', (e) => {
  e.preventDefault();
  compatFormEl.classList.remove('active');
  closeCompatModal();
  // Place mode backs up to its own country question, not straight past it.
  if (mode === 'place') {
    placeCountryTitleRowEl.style.display = '';
    placeCountrySelectEl.style.display = 'grid';
  } else {
    modeSelectEl.style.display = 'grid';
  }
});

function parseDateInput(value) {
  // setFullYear (not the multi-arg constructor) sidesteps JS's legacy
  // two-digit-year quirk, where `new Date(y, ...)` silently remaps any y in
  // 0-99 to 1900+y - which corrupted mid-typing states in the date picker.
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date();
  date.setFullYear(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Shared by the Calculate button and the US-places browser's tap-a-tile
// flow ("you can calculate compatibility from there no need to... make
// you calculate again", user 2026-08-27) - both paths land on the exact
// same popup. isPersonModeOverride lets the tile-tap path (always place
// mode) pass its own fork explicitly rather than reading the page-level
// `mode` global, which the tile tap never actually changes.
function runCompatCalculation(dateAISO, dateBISO, nameA, nameB, isPersonModeOverride) {
  if (!c13Entitled() && c13MeterLeft('compat') <= 0) {
    c13OpenPaywall('compat');
    return;
  }
  const dateA = parseDateInput(dateAISO);
  const dateB = parseDateInput(dateBISO);
  const isPerson = isPersonModeOverride != null ? isPersonModeOverride : mode === 'person';
  const result = computeCompatibility(dateA, dateB);
  const deep = computeDeepCompatibility(dateA, dateB, isPerson);
  renderCompatHero(compatResultsEl, result, nameA, nameB, { dateA, dateB, pillDateA: dateA, pillDateB: dateB, pillPersonMode: isPerson, deep });
  compatModalOverlayEl.classList.add('active');
  c13MeterUse('compat');
  refreshCompatMeterLine();
}

document.getElementById('calculateBtn').addEventListener('click', () => {
  const dateAISO = displayToISO(document.querySelector('.person-date[data-person="A"]').value);
  if (!dateAISO) {
    alert('Please enter a valid date (MM/DD/YYYY) for your birthday.');
    return;
  }
  const dateBISO = displayToISO(document.querySelector('.person-date[data-person="B"]').value);
  if (!dateBISO) {
    alert(`Please enter or look up a valid date for the ${mode}.`);
    return;
  }
  const nameA = document.querySelector('.person-name[data-person="A"]').value.trim() || 'You';
  const nameB = document.querySelector('.person-name[data-person="B"]').value.trim()
    || (mode === 'person' ? 'Them' : (mode === 'place' ? 'This place' : 'This one'));
  runCompatCalculation(dateAISO, dateBISO, nameA, nameB);
});
