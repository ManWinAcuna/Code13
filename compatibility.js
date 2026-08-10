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
      setLookupStatus(`✓ ${info.title || match.title} — ${verb} ${info.date}${via}`, false);
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

document.querySelectorAll('.mode-card').forEach((card) => {
  card.addEventListener('click', () => {
    mode = card.dataset.mode;
    modeSelectEl.style.display = 'none';
    compatFormEl.classList.add('active');
    closeCompatModal();
    compatResultsEl.innerHTML = '';
    personInputsEl.innerHTML = youInputHTML() + otherInputHTML();
    wireInputs();
  });
});

document.getElementById('backToModes').addEventListener('click', (e) => {
  e.preventDefault();
  modeSelectEl.style.display = 'grid';
  compatFormEl.classList.remove('active');
  closeCompatModal();
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
});
