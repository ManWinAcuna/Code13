let famousMatches = [];
let famousDebounceTimer = null;

// fetchKeyDate (db-core.js) can resolve to any of these kinds - born (P569),
// founded (P571), opened (P1619, an organization's official-opening date
// when inception itself has no exact day), or released (P577).
const FAMOUS_KIND_VERB = { born: 'born', founded: 'founded', opened: 'opened', released: 'released' };

function setFamousStatus(message, isError) {
  const el = document.getElementById('famousStatus');
  el.textContent = message;
  el.className = 'famous-status' + (isError ? ' error' : '');
}

// Photo pill: reset to the placeholder glyph whenever a new search starts,
// so a stale portrait from the last lookup never lingers under a different
// name. A resolved P18 image swaps it in; a miss (or a load error on the
// resolved URL) just leaves the placeholder up - never fabricated art.
function resetFamousPhoto() {
  const img = document.getElementById('famousPhotoImg');
  const placeholder = document.getElementById('famousPhotoPlaceholder');
  img.style.display = 'none';
  img.src = '';
  placeholder.style.display = '';
}

function setFamousPhoto(url) {
  if (!url) return;
  const img = document.getElementById('famousPhotoImg');
  const placeholder = document.getElementById('famousPhotoPlaceholder');
  img.onerror = () => resetFamousPhoto();
  img.onload = () => { placeholder.style.display = 'none'; img.style.display = ''; };
  img.src = url;
}

function renderFamousSuggestionsList() {
  const container = document.getElementById('famousSuggestions');
  if (famousMatches.length === 0) {
    container.innerHTML = '<div class="suggestion-empty">No matches found</div>';
  } else {
    container.innerHTML = famousMatches.map((m, idx) => `
      <div class="suggestion-item" data-index="${idx}">
        <span class="suggestion-name">${escapeHtml(m.title)}</span>
        <span class="suggestion-meta">${escapeHtml(m.description).slice(0, 40)}</span>
      </div>
    `).join('');
  }
  container.classList.add('open');
}

function fetchFamousSuggestions(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=8&namespace=0&format=json&origin=*`;
  fetch(url)
    .then((res) => res.json())
    .then(([, titles, descriptions]) => {
      famousMatches = titles.map((title, i) => ({ title, description: descriptions[i] || '' }));
      renderFamousSuggestionsList();
    })
    .catch(() => {
      famousMatches = [];
      showFamousSearchError();
    });
}

function showFamousSearchError() {
  const container = document.getElementById('famousSuggestions');
  container.innerHTML = '<div class="suggestion-empty">Search failed - check your connection</div>';
  container.classList.add('open');
}

function handleFamousInput(value) {
  const container = document.getElementById('famousSuggestions');
  const q = value.trim();

  if (!q) {
    famousMatches = [];
    container.innerHTML = '';
    container.classList.remove('open');
    resetFamousPhoto();
    return;
  }

  clearTimeout(famousDebounceTimer);
  famousDebounceTimer = setTimeout(() => fetchFamousSuggestions(q), 300);
}

// 130 free lookups, one-time lifetime cap (locked gating spec) - meter
// line visible from first use, right under the search status.
function refreshFamousMeterLine() {
  let line = document.getElementById('famousMeterLine');
  if (!line) {
    line = document.createElement('div');
    line.id = 'famousMeterLine';
    document.getElementById('famousStatus').insertAdjacentElement('afterend', line);
  }
  line.innerHTML = c13MeterLineHtml('famous');
}
refreshFamousMeterLine();

function selectFamousPerson(title) {
  if (!c13Entitled() && c13MeterLeft('famous') <= 0) {
    c13OpenPaywall('famous');
    return;
  }
  document.getElementById('famousSearch').value = title;
  document.getElementById('famousSuggestions').innerHTML = '';
  document.getElementById('famousSuggestions').classList.remove('open');
  setFamousStatus('Looking up date...', false);
  resetFamousPhoto();

  fetchWikidataId(title)
    .then((qid) => {
      if (!qid) {
        setFamousStatus(`No Wikidata entry found for ${title}.`, true);
        return null;
      }
      // Independent of the date lookup below - a miss here just leaves the
      // placeholder up, it never blocks or fails the date resolution.
      fetchPersonImageUrl(qid).then(setFamousPhoto).catch(() => {});
      return fetchKeyDate(qid);
    })
    .then((info) => {
      if (!info) {
        if (!document.getElementById('famousStatus').classList.contains('error')) {
          setFamousStatus(`No exact birth or founding date found for ${title}.`, true);
        }
        return;
      }
      document.getElementById('bday').value = isoToDisplay(info.date);
      render();
      const verb = FAMOUS_KIND_VERB[info.kind] || 'born';
      setFamousStatus(`✓ ${title} · ${verb} ${info.date}`, false);
      // Only a lookup that actually resolved a date spends a free one.
      c13MeterUse('famous');
      refreshFamousMeterLine();
    })
    .catch(() => setFamousStatus('Lookup failed. Try again.', true));
}

document.getElementById('famousSearch').addEventListener('input', (e) => {
  handleFamousInput(e.target.value);
});

document.getElementById('famousSuggestions').addEventListener('click', (e) => {
  const item = e.target.closest('.suggestion-item');
  if (!item) return;
  const match = famousMatches[Number(item.dataset.index)];
  if (match) selectFamousPerson(match.title);
});

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('famousSuggestions');
  if (e.target.id !== 'famousSearch' && !wrap.contains(e.target)) {
    wrap.classList.remove('open');
  }
});
