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
// endpoint returns a real thumbnail in one request, no key needed. Cached
// in localStorage (place names don't change) so browsing the grid twice
// never re-fetches. A miss (or offline) leaves the colored-initials
// monogram fallback up - never a broken image or a guessed picture.
const US_PLACE_IMAGE_CACHE_KEY = 'code13_us_place_images_v1';
let usPlaceImageCache = {};
try { usPlaceImageCache = JSON.parse(localStorage.getItem(US_PLACE_IMAGE_CACHE_KEY)) || {}; } catch (e) { /* ignore */ }

function fetchPlaceImage(title) {
  if (Object.prototype.hasOwnProperty.call(usPlaceImageCache, title)) return Promise.resolve(usPlaceImageCache[title]);
  return fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    .then((res) => res.json())
    .then((data) => (data.thumbnail && data.thumbnail.source) || null)
    .catch(() => null)
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

const usPlacesModalEl = document.getElementById('usPlacesModalOverlay');

function closeUsPlacesModal() {
  usPlacesModalEl.classList.remove('active');
}

// Renders every tile with the monogram fallback immediately (instant,
// same as the rest of this popup), then swaps in each real photo as its
// fetch resolves - never blocks the grid from appearing on a slow
// connection.
function placeTileHtml(name, extra) {
  return `
    <div class="emax-tile emax-tile-poster" ${extra}>
      <div class="emax-tile-media">
        <div class="emax-tile-media-img" id="usPlaceThumb-${escapeHtml(name)}">${placeMonogram(name)}</div>
      </div>
      <div class="emax-tile-info">
        <div class="emax-tile-name">${escapeHtml(name)}</div>
      </div>
    </div>
  `;
}

function loadPlaceThumb(name) {
  fetchPlaceImage(name).then((url) => {
    if (!url) return;
    const el = document.getElementById(`usPlaceThumb-${name}`);
    if (el) el.innerHTML = `<img src="${escapeHtml(url)}" alt="" loading="lazy">`;
  });
}

function renderUsStatesGrid() {
  document.getElementById('usPlacesModalTitle').textContent = 'A U.S. State';
  document.getElementById('usPlacesModalBody').innerHTML = `
    <div class="emax-tile-grid">
      ${US_PLACES.map((p) => placeTileHtml(p.state, `data-state="${escapeHtml(p.state)}"`)).join('')}
    </div>
  `;
  US_PLACES.forEach((p) => loadPlaceThumb(p.state));
  // "or pick a city" sits under each tile's name, added after the grid
  // renders so it doesn't fight the tile's own click target.
  document.querySelectorAll('#usPlacesModalBody .emax-tile[data-state]').forEach((tile) => {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'us-cities-link';
    link.dataset.state = tile.dataset.state;
    link.textContent = 'or pick a city';
    tile.querySelector('.emax-tile-info').appendChild(link);
  });
}

// User's call, 2026-08-26: tapping a state selects it right away (same
// instant path as the rest of this popup) - the "or pick a city" link on
// each tile is the one way into this drill-down, mirroring EMAX's own
// item-popup-stacks-a-second-popup precedent (emax-popup.js).
function renderUsCitiesGrid(stateName) {
  const place = US_PLACES.find((p) => p.state === stateName);
  if (!place) return;
  document.getElementById('usPlacesModalTitle').textContent = stateName;
  document.getElementById('usPlacesModalBody').innerHTML = `
    <a href="#" class="emax-modal-back" id="usCitiesBack">&larr; Back to states</a>
    <div class="emax-tile-grid">
      ${place.cities.map((city) => placeTileHtml(city, `data-city="${escapeHtml(city)}"`)).join('')}
    </div>
  `;
  place.cities.forEach((city) => loadPlaceThumb(city));
  document.getElementById('usCitiesBack').addEventListener('click', (e) => {
    e.preventDefault();
    renderUsStatesGrid();
  });
}

function openUsPlacesModal() {
  renderUsStatesGrid();
  usPlacesModalEl.classList.add('active');
}

document.getElementById('usPlacesModalClose').addEventListener('click', closeUsPlacesModal);
usPlacesModalEl.addEventListener('click', (e) => {
  if (e.target === usPlacesModalEl) closeUsPlacesModal();
});

// Delegated once on the static body element - its innerHTML is swapped
// between the states grid and a state's cities grid, so listeners bound
// to individual tiles would be lost on every re-render.
document.getElementById('usPlacesModalBody').addEventListener('click', (e) => {
  const citiesLink = e.target.closest('.us-cities-link');
  if (citiesLink) {
    e.stopPropagation();
    renderUsCitiesGrid(citiesLink.dataset.state);
    return;
  }
  const cityTile = e.target.closest('.emax-tile[data-city]');
  if (cityTile) {
    closeUsPlacesModal();
    selectSuggestion({ title: cityTile.dataset.city });
    return;
  }
  const stateTile = e.target.closest('.emax-tile[data-state]');
  if (stateTile) {
    closeUsPlacesModal();
    selectSuggestion({ title: stateTile.dataset.state });
  }
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
    enterCompatForm();
    if (card.dataset.country === 'us') {
      openUsPlacesModal();
    } else {
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

document.getElementById('calculateBtn').addEventListener('click', () => {
  if (!c13Entitled() && c13MeterLeft('compat') <= 0) {
    c13OpenPaywall('compat');
    return;
  }
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

  const dateA = parseDateInput(dateAISO);
  const dateB = parseDateInput(dateBISO);
  const nameA = document.querySelector('.person-name[data-person="A"]').value.trim() || 'You';
  const nameB = document.querySelector('.person-name[data-person="B"]').value.trim()
    || (mode === 'person' ? 'Them' : (mode === 'place' ? 'This place' : 'This one'));

  // Person runs the person-vs-person deep blend; Object/Place run the
  // event-date imprint blend - same isPersonMode fork as numerology-app.
  const isPerson = mode === 'person';
  const result = computeCompatibility(dateA, dateB);
  const deep = computeDeepCompatibility(dateA, dateB, isPerson);
  renderCompatHero(compatResultsEl, result, nameA, nameB, { dateA, dateB, pillDateA: dateA, pillDateB: dateB, pillPersonMode: isPerson, deep });
  compatModalOverlayEl.classList.add('active');
  // A successful render is what spends a free check - a validation error
  // above never costs one.
  c13MeterUse('compat');
  refreshCompatMeterLine();
});
