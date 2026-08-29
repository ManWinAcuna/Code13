function parseDateInput(value) {
  // value is "YYYY-MM-DD"; construct using local components to avoid TZ shift.
  // setFullYear (not the multi-arg constructor) sidesteps JS's legacy
  // two-digit-year quirk, where `new Date(y, ...)` silently remaps any y in
  // 0-99 to 1900+y - which corrupted mid-typing states in the date picker.
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date();
  date.setFullYear(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setTitle(id, value) {
  const el = document.getElementById(id);
  if (el) el.title = value;
}

// Sign text plus a small retrograde marker when the natal placement was R.
function setSignText(id, sign, retro) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = retro ? `${sign} <span class="retro-marker" title="Retrograde at birth">℞</span>` : sign;
}

let lastBirthDate = null;
let lastMonthsTable = null;

function render() {
  const input = document.getElementById('bday');
  const iso = displayToISO(input.value);
  if (!iso) { lastBirthDate = null; lastMonthsTable = null; return; }

  const birthDate = parseDateInput(iso);
  lastBirthDate = birthDate;
  const today = getToday();

  const r = computeAll(birthDate, today);
  lastMonthsTable = r.monthsTable;

  setText('lifePath', lifePathDisplayText(r.lifePath));
  setText('dayBornReduced', r.dayBornReduced);
  setText('dayNumReduced', r.dayNumReduced);
  setText('combo', r.combo);

  setText('lifePathRaw', r.lifePathCompound);
  setText('dayBornRaw', r.dayBornRaw);
  setText('dayNumRaw', r.dayNumRaw);

  setText('sunSign', r.sunSign);
  setSignText('saturnSign', r.saturnSign, r.saturnRetro);
  setSignText('jupiterSign', r.jupiterSign, r.jupiterRetro);
  setSignText('venusSign', r.venusSign, r.venusRetro);
  setTitle('sunSign', `Numerical value: ${WESTERN_SIGN_NUMERIC[r.sunSign]}`);
  setTitle('saturnSign', `Numerical value: ${WESTERN_SIGN_NUMERIC[r.saturnSign]}`);
  setTitle('jupiterSign', `Numerical value: ${WESTERN_SIGN_NUMERIC[r.jupiterSign]}`);
  setTitle('venusSign', `Numerical value: ${WESTERN_SIGN_NUMERIC[r.venusSign]}`);

  setText('chineseYear', r.chineseYear);
  setText('chineseMonth', r.chineseMonth);
  setText('chineseDay', r.chineseDay);
  setTitle('chineseYear', `Numerical value: ${CHINESE_ANIMAL_NUMERIC[r.chineseYear]}`);
  setTitle('chineseMonth', `Numerical value: ${CHINESE_ANIMAL_NUMERIC[r.chineseMonth]}`);
  setTitle('chineseDay', `Numerical value: ${CHINESE_ANIMAL_NUMERIC[r.chineseDay]}`);

  setText('luckyNumber', r.luckyNumber);
  setText('missing', r.missing);
  // "8 Day" = the FIRST 8-DAY IMPRINT: the Life Path carried by the 8th
  // of the BIRTH MONTH itself, even when that day falls before the birth
  // date (owner's second correction 2026-08-29 - 04/15/1994 must give 8
  // via April 8, not 9 via the on-or-after May 8; 01/03/2003 gives 5 via
  // Jan 8). getBirthMonthImprint lives in imprint-alignment.js next to
  // the engine's own on-or-after variant.
  const first8 = getBirthMonthImprint(birthDate, 8);
  setText('twentyEightDay', first8 ? first8.lp : '-');

  // Non-monthly users get DECOY pinnacle data under the blur (see the
  // c13PinnaclesGated block below) - the real values must never enter
  // the DOM, or the blur is just a devtools speed bump.
  if (typeof c13PinnaclesGated !== 'undefined' && c13PinnaclesGated) {
    setText('pinnacle1', '3'); setText('pinnacle2', '7');
    setText('pinnacle3', '1'); setText('pinnacle4', '9');
    setText('pinnacle1Compound', '21'); setText('pinnacle2Compound', '16');
    setText('pinnacle3Compound', '28'); setText('pinnacle4Compound', '18');
    setText('pinnacleAge1', 'Birth – 27'); setText('pinnacleAge2', '28 – 36');
    setText('pinnacleAge3', '37 – 45'); setText('pinnacleAge4', '46+');
  } else {
    setText('pinnacle1', r.pinnacles.values[0]);
    setText('pinnacle2', r.pinnacles.values[1]);
    setText('pinnacle3', r.pinnacles.values[2]);
    setText('pinnacle4', r.pinnacles.values[3]);
    setText('pinnacle1Compound', r.pinnacles.compounds[0]);
    setText('pinnacle2Compound', r.pinnacles.compounds[1]);
    setText('pinnacle3Compound', r.pinnacles.compounds[2]);
    setText('pinnacle4Compound', r.pinnacles.compounds[3]);

    const [age1, age2, age3] = r.pinnacles.ages;
    setText('pinnacleAge1', `Birth – ${age1}`);
    setText('pinnacleAge2', `${age1 + 1} – ${age2}`);
    setText('pinnacleAge3', `${age2 + 1} – ${age3}`);
    setText('pinnacleAge4', `${age3 + 1}+`);
  }

  setText('pyReduced', r.py.reduced);
  setText('pmReduced', r.pm.reduced);
  setText('pdReduced', r.pd.reduced);
  setText('pyRaw', r.py.raw);
  setText('pmRaw', r.pm.raw);
  setText('pdRaw', r.pd.raw);

  setText('daysUntilBirthday', r.daysLeft.daysUntilBirthday);
  setText('daysUntilMonthlyDay', r.daysLeft.daysUntilMonthlyDay);

  // Famous Lookup dropped this box (2026-08-26, user: "get rid of the
  // compatibility with today in famous lookup") - Profile/Calculator still
  // have it, hence the null guard rather than deleting the block outright.
  const todayCompat = computeCompatibility(birthDate, today);
  const compatEl = document.getElementById('compatTodayScore');
  if (compatEl) {
    compatEl.textContent = `${todayCompat.finalScore}%`;
    compatEl.className = `box-value ${tierClass(todayCompat.finalScore)}`;
  }

  const compatMeEl = document.getElementById('compatMeScore');
  if (compatMeEl) {
    const profile = loadProfile();
    if (profile && profile.date) {
      const meDate = parseDateInput(profile.date);
      const meCompat = computeCompatibility(meDate, birthDate);
      compatMeEl.textContent = `${meCompat.finalScore}%`;
      compatMeEl.className = `box-value ${tierClass(meCompat.finalScore)}`;
    } else {
      compatMeEl.textContent = '-';
      compatMeEl.className = 'box-value';
    }
  }

  // Energy Flow category removed from Code13 (owner call 2026-08-25) -
  // the engine's computeEnergyFlow stays untouched; c13-copy.js still
  // reads it for the Today story's flow states.

  // Code13: the First Imprints section doesn't exist in this app's pages -
  // guarded so render() survives the missing element.
  const imprintsEl = document.getElementById('firstImprints');
  if (imprintsEl) {
  imprintsEl.innerHTML = '';
  r.firstImprints.forEach((fi) => {
    const div = document.createElement('div');
    div.className = 'imprint-cell';
    div.innerHTML = `<div class="lp-label">LP ${fi.target}</div><div class="lp-day">${fi.day}</div>`;
    imprintsEl.appendChild(div);
  });
  }

  const monthsBody = document.querySelector('#monthsTable tbody');
  monthsBody.innerHTML = '';
  const currentMonthIndex = today.getMonth() + 1;
  r.monthsTable.forEach((row) => {
    const tr = document.createElement('tr');
    if (row.index === currentMonthIndex) tr.className = 'current-month';
    tr.innerHTML = `
      <td class="month-name">${row.index} ${row.name} <span class="month-animal" title="${row.animal}">${VIETNAMESE_ZODIAC_EMOJI[row.animal] || ''}</span></td>
      <td class="reduced">${row.reduced}</td>
      <td>${row.unreduced}</td>
    `;
    monthsBody.appendChild(tr);
  });

  renderCompoundStories(r, birthDate);
  // Code13+ Full Reading entry (profile only - the paid synthesis is the
  // reader's own profile product, not the calculator's arbitrary dates).
  if (/profile/i.test(location.pathname) && window.c13PaidReadingLink) {
    try { c13PaidReadingLink(r, birthDate, birthDate); } catch (e) {}
  }
}

// insertStoryLink/openStoryModal/openIdentityModal/openZodiacIdentityModal/
// renderCompoundStories moved to compat-render.js (2026-08-08) so
// category.js (the Database entry popup) can call them too, without
// loading all of this file's page-specific #bday wiring. See
// compat-render.js for these functions and the storyModalOverlayEl
// close-button wiring that used to live here.

attachDateMask(document.getElementById('bday'));
document.getElementById('bday').addEventListener('input', render);

/* ===================== Personal Hours ===================== */

function tierClass(score) {
  if (score >= 82) return 'good';
  if (score < 58) return 'bad';
  return 'mid';
}

let hoursMode = 'reduced';

function renderHoursTableHalf(tableEl, rows, table, masked) {
  const theadRow = tableEl.querySelector('thead tr');
  theadRow.innerHTML = table.isPM
    ? '<th>Time</th><th>Digital</th><th>Military</th><th>Sign</th>'
    : '<th>Time</th><th>Digital</th><th>Sign</th>';

  const tbody = tableEl.querySelector('tbody');
  tbody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    if (row.isOwnHour) tr.className = 'own-hour';

    // masked (free profile): the TIME grid is real - it derives from the
    // birth time the reader typed themselves, nothing secret - but every
    // VALUE and its tier color is withheld ('·', neutral pill). The old
    // decoy-table approach showed a fixed 10:30 grid, which read as the
    // app calculating their hours wrong (owner escalation 2026-08-14).
    const digitalValue = masked ? '·' : (hoursMode === 'raw' ? row.digitalRaw : row.digitalReduced);
    const digitalTier = masked ? 'mid' : tierClass(numerologyCompat(table.digitalRoot, row.digitalReduced));
    // Your own hour-sign is always favorable to you, regardless of what the
    // lookup table says about it compared against itself.
    const signTier = masked ? 'mid' : (row.sign === table.ownSign ? 'good' : tierClass(vietnameseCompat(table.ownSign, row.sign)));
    const signEmoji = VIETNAMESE_ZODIAC_EMOJI[row.sign] || '';

    let militaryCellHtml = '';
    if (table.isPM) {
      const militaryValue = masked ? '·' : (hoursMode === 'raw' ? row.militaryRaw : row.militaryReduced);
      const militaryTier = masked ? 'mid' : tierClass(numerologyCompat(table.militaryRoot, row.militaryReduced));
      militaryCellHtml = `<td class="hour-num"><span class="hour-pill ${militaryTier}">${militaryValue}</span></td>`;
    }

    tr.innerHTML = `
      <td class="hour-time">${row.label}${row.isOwnHour ? '<span class="you-pill">you</span>' : ''}</td>
      <td class="hour-num"><span class="hour-pill ${digitalTier}">${digitalValue}</span></td>
      ${militaryCellHtml}
      <td class="hour-sign"><span class="hour-pill ${signTier}">${signEmoji} ${row.sign}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function personalHourScore(table, row) {
  const signScore = row.sign === table.ownSign ? 100 : vietnameseCompat(table.ownSign, row.sign);
  const scores = [
    numerologyCompat(table.digitalRoot, row.digitalReduced),
    signScore,
  ];
  if (table.isPM) scores.push(numerologyCompat(table.militaryRoot, row.militaryReduced));
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// Financial hours run on 8 and 28. Prefer 8, but if 8 is a clash for this
// person's own root, fall back to 28 instead. Among whichever hours carry
// that number (digital or, for PM, military), pick the one that also lines
// up best with the sign - i.e. the highest personalHourScore among them.
function findBestFinancialHour(table) {
  const eightScore = numerologyCompat(table.digitalRoot, 8);
  const financialNumber = eightScore < 49 ? 28 : 8;

  const candidates = table.rows.filter((row) => {
    const digitalMatch = row.digitalReduced === financialNumber;
    const militaryMatch = table.isPM && row.militaryReduced === financialNumber;
    return digitalMatch || militaryMatch;
  });

  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestScore = -Infinity;
  candidates.forEach((row) => {
    const score = personalHourScore(table, row);
    if (score > bestScore) { bestScore = score; best = row; }
  });

  return { row: best, financialNumber };
}

function renderPersonalHours() {
  const timeInput = document.getElementById('btime');
  if (!timeInput) return; // page has no Personal Hours UI (e.g. Famous Lookup)
  const emptyEl = document.getElementById('hoursEmpty');
  const boxEl = document.getElementById('hoursBox');
  const ownNoteEl = document.getElementById('hoursOwnNote');
  const bestEl = document.getElementById('bestHourTime');
  const worstEl = document.getElementById('worstHourTime');
  const best2El = document.getElementById('bestHourTime2');
  const worst2El = document.getElementById('worstHourTime2');
  const finEl = document.getElementById('finHourTime');
  const finNoteEl = document.getElementById('finHourNote');
  // These only make sense once a birth time is known, so they're hidden
  // outright (not just shown with placeholder "-") until one is entered.
  const finBoxEl = document.getElementById('finHourBox');
  const bwBoxEl = document.getElementById('bestWorstHourBox');
  const hoursSectionEl = document.getElementById('personalHoursSection');

  if (!timeInput.value) {
    if (finBoxEl) finBoxEl.style.display = 'none';
    if (bwBoxEl) bwBoxEl.style.display = 'none';
    if (hoursSectionEl) hoursSectionEl.style.display = 'none';
    emptyEl.style.display = 'block';
    boxEl.style.display = 'none';
    bestEl.textContent = '-';
    worstEl.textContent = '-';
    best2El.textContent = '-';
    worst2El.textContent = '-';
    finEl.textContent = '-';
    finNoteEl.textContent = '';
    return;
  }

  if (finBoxEl) finBoxEl.style.display = '';
  if (bwBoxEl) bwBoxEl.style.display = '';
  if (hoursSectionEl) hoursSectionEl.style.display = '';

  // Code13: Personal Hours gets the Pinnacles treatment on profile.html -
  // visible but blurred, with DECOY data underneath (a fixed 10:30 table,
  // never the real birth time's - nothing real to peek at in devtools)
  // and a lock overlay opening the hours paywall. Calculator stays fully
  // free per the locked gating spec.
  // Gated rework (owner escalations 2026-08-14): the old approach rendered
  // a DECOY 10:30 table under the blur, and its wrong row times read as
  // the app miscalculating the reader's hours. Now there is ONE table,
  // always computed from the real birth time: the TIME grid shows real
  // (it derives from the time the reader typed - nothing secret), while
  // every VALUE is masked for free users ('·', neutral tiers, roots
  // withheld) and the best/worst/money boxes tease the real answers
  // veiled to their leading digit. Nothing real enters the DOM beyond
  // what the reader already knows.
  // Hours are monthly-and-above on EVERY page that renders them (owner
  // call 2026-08-25) - this also closes the old leak where Calculator
  // showed real hours to free users because only profile.html was gated.
  const c13HoursGated = typeof c13HoursEntitled === 'function'
    ? !c13HoursEntitled()
    : (typeof c13ProfileGated !== 'undefined' && c13ProfileGated);
  const [hh, mm] = timeInput.value.split(':').map(Number);
  const table = getPersonalHoursTable(hh, mm);

  emptyEl.style.display = 'none';
  boxEl.style.display = 'block';
  ownNoteEl.textContent = c13HoursGated
    ? `born in the ${table.ownSign} hour`
    : table.isPM
      ? `Digital root ${table.digitalRoot} · Military root ${table.militaryRoot} · born in the ${table.ownSign} hour`
      : `Time root ${table.digitalRoot} · born in the ${table.ownSign} hour`;

  renderHoursTableHalf(document.getElementById('hoursTableA'), table.rows.slice(0, 12), table, c13HoursGated);
  renderHoursTableHalf(document.getElementById('hoursTableB'), table.rows.slice(12, 24), table, c13HoursGated);

  const ranked = table.rows
    .map((row) => ({ row, score: personalHourScore(table, row) }))
    .sort((a, b) => b.score - a.score);
  const financial = findBestFinancialHour(table);

  // Callouts show the full PERIOD ("10:30-11:30 AM"), not just the start -
  // an hour is a window (owner's call 2026-08-14). Matching stays on the
  // raw start labels internally.
  const rangeOf = (l) => (window.c13HourRange ? c13HourRange(l) : l);
  if (c13HoursGated) {
    // Owner's call (2026-08-14, round 3): no text teases - the values sit
    // in place blurred past legibility. What's under the blur is a dummy
    // period, never the real one, so devtools still finds nothing.
    [bestEl, worstEl, best2El, worst2El, finEl].forEach((el) => {
      el.textContent = '0:00-0:00 AM';
      el.classList.add('c13-blurred');
    });
    finNoteEl.textContent = '';
  } else {
    [bestEl, worstEl, best2El, worst2El, finEl].forEach((el) => el.classList.remove('c13-blurred'));
    bestEl.textContent = rangeOf(ranked[0].row.label);
    worstEl.textContent = rangeOf(ranked[ranked.length - 1].row.label);
    best2El.textContent = rangeOf(ranked[1].row.label);
    worst2El.textContent = rangeOf(ranked[ranked.length - 2].row.label);
    if (financial) {
      finEl.textContent = rangeOf(financial.row.label);
      finNoteEl.textContent = `via ${financial.financialNumber}`;
    } else {
      finEl.textContent = 'None today';
      finNoteEl.textContent = '';
    }
  }

  // When the personal best/worst hour happens to also be the financial
  // hour, that overlap used to be invisible unless you read both boxes
  // and compared the times yourself - flag whichever tile(s) match.
  // Masked mode skips it: the overlap would leak which tease is which.
  [bestEl, worstEl, best2El, worst2El].forEach((el) => {
    const tile = el.closest('.bw-hour');
    if (tile) tile.classList.toggle('bw-hour-fin', !c13HoursGated && !!(financial && el.textContent === rangeOf(financial.row.label)));
  });

  // The blur + lock overlay itself (idempotent - this rerenders on every
  // input/toggle). All three hour surfaces blur; one overlay on the main
  // tables box carries the tap-to-paywall.
  if (c13HoursGated) {
    // No blur anymore: the grid's times are real and deserve to be read
    // crisp (the blurred decoy read as wrong math). The values are already
    // masked, so the lock overlay is the only thing standing between the
    // reader and the answer - which is the point.
    if (boxEl && !(boxEl.parentNode && boxEl.parentNode.classList.contains('c13-blurwrap'))) {
      const wrap = document.createElement('div');
      wrap.className = 'c13-blurwrap';
      boxEl.parentNode.insertBefore(wrap, boxEl);
      wrap.appendChild(boxEl);
      const overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.className = 'c13-blur-overlay';
      const hoursLine = (window.c13SurfaceLine && c13SurfaceLine('hours', null))
        || 'Your best hour, your worst hour, your financial hour. All 24, scored.';
      const hoursCta = (window.C13B && C13B.bank14 && C13B.bank14.profileHours.ctas[0]) || 'Code13+';
      overlay.innerHTML = '<span class="c13-lock-ic">🔒</span>'
        + '<span class="c13-bo-line">' + hoursLine + '</span>'
        + '<span class="c13-lock-cta">' + hoursCta + '</span>';
      overlay.addEventListener('click', () => c13OpenPaywall('hours'));
      wrap.appendChild(overlay);
    }
  }
}

document.querySelectorAll('.hours-toggle-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.hours-toggle-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    hoursMode = btn.dataset.mode;
    renderPersonalHours();
  });
});

const btimeInput = document.getElementById('btime');
if (btimeInput) btimeInput.addEventListener('input', renderPersonalHours);
renderPersonalHours();

(function applyBdayFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const bday = params.get('bday');
  if (bday && /^\d{4}-\d{2}-\d{2}$/.test(bday)) {
    document.getElementById('bday').value = isoToDisplay(bday);
  }
  const btime = params.get('btime');
  const btimeField = document.getElementById('btime');
  if (btimeField && btime && /^\d{2}:\d{2}$/.test(btime)) {
    btimeField.value = btime;
    renderPersonalHours();
  }
})();

// Called by auth-widget.js after a post-sign-in cloud pull, instead of a
// full page reload. Profile.html overrides this with its own version that
// also repopulates the bday/btime fields from the freshly-synced profile;
// pages without a stored profile (Calculator, Famous Lookup) just need the
// numbers (e.g. Compatibility with Me, which reads loadProfile() fresh
// every render) to recompute in place.
window.__refreshAfterCloudSync = function () {
  render();
  if (document.getElementById('btime')) renderPersonalHours();
};

render();

/* ===================== Compat / Energy Flow popups ===================== */

function openModal() {
  document.getElementById('compatModalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('compatModalOverlay').classList.remove('active');
}

const compatTodayBoxEl = document.getElementById('compatTodayBox');
if (compatTodayBoxEl) {
  compatTodayBoxEl.addEventListener('click', () => {
    if (!lastBirthDate) return;
    const result = computeCompatibility(lastBirthDate, getToday());
    renderCompatHero(document.getElementById('compatModalBody'), result, 'You', 'Today', { compact: true, pillDateA: lastBirthDate, pillDateB: getToday() });
    openModal();
  });
}

const pmReducedEl = document.getElementById('pmReduced');
if (pmReducedEl) {
  pmReducedEl.title = 'Click for Yearly Outlook';
  pmReducedEl.addEventListener('click', () => {
    if (!lastBirthDate || !lastMonthsTable) return;
    const ranked = computeMonthOutlook(lastBirthDate, lastMonthsTable);
    renderMonthOutlook(document.getElementById('compatModalBody'), ranked);
    openModal();
  });
}

// Profile-only gating (locked spec): Pinnacles and the Personal Year
// Roadmap are Code13+ on profile.html. Calculator and Famous Lookup load
// this same file and stay fully free - the page check keeps them open.
const c13ProfileGated = /profile/i.test(location.pathname)
  && typeof c13Entitled === 'function' && !c13Entitled();

// Pinnacles are monthly-and-above on EVERY page that renders them (owner
// call 2026-08-25, same doctrine as Hours) - weekly members get the same
// blurred decoy tease as free users, and Calculator/Famous no longer
// leak real pinnacles to anyone below monthly.
const c13PinnaclesGated = typeof c13MonthlyPlus === 'function' && !c13MonthlyPlus();

const pyReducedEl = document.getElementById('pyReduced');
if (pyReducedEl) {
  pyReducedEl.title = 'Click for Personal Year Roadmap';
  pyReducedEl.addEventListener('click', () => {
    if (!lastBirthDate) return;
    if (c13ProfileGated) { c13OpenPaywall('roadmap'); return; }
    const roadmap = computeYearRoadmap(lastBirthDate);
    renderYearRoadmap(document.getElementById('compatModalBody'), roadmap);
    openModal();
  });
}

// The Pinnacles section stays VISIBLE for free users, blurred in place
// (owner's call - same tease philosophy as The Hours: see the shape of
// what exists, feel the pull). What's under the blur is the DECOY data
// render() writes above - the real values never enter the DOM, so the
// blur isn't just a devtools speed bump. The overlay's why-line is
// personalized: the reader's real current chapter, veiled - the flip
// age stays behind the paywall.
if (c13PinnaclesGated) {
  const pinnaclesGrid = document.querySelector('.pinnacles-collapsible .pinnacles-grid');
  if (pinnaclesGrid) {
    // Bank 14 line as the base; the personalized real-chapter line below
    // still wins when a profile exists (their own data sells harder).
    let whyLine = (window.c13SurfaceLine && c13SurfaceLine('pinnacles', null))
      || 'Your core numbers say who you are. Pinnacles say when.';
    try {
      const prof = loadProfile();
      if (prof && prof.date) {
        const [py, pm, pd] = prof.date.split('-').map(Number);
        const bd = new Date();
        bd.setFullYear(py, pm - 1, pd);
        bd.setHours(0, 0, 0, 0);
        const chapter = computeYearRoadmapRange(bd).pinnacleIndex;
        whyLine = 'You are in chapter ' + chapter + ' of 4 right now. The age it flips is one tap away.';
      }
    } catch (e) {}
    const wrap = document.createElement('div');
    wrap.className = 'c13-blurwrap';
    pinnaclesGrid.parentNode.insertBefore(wrap, pinnaclesGrid);
    wrap.appendChild(pinnaclesGrid);
    pinnaclesGrid.classList.add('c13-blurred');
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'c13-blur-overlay';
    overlay.innerHTML = '<span class="c13-lock-ic">🔒</span>'
      + '<span class="c13-bo-line">' + whyLine + '</span>'
      + '<span class="c13-lock-cta">Code13+</span>';
    overlay.addEventListener('click', () => c13OpenPaywall('pinnacles'));
    wrap.appendChild(overlay);
  }
}

const compatMeBox = document.getElementById('compatMeBox');
if (compatMeBox) {
  compatMeBox.addEventListener('click', () => {
    if (!lastBirthDate) return;
    const profile = loadProfile();
    if (!profile || !profile.date) {
      alert('Set your birthday on the My Profile page first, then come back to compare.');
      return;
    }
    const meDate = parseDateInput(profile.date);
    const famousNameEl = document.getElementById('famousSearch');
    const dayName = (famousNameEl && famousNameEl.value) ? famousNameEl.value : 'This Date';
    const result = computeCompatibility(meDate, lastBirthDate);
    renderCompatHero(document.getElementById('compatModalBody'), result, 'Me', dayName, { compact: true, pillDateA: meDate, pillDateB: lastBirthDate, pillPersonMode: true });
    openModal();
  });
}

document.getElementById('compatModalClose').addEventListener('click', closeModal);
document.getElementById('compatModalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'compatModalOverlay') closeModal();
});
