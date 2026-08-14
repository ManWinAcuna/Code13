/* Code13 copy adapter (2026-08-13) - the glue between the owner's Copy
   Bible banks (banks/c13-bank-*.js, window.C13B) and the app's display
   layer. Implements Bank 12's assembly doctrine: date-seeded rotation
   (stable within a day, fresh across days), no repeated line within one
   reading, tier language from the REAL engine score only, overlays after
   the sentence they qualify, no raw numbers/weights/mechanics in prose.

   The shared engine + shared content files (numerology.js, compat-*.js,
   compound-meanings.js, planet-guide.js) are NOT edited - this layer only
   consumes their public functions and swaps what TEXT the code13 call
   sites render. Load AFTER the engine files and any banks/ files the page
   uses; every function here degrades gracefully (returns null) when its
   bank file isn't loaded on that page. */

(function () {
  window.C13B = window.C13B || {};

  /* ---------------- seeded rotation ---------------- */
  // One seed per (local day, slot key): the same visitor sees the same
  // line all day (no reroll on refresh), and a different line tomorrow.
  function c13Hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function c13DayStamp(d) {
    const x = d || new Date();
    return x.getFullYear() * 10000 + (x.getMonth() + 1) * 100 + x.getDate();
  }
  // usedLines: Bank 12 repetition control - never the same line twice in
  // one assembled reading. Callers bracket a reading with c13BeginReading().
  let usedLines = new Set();
  window.c13BeginReading = function () { usedLines = new Set(); };
  window.c13Pick = function (key, arr, date) {
    if (!arr || !arr.length) return null;
    const start = c13Hash(String(c13DayStamp(date)) + '|' + key) % arr.length;
    for (let i = 0; i < arr.length; i++) {
      const cand = arr[(start + i) % arr.length];
      if (!usedLines.has(cand)) { usedLines.add(cand); return cand; }
    }
    return arr[start];
  };

  /* ---------------- tiers ---------------- */
  // Same thresholds as scoreClass()/compat flags; peak is a stronger COPY
  // pool only (Bank 04 doctrine) - it never changes visible tier colors.
  window.c13Tier = function (score) {
    return score >= 85 ? 'peak' : score >= 77 ? 'good' : score >= 49 ? 'mid' : 'clash';
  };

  const NOUN = {
    1: 'Pioneer', 2: 'Peacemaker', 3: 'Storyteller', 4: 'Builder', 5: 'Explorer',
    6: 'Caretaker', 7: 'Seeker', 8: 'Executive', 9: 'Mirror', 11: 'Antenna',
    22: 'Master Builder', 28: 'Wealth-Builder', 33: 'Guardian',
  };
  window.c13Noun = function (root) { return NOUN[root] || String(root); };

  /* ---------------- directional pair lookups ---------------- */
  window.c13DayPair = function (personRoot, dayRoot) {
    return (C13B.bank04 || {})[personRoot + '_' + dayRoot] || null;
  };
  window.c13VietPair = function (personAnimal, otherAnimal) {
    return (C13B.bank07 || {})[personAnimal + '_' + otherAnimal] || null;
  };
  window.c13WesternPair = function (personSign, otherSign) {
    return (C13B.bank09 || {})[personSign + '_' + otherSign] || null;
  };
  // Cycle roots never include 2 (house doctrine) - an impure-11 Universal
  // Day (lookup 2) has no bank11 cell on purpose; the impure-11 overlay
  // carries that day instead. Callers treat null as "skip the line".
  window.c13CyclePair = function (personalRoot, universalRoot) {
    return (C13B.bank11 || {})[personalRoot + '_' + universalRoot] || null;
  };

  /* ---------------- Bank 04 verdict copy ---------------- */
  // signal -> meaning -> action for one scored pair, real tier only.
  // `quiet` uses its own pool (no meaning/action split in the bank).
  window.c13Verdict = function (score, personRoot, dayRoot, opts) {
    const v = C13B.bank04verdict;
    if (!v) return null;
    opts = opts || {};
    const tier = opts.quiet ? 'quiet' : c13Tier(score);
    const pool = v[tier];
    if (!pool) return null;
    const fill = (s) => s && s
      .replace(/\{day\}/g, c13Noun(dayRoot))
      .replace(/\{person\}/g, c13Noun(personRoot));
    const k = 'verdict:' + personRoot + ':' + dayRoot + ':' + tier;
    if (tier === 'quiet') {
      return { tier, signal: fill(c13Pick(k + ':s', pool.signals)), meaning: '', action: '' };
    }
    return {
      tier,
      signal: fill(c13Pick(k + ':s', pool.signals)),
      meaning: fill(c13Pick(k + ':m', pool.meaning)),
      action: fill(c13Pick(k + ':a', pool.action)),
    };
  };

  /* ---------------- Bank 05 special-condition overlays ---------------- */
  // Returns [{id, line}] for the conditions actually active today, in
  // Bank 12's overlay priority order. Triggers mirror the engine exactly:
  // the caller passes what it already computed (no re-scoring here).
  window.c13Overlays = function (ctx) {
    const b = C13B.bank05;
    if (!b) return [];
    const out = [];
    const add = (id) => {
      const cond = b[id];
      if (cond) out.push({ id, line: c13Pick('overlay:' + id, cond.lines) });
    };
    if (ctx.uDayRoot === 7 || ctx.energyRoot === 7) add('body7');
    if (ctx.enemy78) add('enemy78');
    if (ctx.uDayRoot === 11) add('crash11');
    if (ctx.impureMaster === 11) add('impure11');
    if (ctx.impureMaster === 22) add('impure22');
    if (ctx.impureMaster === 33) add('impure33');
    if (ctx.uDayRoot === 28 || ctx.energyRoot === 28) add('greed28');
    return out;
  };

  /* ---------------- Bank 02 day energy ---------------- */
  window.c13DayEnergy = function (uDayRoot) {
    const e = (C13B.bank02 || {})[uDayRoot];
    if (!e) return null;
    return {
      name: e.name,
      opener: c13Pick('day:open:' + uDayRoot, e.openers),
      light: c13Pick('day:light:' + uDayRoot, e.light),
      watch: c13Pick('day:watch:' + uDayRoot, e.watch),
      anchors: e.anchors,
    };
  };

  /* ---------------- Bank 03 actionables ---------------- */
  window.c13ActionLines = function (root, kind, n, keySuffix) {
    const e = (C13B.bank03 || {})[root];
    if (!e) return [];
    const pool = kind === 'do' ? e.dos : e.donts;
    const out = [];
    for (let i = 0; i < (n || 1); i++) {
      const line = c13Pick('act:' + kind + ':' + root + ':' + i + (keySuffix || ''), pool);
      if (line && out.indexOf(line) === -1) out.push(line);
    }
    return out;
  };

  /* ---------------- Bank 12 flow-state composer ---------------- */
  // States from the three REAL Energy Flow pair scores (Year/Month/Day):
  // no friction + real support = aligned; friction + support = mixed;
  // two or more friction layers = resistant; nothing extreme = quiet.
  window.c13FlowState = function (yearScore, monthScore, dayScore) {
    const t = [yearScore, monthScore, dayScore].map(c13Tier);
    const goods = t.filter((x) => x === 'good' || x === 'peak').length;
    const bads = t.filter((x) => x === 'clash').length;
    if (bads >= 2) return 'resistant';
    if (bads === 1) return 'mixed';
    if (goods >= 1) return 'aligned';
    return 'quiet';
  };

  // The FULL TODAY assembly (Bank 12): opener, Year line, bridge, Month
  // line, bridge, Day line, overlays after the sentence they qualify,
  // one closer. Folds stacked roots instead of repeating them.
  // ef: computeEnergyFlow() result. overlays: c13Overlays() output.
  window.c13ComposeFlow = function (ef, overlays) {
    const b12 = C13B.bank12;
    if (!b12 || !C13B.bank11) return null;
    c13BeginReading();
    const n = ef.numerology;
    const state = c13FlowState(n.yearScore, n.monthScore, n.dayScore);
    const flow = b12.flow[state];
    const parts = [];
    parts.push(c13Pick('flow:open:' + state, flow.lines));

    const py = n.personalYear, pm = n.personalMonth, pd = n.personalDay;
    const uy = n.universalYear, um = n.universalMonth;
    // universalDay arrives as display text ("22/4"); the lookup root is
    // its last resolved digit sequence - parse it back out.
    const udStr = String(n.universalDay);
    const ud = udStr.indexOf('/') !== -1 ? Number(udStr.split('/')[1]) : Number(udStr);

    const seen = {};
    function layerLine(hz, p, u, label) {
      const cell = c13CyclePair(p, u);
      if (!cell) return null;
      const stackKey = p + '_' + u;
      if (seen[stackKey]) {
        return 'The same current is stacked in your ' + label + ' too. Use the repetition as focus, not as permission to overdo the shadow.';
      }
      seen[stackKey] = true;
      const h = cell[hz];
      if (!h) return null;
      // One line per horizon (Bank 12 rule 2), rotated across the pair's
      // Bank 11 angles AND the personal side's Bank 10 rotation - so the
      // same flow state doesn't read identically two days running.
      const b10e = (C13B.bank10 || {})[p];
      const pool = [h.main, h.more].concat(b10e ? [c13Pick('flow:b10:' + hz + ':' + p, b10e[hz])] : []).filter(Boolean);
      return c13Pick('flow:layer:' + hz + ':' + stackKey, pool);
    }

    const yearLine = layerLine('year', py, uy, 'year');
    if (yearLine) parts.push(yearLine);
    const b1 = c13Pick('flow:bridge:ym', b12.bridges.yearMonth);
    if (b1 && yearLine) parts.push(b1);
    const monthLine = layerLine('month', pm, um, 'month');
    if (monthLine) parts.push(monthLine);
    const b2 = c13Pick('flow:bridge:md', b12.bridges.monthDay);
    if (b2 && monthLine) parts.push(b2);
    const dayLine = layerLine('day', pd, ud, 'day');
    if (dayLine) parts.push(dayLine);

    (overlays || []).forEach((o) => { if (o.line) parts.push(o.line); });
    parts.push(c13Pick('flow:close:' + state, flow.closers));
    return { state, text: parts.filter(Boolean).join(' '), parts };
  };

  /* ---------------- Banks 01/06/08 identity adapters ---------------- */
  // Same shape the app's existing popups/composers consume ({light,
  // shadow, characteristics, moreCharacteristics, deep}), fed from the
  // Bible pools with rotation - so two visits (or two people sharing a
  // root) don't read identically.
  function pickN(key, arr, n) {
    const out = [];
    for (let i = 0; i < n && i < (arr || []).length; i++) {
      const line = c13Pick(key + ':' + i, arr);
      if (line && out.indexOf(line) === -1) out.push(line);
    }
    return out;
  }
  window.c13NumberIdentity = function (root, impure) {
    const e = (C13B.bank01 || {})[root];
    if (!e) return null;
    // Impure masters keep the shared file's oscillation copy as the
    // identity CLAIM (doctrine text, not display phrasing) - the Bible's
    // pools ride along as characteristics/details either way.
    const base = (typeof numberIdentityV2 === 'function' && impure) ? numberIdentityV2(root, true) : null;
    return {
      name: e.name,
      light: base ? base.light : c13Pick('id:light:' + root, e.light),
      shadow: base ? base.shadow : c13Pick('id:shadow:' + root, e.shadow),
      core: e.core,
      moves: e.moves,
      characteristics: pickN('id:sharp:' + root, e.sharp, 3),
      moreCharacteristics: pickN('id:sharp2:' + root, e.sharp, 2),
      scene: c13Pick('id:scene:' + root, e.scenes),
      depth: (C13B.bank01depth || {})[root] || null,
    };
  };
  window.c13AnimalIdentity = function (animal) {
    const e = (C13B.bank06 || {})[animal];
    if (!e) return null;
    return {
      name: e.name,
      light: c13Pick('an:light:' + animal, e.light),
      shadow: c13Pick('an:shadow:' + animal, e.shadow),
      deep: e.moves,
      characteristics: pickN('an:sharp:' + animal, e.sharp, 3),
      moreCharacteristics: pickN('an:sharp2:' + animal, e.sharp, 2),
      scene: c13Pick('an:scene:' + animal, e.scenes),
      depth: (C13B.bank06depth || {})[animal] || null,
    };
  };
  window.c13SignIdentity = function (sign) {
    const e = (C13B.bank08 || {})[sign];
    if (!e) return null;
    return {
      name: e.name,
      light: c13Pick('sg:light:' + sign, e.light),
      shadow: c13Pick('sg:shadow:' + sign, e.shadow),
      characteristics: pickN('sg:sharp:' + sign, e.sharp, 3),
      moreCharacteristics: pickN('sg:sharp2:' + sign, e.sharp, 2),
      scene: c13Pick('sg:scene:' + sign, e.scenes),
      depth: (C13B.bank08depth || {})[sign] || null,
    };
  };
  window.c13PlanetRole = function (planet) {
    return (C13B.bank08planets || {})[planet] || null;
  };

  /* ---------------- Bank 10 cycle copy ---------------- */
  window.c13CycleCopy = function (root, horizon) {
    const e = (C13B.bank10 || {})[root];
    if (!e) return null;
    const line = c13Pick('cy:' + horizon + ':' + root, e[horizon]);
    const depth = ((C13B.bank10depth || {})[root] || {})[horizon] || null;
    return { name: e.name, current: e.current, shadow: e.shadow, move: e.move, line, anchors: e.anchors, depth };
  };

  /* ---------------- General Reading (Code13 voice) ---------------- */
  // Mirrors composeGeneralReading's weight order, depth tiers, register
  // connectors, and dedupe folding (all consumed from the shared file's
  // public globals - never edited), but resolves CONTENT from the Bible
  // identity adapters above. parts: same shape the call site already
  // builds. opts.thirdPerson: famous mode (shared toThirdPerson + the
  // c13 fixups below).
  // Curated against the actual Bank 01/06/08 text: every line was run
  // through toThirdPerson and machine-scanned for object-case artifacts;
  // these are the confirmed hits (plus the prepositions the shared
  // converter's list doesn't carry). Rerun the scan if banks regenerate.
  const C13_TP_OBJECT_VERBS = ['makes', 'make', 'gives', 'give', 'lets', 'let', 'keeps', 'keep',
    'leaves', 'leave', 'tells', 'tell', 'moves', 'move', 'costs', 'cost', 'helps', 'help',
    'carries', 'carry', 'wakes', 'wake', 'gets', 'bothers', 'teaches', 'teach', 'follows',
    'holds', 'hold', 'takes', 'take', 'pulls', 'pull', 'pushes', 'push', 'protects', 'protect',
    'drains', 'drain', 'hurts', 'hurt', 'stops', 'stop', 'outlives', 'reminds', 'remind',
    'forcing', 'slowing', 'leaving', 'holding', 'telling', 'understand', 'trust'];
  const C13_TP_PREPS = ['against', 'beside', 'at', 'by', 'about', 'into', 'onto', 'under',
    'off', 'past', 'upon', 'among', 'beneath', 'inside', 'outside', 'across', 'along', 'between', 'through'];
  const C13_TP_FIXUPS = [
    [new RegExp('\\b(' + C13_TP_OBJECT_VERBS.join('|') + ') they\\b', 'g'), '$1 them'],
    [new RegExp('\\b(' + C13_TP_PREPS.join('|') + ') they\\b', 'g'), '$1 them'],
    [/\bis they refusing\b/g, 'is them refusing'],
  ];
  function c13ThirdPerson(s) {
    if (!s) return s;
    let out = (typeof toThirdPerson === 'function') ? toThirdPerson(s) : s;
    C13_TP_FIXUPS.forEach(([rx, rep]) => { out = out.replace(rx, rep); });
    return out;
  }
  window.c13ThirdPerson = c13ThirdPerson;

  window.c13ComposeGeneralReading = function (parts, opts) {
    opts = opts || {};
    c13BeginReading();
    const items = [];
    (parts || []).forEach((p) => {
      let entry = null;
      if (p.kind === 'number') entry = c13NumberIdentity(p.root, p.impure);
      else if (p.kind === 'animal') entry = c13AnimalIdentity(p.key);
      else if (p.kind === 'sign' || p.kind === 'planet') entry = c13SignIdentity(p.key);
      if (!entry) return;
      const dedupeKey = p.kind === 'number' ? 'number:' + p.root
        : p.kind === 'planet' ? 'planet:' + p.planet
        : p.kind + ':' + p.key;
      const register = (typeof entityRegister === 'function') ? entityRegister(p) : null;
      items.push({ p, entry, dedupeKey, register });
    });
    if (!items.length) return null;

    const paragraphs = [];
    const seenDedupe = {};
    const seenPlanetSigns = {};
    let prevRegister = null;
    items.forEach((it) => {
      if (seenDedupe[it.dedupeKey] !== undefined) {
        const orig = paragraphs[seenDedupe[it.dedupeKey]];
        if (orig) orig.extra = orig.extra ? orig.extra + ' That same current runs doubled in you.' : 'That same current runs doubled in you.';
        return;
      }
      seenDedupe[it.dedupeKey] = paragraphs.length;
      const connector = paragraphs.length > 0 && typeof nextConnector === 'function' && typeof registerRelation === 'function'
        ? nextConnector(registerRelation(prevRegister, it.register))
        : null;
      const depth = it.p.depth || (it.p.kind === 'planet' ? 'planet-lean' : 'std');
      // Scenes arrive as complete framed lines ("The field medic: care is
      // practical..."), so they join the pool as-is, no wrapper.
      const detailPool = [].concat(it.entry.characteristics || [], it.entry.scene ? [it.entry.scene] : [], it.entry.deep ? [it.entry.deep] : []);
      let para = null;
      if (it.p.kind === 'planet') {
        const roleLine = 'Your ' + it.p.planet + ' sits in ' + it.p.key + '.';
        const prior = seenPlanetSigns[it.p.key];
        if (prior) {
          para = { connector, light: roleLine + ' The same ' + it.p.key + ' current your ' + prior + ' already carries.', shadow: null, extra: null, detail: null };
        } else if (depth === 'planet-full') {
          para = { connector, light: roleLine + ' ' + it.entry.light, shadow: it.entry.shadow, extra: null, detail: null };
        } else {
          para = { connector, light: roleLine + ' ' + it.entry.light, shadow: null, extra: null, detail: null };
        }
        if (!prior) seenPlanetSigns[it.p.key] = it.p.planet;
      } else if (depth === 'full') {
        para = { connector, light: it.entry.light, shadow: it.entry.shadow, extra: null, detail: pickN('gr:d:' + it.dedupeKey, detailPool, 2).join(' ') || null };
      } else if (depth === 'lean') {
        para = { connector, light: it.entry.light, shadow: it.entry.shadow, extra: null, detail: null };
      } else if (depth === 'micro') {
        para = { connector, light: it.entry.light, shadow: null, extra: null, detail: null };
      } else {
        para = { connector, light: it.entry.light, shadow: it.entry.shadow, extra: null, detail: c13Pick('gr:d:' + it.dedupeKey, detailPool) };
      }
      paragraphs.push(para);
      prevRegister = it.register;
    });

    if (!paragraphs.length) return null;
    const tp = (s) => (s && opts.thirdPerson ? c13ThirdPerson(s) : s);
    const finalParagraphs = paragraphs.map((pp) => ({
      connector: tp(pp.connector), light: tp(pp.light), shadow: tp(pp.shadow), extra: tp(pp.extra), detail: tp(pp.detail),
    }));
    const text = finalParagraphs
      .map((pp) => [pp.connector, pp.light, pp.shadow, pp.extra, pp.detail].filter(Boolean).join(' '))
      .join(' ');
    return { text, paragraphs: finalParagraphs };
  };

  /* ---------------- planet popups (Bank 08 roles) ---------------- */
  // Sun/Saturn/Jupiter/Venus popups speak the owner's Bank 08 role copy;
  // the other six bodies keep planet-guide.js's shared guide untouched.
  // Rebinds the global openPlanetModal AFTER planet-guide.js defines it -
  // call sites resolve the binding at call time, so the delegated
  // [data-planet-tap] listener picks this up with zero wiring.
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof window.openPlanetModal !== 'function' || typeof planetGuideEnsureModal !== 'function') return;
    const orig = window.openPlanetModal;
    window.openPlanetModal = function (planetKey, signText) {
      const role = c13PlanetRole(planetKey);
      if (!role) return orig(planetKey, signText);
      const overlay = planetGuideEnsureModal();
      const guide = (typeof PLANET_GUIDE !== 'undefined' && PLANET_GUIDE[planetKey]) || {};
      const yours = signText && signText !== '-' ? '<div class="planet-guide-yours">Yours: <b>' + signText + '</b></div>' : '';
      const prompts = (role.prompts || []).map(function (q) { return '<div class="planet-guide-example">' + q + '</div>'; }).join('');
      overlay.querySelector('#planetModalBody').innerHTML =
        '<div class="planet-guide">' +
        '<div class="planet-guide-head"><span class="planet-guide-symbol">' + (guide.symbol || '') + '</span>' +
        '<div><div class="planet-guide-name">' + planetKey + '</div>' +
        '<div class="planet-guide-domain">' + role.role + '</div></div></div>' +
        yours +
        '<div class="planet-guide-desc">' + role.body + '</div>' +
        (prompts ? '<div class="planet-guide-examples-label">Questions this layer answers</div>' + prompts : '') +
        (role.vocab ? '<div class="planet-guide-yours">' + role.vocab + '</div>' : '') +
        '</div>';
      overlay.classList.add('active');
    };
  });

  /* -------- tappable category cards (Banks 07/09 pair copy) -------- */
  // The compat hero's Vietnamese/Western cards carry data-c13-viet /
  // data-c13-western (entity|day). Tapping one opens the pair's own
  // directional copy: one rotated lens plus the practical close. No-op
  // when the pair banks aren't loaded on that page or the story modal
  // markup doesn't exist there.
  // Own modal (style.css's app-wide overlay classes): the compat hero
  // renders on pages that don't all carry the story-modal markup.
  function c13EnsureModal() {
    let overlay = document.getElementById('c13PairModalOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'c13PairModalOverlay';
    overlay.style.zIndex = '740';
    overlay.innerHTML = '<div class="modal-box modal-box-narrow">' +
      '<button class="modal-close" id="c13PairModalClose" title="Close">&times;</button>' +
      '<div id="c13PairModalBody"></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('active'); });
    overlay.querySelector('#c13PairModalClose').addEventListener('click', function () { overlay.classList.remove('active'); });
    return overlay;
  }

  document.addEventListener('click', function (e) {
    const card = e.target.closest('[data-c13-viet],[data-c13-western]');
    if (!card) return;
    let title = '', lines = [];
    if (card.dataset.c13Viet) {
      const pair = card.dataset.c13Viet.split('|');
      const cell = c13VietPair(pair[0], pair[1]);
      if (!cell) return;
      title = pair[0] + ' × ' + pair[1];
      lines = [c13Pick('vp:' + pair.join('_'), [cell.a[0], cell.a[1], cell.a[2], cell.a[3]]), cell.a[4]];
    } else {
      const pair = card.dataset.c13Western.split('|');
      const cell = c13WesternPair(pair[0], pair[1]);
      if (!cell) return;
      title = pair[0] + ' × ' + pair[1];
      lines = [c13Pick('wp:' + pair.join('_'), [cell.a[0], cell.a[1], cell.a[2], cell.a[3]]), cell.a[4]];
    }
    const overlay = c13EnsureModal();
    overlay.querySelector('#c13PairModalBody').innerHTML =
      '<div class="story-modal-title">' + title + '</div>' +
      lines.filter(Boolean).map(function (l) { return '<div class="story-row">' + l + '</div>'; }).join('');
    overlay.classList.add('active');
  });
})();
