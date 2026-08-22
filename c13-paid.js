/* Code13+ Full Reading (Bank 13, 2026-08-14) - the paid synthesis layer.
   Composes the twelve-chapter deep reading from the SAME owner-authored
   ingredient banks and engine state the free app already uses: identity
   entries (Banks 01/06/08 via the cached c13-copy adapters), the shared
   register system (compound-meanings.js globals), depth-expansion lenses
   (bank01depth/06depth/08depth), cycles (Banks 10/11/12), and Bank 13's
   own connector/opener/transition/close rotations. It never invents new
   doctrine: every claim traces to an ingredient line or an engine-owned
   relationship, structural glue only (Bank 13's hard rule).

   Free users get the locked preview instead: one engine-qualified teaser
   (only when a real repeat/tension exists), a Bank 13 locked line, and a
   benefit-first CTA into the 'reading' paywall context.

   Profile-only surface. Load AFTER c13-copy.js and the bank files. */
(function () {
  function B13() { return (window.C13B && C13B.bank13) || null; }

  // Position weight = the strict source order, heaviest first. Used to
  // rank repeats/tensions and to decide which ingredient's depth lens
  // speaks for a domain chapter. Never re-sorts the reading itself.
  const ORDER_WEIGHT = { lifePath: 11, dayBorn: 10, combo: 9, dayNum: 8, vietYear: 7, vietMonth: 6, vietDay: 5, sun: 4, saturn: 3, jupiter: 2, venus: 1 };

  function buildParts(r, birthDate) {
    const lpEntry = compoundEntryForLifePath(r.lifePath, r.lifePathCompound);
    const dbEntry = compoundEntry(r.dayBornRaw);
    const dnEntry = compoundEntry(r.dayNumRaw);
    const cbEntry = compoundEntry(compoundRawCombo(birthDate));
    return [
      { id: 'lifePath', label: 'Life Path', kind: 'number', root: lpEntry.root, impure: lpEntry.impure },
      { id: 'dayBorn', label: 'Day Born', kind: 'number', root: dbEntry.root, impure: dbEntry.impure },
      { id: 'combo', label: 'Combo', kind: 'number', root: cbEntry.root, impure: cbEntry.impure },
      { id: 'dayNum', label: 'Day#', kind: 'number', root: dnEntry.root, impure: dnEntry.impure },
      { id: 'vietYear', label: 'Vietnamese Year', kind: 'animal', key: r.chineseYear },
      { id: 'vietMonth', label: 'Vietnamese Month', kind: 'animal', key: r.chineseMonth },
      { id: 'vietDay', label: 'Vietnamese Day', kind: 'animal', key: r.chineseDay },
      { id: 'sun', label: 'Sun', kind: 'planet', planet: 'Sun', key: r.sunSign },
      { id: 'saturn', label: 'Saturn', kind: 'planet', planet: 'Saturn', key: r.saturnSign },
      { id: 'jupiter', label: 'Jupiter', kind: 'planet', planet: 'Jupiter', key: r.jupiterSign },
      { id: 'venus', label: 'Venus', kind: 'planet', planet: 'Venus', key: r.venusSign },
    ];
  }

  function resolveAll(parts) {
    const items = [];
    parts.forEach((p) => {
      let entry = null;
      if (p.kind === 'number') entry = c13NumberIdentity(p.root, p.impure);
      else if (p.kind === 'animal') entry = c13AnimalIdentity(p.key);
      else entry = c13SignIdentity(p.key);
      if (!entry) return;
      const dedupeKey = p.kind === 'number' ? 'number:' + p.root : p.kind === 'planet' ? 'sign:' + p.key : 'animal:' + p.key;
      items.push({ p, entry, dedupeKey, register: (typeof entityRegister === 'function') ? entityRegister(p) : null, weight: ORDER_WEIGHT[p.id] || 0 });
    });
    return items;
  }

  // Register analysis: repeats (same register, 2+ meaningful ingredients)
  // and tensions (only the ESTABLISHED opposite pairs). Nothing is forced:
  // no qualifying structure means the chapter simply says less.
  function analyze(items) {
    const groups = {};
    items.forEach((it) => {
      if (!it.register) return;
      (groups[it.register] = groups[it.register] || []).push(it);
    });
    const repeats = Object.keys(groups)
      .filter((k) => groups[k].length >= 2)
      .map((k) => ({ register: k, members: groups[k], weight: groups[k].reduce((a, b) => a + b.weight, 0) }))
      .sort((a, b) => b.weight - a.weight);
    const tensions = [];
    if (typeof REGISTER_TENSION !== 'undefined') {
      REGISTER_TENSION.forEach(([a, b]) => {
        if (groups[a] && groups[b]) {
          tensions.push({ a, b, membersA: groups[a], membersB: groups[b], weight: groups[a].concat(groups[b]).reduce((x, y) => x + y.weight, 0) });
        }
      });
      tensions.sort((a, b) => b.weight - a.weight);
    }
    return { groups, repeats: repeats.slice(0, 4), tensions: tensions.slice(0, 3) };
  }

  const regName = (r) => (r || '').toLowerCase();
  function listLabels(members) {
    const names = members.map((m) => m.p.label);
    return names.length === 2 ? names.join(' and ') : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
  }

  // Depth lens accessors - the owner's depth-expansion text per ingredient.
  function lens(it, numberField, animalField, signField) {
    const d = it.entry.depth;
    if (!d) return null;
    if (it.p.kind === 'number') return d[numberField] || null;
    if (it.p.kind === 'animal') return d[animalField] || null;
    return d[signField] || null;
  }
  // Best lens among given items (heaviest first), consumed at most once.
  function bestLens(items, numberField, animalField, signField, usedSet) {
    for (const it of items) {
      const l = lens(it, numberField, animalField, signField);
      if (l && !usedSet.has(l)) { usedSet.add(l); return l; }
    }
    return null;
  }

  window.c13ComposePaidReading = function (r, birthDate, me) {
    const bank = B13();
    if (!bank) return null;
    const parts = buildParts(r, birthDate);
    const items = resolveAll(parts);
    if (!items.length) return null;
    const an = analyze(items);
    const usedLens = new Set();
    const byId = {};
    items.forEach((it) => { byId[it.p.id] = it; });
    const chapters = [];
    const seenDedupe = {};

    function para(it, opts) {
      // Repeat entities fold: a stack note on the earlier mention, never a
      // second full description (Bank 13 REPEAT FOLD).
      if (seenDedupe[it.dedupeKey]) {
        return it.p.label + ' runs the same current as your ' + seenDedupe[it.dedupeKey] + '. Stacked, not incidental.';
      }
      seenDedupe[it.dedupeKey] = it.p.label;
      const o = opts || {};
      const bits = [];
      if (it.p.kind === 'planet') bits.push('Your ' + it.p.planet + ' sits in ' + it.p.key + '.');
      bits.push(it.entry.light);
      if (!o.lightOnly) bits.push(it.entry.shadow);
      if (o.deep && it.entry.deep) bits.push(it.entry.deep);
      for (let i = 0; i < (o.details || 0); i++) {
        const d = c13Pick('paid:detail:' + it.dedupeKey + ':' + i, it.entry.extra || []);
        if (d) bits.push(d);
      }
      if (o.lensArgs) {
        const l = lens(it, o.lensArgs[0], o.lensArgs[1], o.lensArgs[2]);
        if (l && !usedLens.has(l)) { usedLens.add(l); bits.push(l); }
      }
      return bits.filter(Boolean).join(' ');
    }
    const connector = (kind, key) => c13Pick('paid:conn:' + kind + ':' + key, kind === 'amplify' ? bank.amplify : bank.tension);
    const transition = (key) => c13Pick('paid:trans:' + key, bank.transitions);

    // 1. THE SPINE
    const spine = [c13Pick('paid:open', bank.openers), para(byId.lifePath, { details: 2 })];
    const lpRepeat = an.repeats.find((g) => g.members.some((m) => m.p.id === 'lifePath'));
    if (lpRepeat) {
      spine.push(connector('amplify', 'spine') + ' The same ' + regName(lpRepeat.register) + ' current runs through your ' + listLabels(lpRepeat.members.filter((m) => m.p.id !== 'lifePath')) + '.');
    }
    chapters.push({ title: 'The Spine', paras: spine });

    // 2. HOW YOU ACTUALLY OPERATE
    const op = [transition('operate')];
    ['dayBorn', 'combo', 'dayNum'].forEach((id, idx) => {
      const it = byId[id];
      if (!it) return;
      if (idx > 0 || true) {
        const prev = idx === 0 ? byId.lifePath : byId[['dayBorn', 'combo'][idx - 1]];
        if (prev && typeof registerRelation === 'function') {
          const rel = registerRelation(prev.register, it.register);
          if (rel === 'amplify') op.push(connector('amplify', id));
          else if (rel === 'tension') op.push(connector('tension', id));
        }
      }
      op.push(para(it, { details: id === 'dayBorn' ? 1 : 0 }));
    });
    chapters.push({ title: 'How You Actually Operate', paras: op });

    // 3. THE EMOTIONAL LAYER
    const emo = [transition('emotional')];
    if (byId.vietYear) emo.push(para(byId.vietYear, { deep: true, details: 1 }));
    if (byId.vietMonth) emo.push(para(byId.vietMonth, {}));
    if (byId.vietDay) emo.push(para(byId.vietDay, { lightOnly: true, lensArgs: [null, 'Communication', null] }));
    chapters.push({ title: 'The Emotional Layer', paras: emo });

    // 4. THE WESTERN LAYER
    const west = [transition('western')];
    if (byId.sun) west.push(para(byId.sun, {}));
    if (byId.saturn) west.push(para(byId.saturn, { lightOnly: true, lensArgs: [null, null, 'Work'] }));
    if (byId.jupiter) west.push(para(byId.jupiter, { lightOnly: true, lensArgs: [null, null, 'When Secure'] }));
    if (byId.venus) west.push(para(byId.venus, { lightOnly: true, lensArgs: [null, null, 'Relationships'] }));
    chapters.push({ title: 'The Western Layer', paras: west });

    // 5. THE REPEATING PATTERNS
    if (an.repeats.length) {
      const rep = [transition('repeats')];
      an.repeats.slice(0, 3).forEach((g, i) => {
        const consequence = bestLens(g.members, 'recognition', 'Real-Life Check', 'When Secure', usedLens);
        rep.push(connector('amplify', 'rep' + i) + ' Here it is your ' + listLabels(g.members) + ' all carrying the ' + regName(g.register) + ' current.' + (consequence ? ' ' + consequence : ''));
      });
      chapters.push({ title: 'The Repeating Patterns', paras: rep });
    }

    // 6. THE INTERNAL CONTRADICTIONS
    if (an.tensions.length) {
      const ten = [transition('tensions')];
      an.tensions.slice(0, 2).forEach((t, i) => {
        const a = t.membersA[0], b = t.membersB[0];
        ten.push(connector('tension', 'ten' + i) + ' Your ' + listLabels(t.membersA) + ' run on ' + regName(t.a) + ' while your ' + listLabels(t.membersB) + ' run on ' + regName(t.b) + '.');
      });
      chapters.push({ title: 'The Internal Contradictions', paras: ten });
    }

    // 7. WORK + AMBITION
    const work = [transition('work')];
    const workLead = an.repeats.length ? an.repeats[0].members : [byId.lifePath, byId.dayBorn].filter(Boolean);
    const w1 = bestLens([byId.lifePath].filter(Boolean), 'work', 'Work', 'Work', usedLens);
    const w2 = bestLens(workLead.concat([byId.dayBorn, byId.vietYear].filter(Boolean)), 'work', 'Work', 'Work', usedLens);
    if (w1) work.push(w1);
    if (w2) work.push(w2);
    if (work.length > 1) chapters.push({ title: 'Work and Ambition', paras: work });

    // 8. MONEY + RESOURCES - 8/28 doctrine leads when present.
    const money = [transition('money')];
    const wealthy = items.find((it) => it.p.kind === 'number' && (it.p.root === 8 || it.p.root === 28));
    if (wealthy) {
      const m = lens(wealthy, 'money', null, null);
      if (m && !usedLens.has(m)) { usedLens.add(m); money.push(m); }
    }
    const m2 = bestLens([byId.lifePath, byId.vietYear, byId.sun].filter(Boolean).filter((it) => it !== wealthy), 'money', 'Money / Resources', 'Money', usedLens);
    if (m2) money.push(m2);
    if (money.length > 1) chapters.push({ title: 'Money and Resources', paras: money });

    // 9. RELATIONSHIPS
    const rel = [transition('relationships')];
    const r1 = bestLens([byId.lifePath].filter(Boolean), 'relationships', 'Trust', 'Relationships', usedLens);
    const r2 = bestLens([byId.vietYear, byId.venus, byId.dayBorn].filter(Boolean), 'relationships', 'Trust', 'Relationships', usedLens);
    if (r1) rel.push(r1);
    if (r2) rel.push(r2);
    if (rel.length > 1) chapters.push({ title: 'Relationships', paras: rel });

    // 10. THE PRESSURE VERSION
    const pres = [transition('pressure')];
    const p1 = bestLens([byId.lifePath].filter(Boolean), 'threatened', 'Pressure Version', 'When Threatened', usedLens);
    const p2 = bestLens([byId.vietYear, byId.sun, byId.dayBorn].filter(Boolean), 'threatened', 'Pressure Version', 'When Threatened', usedLens);
    if (p1) pres.push(p1);
    if (p2) pres.push(p2);
    if (pres.length > 1) chapters.push({ title: 'The Pressure Version', paras: pres });

    // 11. THE CURRENT CHAPTER - identity vs timing stay separate jobs.
    if (me && typeof computeEnergyFlow === 'function' && window.C13B && C13B.bank10) {
      try {
        const ef = computeEnergyFlow(me, new Date());
        const n = ef.numerology;
        const cur = [transition('current')];
        const pyC = c13CycleCopy(n.personalYear, 'year');
        const pmC = c13CycleCopy(n.personalMonth, 'month');
        const pdC = c13CycleCopy(n.personalDay, 'day');
        const seenCycle = {};
        [[n.personalYear, pyC], [n.personalMonth, pmC], [n.personalDay, pdC]].forEach(([root, c]) => {
          if (!c || !c.line) return;
          if (seenCycle[root]) { cur.push('The same current is stacked in this horizon too.'); return; }
          seenCycle[root] = true;
          cur.push(c.line);
        });
        if (pdC && pdC.move) cur.push('The immediate move: ' + pdC.move);
        if (cur.length > 1) chapters.push({ title: 'The Current Chapter', paras: cur });
      } catch (e) {}
    }

    // 12. THE INTEGRATION - preserve / watch / one question / close.
    const keep = [];
    const watch = [];
    items.slice(0, 5).forEach((it) => {
      const k = c13Pick('paid:keep:' + it.dedupeKey, (it.entry.extra && it.entry.extra.length ? it.entry.extra : [it.entry.light]));
      if (k && keep.length < 4) keep.push(k);
    });
    [byId.lifePath, byId.vietYear, byId.sun].filter(Boolean).forEach((it) => {
      if (watch.length < 3 && it.entry.shadow) watch.push(it.entry.shadow);
    });
    const question = bestLens([byId.vietYear, byId.sun].filter(Boolean), null, 'Grounding Line', 'Grounding Question', usedLens);
    const integ = [transition('integration')];
    if (keep.length) integ.push('Worth preserving: ' + keep.join(' '));
    if (watch.length) integ.push('Worth watching: ' + watch.join(' '));
    if (question) integ.push(question);
    integ.push(c13Pick('paid:close', bank.closes));
    chapters.push({ title: 'The Integration', paras: integ });

    return { chapters, analysis: an };
  };

  /* ---------------- locked preview (free users) ---------------- */
  // Teaser fires only on a REAL computed qualifier (Bank 13/14 doctrine):
  // a repeated register or an established tension. No qualifier, no
  // mystery - the locked pool line carries the sale alone.
  window.c13PaidTeaser = function (r, birthDate) {
    const bank = B13();
    const b14 = (window.C13B && C13B.bank14) || null;
    if (!bank) return null;
    const an = analyze(resolveAll(buildParts(r, birthDate)));
    let teaser = null;
    if (b14 && b14.teasers) {
      if (an.repeats.length) {
        teaser = (b14.teasers.find((t) => t.indexOf('{register}') !== -1) || '').replace(/\{register\}/g, regName(an.repeats[0].register));
      } else if (an.tensions.length) {
        teaser = (b14.teasers.find((t) => t.indexOf('{sideA}') !== -1) || '')
          .replace(/\{sideA\}/g, regName(an.tensions[0].a))
          .replace(/\{sideB\}/g, regName(an.tensions[0].b));
      }
    }
    return { teaser: teaser || null, locked: c13Pick('paid:locked', bank.locked) };
  };

  /* ---------------- the Profile surface ---------------- */
  // Adds the "full reading" link next to the general reading. Entitled:
  // composes and shows the twelve chapters. Free: locked preview + the
  // reading paywall context. Called from render.js on profile only.
  window.c13PaidReadingLink = function (r, birthDate, me) {
    if (!B13()) return;
    const anchor = document.getElementById('generalReadingStoryLink');
    if (!anchor || document.getElementById('c13PaidReadingLink')) return;
    const link = document.createElement('button');
    link.id = 'c13PaidReadingLink';
    link.type = 'button';
    link.className = anchor.className;
    link.textContent = '🔮 the full reading';
    anchor.insertAdjacentElement('afterend', link);
    link.addEventListener('click', () => {
      const body = document.getElementById('storyModalBody');
      const overlay = document.getElementById('storyModalOverlay');
      if (!body || !overlay) return;
      if (window.c13Entitled && c13Entitled()) {
        const reading = c13ComposePaidReading(r, birthDate, me);
        if (!reading) return;
        body.innerHTML = '<div class="story-modal-title">Your Full Reading</div>' +
          reading.chapters.map((ch) =>
            '<div class="story-section"><div class="story-section-label">' + ch.title + '</div>' +
            ch.paras.filter(Boolean).map((p) => '<div class="story-section-body">' + p + '</div>').join('') + '</div>').join('');
      } else {
        const t = c13PaidTeaser(r, birthDate) || {};
        const cta = (window.C13B && C13B.bank14 && C13B.bank14.reading.ctas[0]) || 'Unlock My Full Reading';
        body.innerHTML = '<div class="story-modal-title">Your Full Reading</div>' +
          (t.teaser ? '<div class="story-row">' + t.teaser + '</div>' : '') +
          (t.locked ? '<div class="story-row">' + t.locked + '</div>' : '') +
          '<div class="c13-lock-cta" style="margin-top:14px" onclick="document.getElementById(\'storyModalOverlay\').classList.remove(\'active\');c13OpenPaywall(\'reading\')">' + cta + '</div>';
      }
      overlay.classList.add('active');
    });
  };
})();
