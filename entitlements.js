/* Code13+ entitlement + paywall layer (2026-08-10).
   Self-contained like bottombar.js: injects its own CSS and builds the
   full-screen paywall on demand. Every free/paid gate in the app runs
   through here so the rules live in exactly one place.

   The gating rules (locked spec - see project_paywall_gating memory):
   - Compatibility: 31 free checks, ONE-TIME lifetime cap, then Code13+.
   - Famous Lookup: 130 free lookups, lifetime cap, then Code13+.
   - Database: fully paid - a free user can't add anyone.
   - Today's Hours: computed pages hide it behind a visible tease.
   - Calendar: current + past months free, future months paid.
   - Profile: Pinnacles + the Personal Year Roadmap paid; PY/PM/PD,
     Yearly Outlook stay free. Calculator and Astrology: fully free.

   BILLING (launch 2026-08-26): Stripe Payment Links per tier in PAY_LINKS
   below - c13Buy opens the tier's checkout in a new tab. After a purchase
   the OWNER attaches Code13+ to the buyer's account by hand (see the
   grantSync block at the bottom for the exact console steps); signed-in
   devices pick the grant up on the next page load. Tiers with no link yet
   fall back to an "opens shortly" note. The entitlement itself stays one
   localStorage key behind c13Entitled(), so real automated verification
   (Play Billing / Stripe webhooks) can swap in later without touching any
   gate. Dev grant for testing:
   localStorage.setItem('code13_plus', '{"active":true,"tier":"dev"}') */
(function () {
  const ENTITLE_KEY = 'code13_plus';
  // Stripe Payment Links, one per tier (live 2026-08-26). Empty string =
  // not purchasable yet. Standard Stripe Checkout, not Managed Payments -
  // the code13 Stripe account isn't verified for Managed Payments yet, so
  // those links 404'd with a "product category required" error; regular
  // Payment Links work immediately on an unverified account.
  const PAY_LINKS = {
    weekly: 'https://buy.stripe.com/5kQfZae609Kb4o1dJYcMM02',
    monthly: 'https://buy.stripe.com/8x26oA2o6aOff2F35kcMM01',
    lifetime: 'https://buy.stripe.com/5kQ28k9Qy4pRcUx9tIcMM00',
  };
  const METERS = {
    compat: { key: 'code13_meter_compat', limit: 31, noun: 'free readings' },
    famous: { key: 'code13_meter_famous', limit: 130, noun: 'free lookups' },
  };

  window.c13Entitled = function () {
    try {
      const e = JSON.parse(localStorage.getItem(ENTITLE_KEY) || 'null');
      return !!(e && e.active);
    } catch (err) { return false; }
  };

  // Active PLAN tier ('weekly' | 'monthly' | 'lifetime' | 'dev'), or null.
  // NOT named c13Tier: c13-copy.js owns window.c13Tier for COPY tiers
  // (peak/mid/clash by score) and loads after this file - a same-name
  // function here gets silently clobbered (caught live 2026-08-25).
  window.c13PlanTier = function () {
    try {
      const e = JSON.parse(localStorage.getItem(ENTITLE_KEY) || 'null');
      return e && e.active ? (e.tier || 'lifetime') : null;
    } catch (err) { return null; }
  };

  // Monthly-and-above surfaces (owner calls 2026-08-25): Personal Hours
  // and Pinnacles. Weekly members keep every other Code13+ surface; these
  // stay locked for them, on every page that renders them. Reads the
  // entitlement directly so no window-name collision can ever change the
  // verdict.
  window.c13MonthlyPlus = function () {
    try {
      const e = JSON.parse(localStorage.getItem(ENTITLE_KEY) || 'null');
      if (!e || !e.active) return false;
      return (e.tier || 'lifetime') !== 'weekly';
    } catch (err) { return false; }
  };
  window.c13HoursEntitled = window.c13MonthlyPlus;

  window.c13MeterLeft = function (kind) {
    const m = METERS[kind];
    if (!m) return 0;
    const used = parseInt(localStorage.getItem(m.key) || '0', 10) || 0;
    return Math.max(0, m.limit - used);
  };

  window.c13MeterUse = function (kind) {
    const m = METERS[kind];
    if (!m) return;
    const used = parseInt(localStorage.getItem(m.key) || '0', 10) || 0;
    try { localStorage.setItem(m.key, String(used + 1)); } catch (err) {}
  };

  /* ---------------- Bank 14 sales copy (owner-authored) ----------------
     All user-facing sales language comes from C13B.bank14 (banks/
     c13-bank-paid.js) when loaded - meter lines, lock teases, the paywall
     itself. Day-seeded rotation, {token} interpolation from live state.
     Every reader falls back to the original v5 strings when the bank file
     isn't on a page, so nothing can render blank. */
  function b14() { return (window.C13B && C13B.bank14) || null; }
  function dayHash(key) {
    const d = new Date();
    const s = String(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) + '|' + key;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function pick14(key, arr) {
    if (!arr || !arr.length) return null;
    return arr[dayHash(key) % arr.length];
  }
  function fillTokens(s, kind) {
    if (!s) return s;
    const m = kind && METERS[kind];
    const used = m ? Math.min(m.limit, parseInt(localStorage.getItem(m.key) || '0', 10) || 0) : 0;
    return s
      .replace(/\{used\}/g, String(used))
      .replace(/\{remaining\}/g, m ? String(Math.max(0, m.limit - used)) : '')
      .replace(/\{weekly_price\}/g, '$9.03')
      .replace(/\{monthly_price\}/g, '$31')
      .replace(/\{lifetime_price\}/g, '$130')
      .replace(/\{trial_days\}/g, '3')
      .replace(/\{member_cap\}/g, '130');
  }

  // Meter line: normal meter copy while there's room, near-limit pool at
  // 5 or fewer, limit pool at 0. Real counts only - Bank 14 doctrine.
  window.c13MeterLineHtml = function (kind) {
    if (window.c13Entitled()) return '';
    const m = METERS[kind];
    const left = window.c13MeterLeft(kind);
    const bank = b14();
    const pools = bank && (kind === 'compat' ? bank.compat : bank.famous);
    if (pools) {
      const pool = left <= 0 ? pools.limit : left <= 5 ? pools.near : pools.meter;
      const line = fillTokens(pick14('meter:' + kind + ':' + (left <= 0 ? 'limit' : left <= 5 ? 'near' : 'ok'), pool), kind);
      const cta = pick14('meterCta:' + kind, pools.ctas) || 'Get Code13+';
      const cls = left <= 5 ? 'c13-meter-line low' : 'c13-meter-line';
      // The rotating Bank 14 line doesn't always spell out the count - some
      // variants are pure flavor text with no {remaining}/{used} token - so
      // "how many do I have left" wasn't always answered, depending on which
      // line the daily rotation landed on. User, 2026-08-26: "it should tell
      // you how many lookups you have left." This small count is always
      // present regardless of rotation; Bank 14's own line is untouched.
      return `<div class="${cls}"><div class="c13-meter-count">${left} of ${m.limit} ${m.noun} left</div>${line} <button type="button" class="c13-meter-plus" onclick="c13OpenPaywall('${kind}')">${cta}</button></div>`;
    }
    if (left <= 5) {
      return `<div class="c13-meter-line low">${left} ${m.noun} left. <button type="button" class="c13-meter-plus" onclick="c13OpenPaywall('${kind}')">Go Unlimited</button></div>`;
    }
    return `<div class="c13-meter-line">${left} ${m.noun} left · <button type="button" class="c13-meter-plus" onclick="c13OpenPaywall('${kind}')">unlimited with Code13+</button></div>`;
  };

  /* ---------------- Lock tease cards ----------------
     Locked copy voice: direct value tease + progress framing. The CTA is
     benefit-first from the surface's own Bank 14 pool ("Unlock My
     Pinnacles" beats a generic tier name), falling back to Code13+. */
  const SURFACE_OF = {
    hours: 'hours', calendar: 'calendar', pinnacles: 'pinnacles', roadmap: 'roadmap',
    compat: 'compat', famous: 'famous', database: 'database', reading: 'reading',
  };
  function surfacePool(context) {
    const bank = b14();
    if (!bank) return null;
    const key = SURFACE_OF[context];
    return key ? bank[key] : null;
  }
  function surfaceCta(context) {
    const p = surfacePool(context);
    const cta = p && p.ctas && p.ctas.length ? p.ctas[0] : null;
    return cta || 'Code13+';
  }
  // A rotated Bank 14 line for a lock surface, or the caller's fallback
  // when the bank isn't loaded there. Used by every tease outside this file.
  window.c13SurfaceLine = function (context, fallback) {
    const p = surfacePool(context);
    const line = p ? pick14('surf:' + context, p.lines) : null;
    return line ? fillTokens(line, SURFACE_OF[context] === 'compat' || SURFACE_OF[context] === 'famous' ? context : null) : fallback;
  };
  window.c13LockHtml = function (title, tease, progress, context) {
    return `
      <div class="c13-lock" onclick="c13OpenPaywall('${context || 'generic'}')" role="button" tabindex="0">
        <div class="c13-lock-top"><span class="c13-lock-ic">🔒</span><span class="c13-lock-title">${title}</span></div>
        <div class="c13-lock-tease">${tease}</div>
        ${progress ? `<div class="c13-lock-progress">${progress}</div>` : ''}
        <div class="c13-lock-cta">${surfaceCta(context)}</div>
      </div>`;
  };

  /* ---------------- The paywall ----------------
     Full-screen takeover, dismissable X. Headline is benefit-led with the
     founding offer directly under it; three cards, each with its own
     locked selling angle. NO live spots-left number until a real backend
     counts actual purchases - never fabricate one. */
  const TIERS = [
    {
      id: 'weekly', badge: 'Easy Start', name: 'Weekly',
      list: '$13', offer: '$9.03', per: '/week',
      note: 'Billed weekly, cancel anytime', cta: 'Get Weekly',
    },
    {
      id: 'monthly', badge: 'Most Popular', badgeHot: true, name: 'Monthly',
      list: '$40', offer: '$31', per: '/month',
      note: '3-day free trial', cta: 'Start Free Trial',
    },
    {
      id: 'lifetime', badge: 'Founding · First 130', badgeGold: true, name: 'Lifetime',
      list: '$310', offer: '$130', per: ' once',
      // Founder numbers are a committed product feature (Boost13 copy
      // spec): each of the 130 gets Founder #N on their profile forever.
      // Assignment needs the real backend - the promise ships now.
      note: 'Yours forever. Your founder number, on your profile, permanent.', cta: 'Claim Founding Spot',
    },
  ];

  window.c13Buy = function (tierId) {
    const note = document.getElementById('c13PaywallNote');
    const link = PAY_LINKS[tierId];
    if (!link) {
      if (note) {
        note.textContent = 'This plan opens shortly. Founding pricing is locked in.';
        note.classList.add('on');
      }
      return;
    }
    const user = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
    if (note) {
      note.textContent = user
        ? 'Checkout opened in a new tab. Pay with the same email as your Code13 account (' + user.email + ') and your access unlocks once the payment is confirmed.'
        : 'Checkout opened in a new tab. Important: create your free Code13 account with the SAME email you pay with, so your purchase can be attached to it.';
      note.classList.add('on');
    }
    window.open(link, '_blank', 'noopener');
  };

  // 2026-08-26, user: the paywall "doesn't lock everything around it" -
  // scrolling inside it dragged the page behind it too. Plain
  // `overflow:hidden` on body doesn't reliably stop that on iOS Safari
  // (touch scroll still bleeds through); pinning body with a negative top
  // offset is the standard fix, restored to the exact scroll position on
  // close.
  function c13LockBodyScroll() {
    const y = window.scrollY;
    document.body.dataset.c13ScrollY = String(y);
    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function c13UnlockBodyScroll() {
    const y = parseInt(document.body.dataset.c13ScrollY || '0', 10);
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    delete document.body.dataset.c13ScrollY;
    window.scrollTo(0, y);
  }

  window.c13ClosePaywall = function () {
    const el = document.getElementById('c13Paywall');
    if (el) el.remove();
    c13UnlockBodyScroll();
  };

  // Fallback bodies only (pre-Bank-14 copy) - used when banks/c13-bank-
  // paid.js isn't loaded on a page. With the bank present, every string
  // in the paywall comes from the owner's Bank 14 pools.
  const CONTEXT_COPY = {
    hours: "Somewhere in today is an hour where you land everything. You'll probably spend it on nothing. The call you're dreading? You'll make it in a red hour and never know. The map exists.",
    database: "The same fight, with the same person, for the same reason. It has a number, and it's been there the whole time. Read the people you love once and stop being blindsided by them.",
    pinnacles: "There was a year your whole life shifted and nobody could tell you why. That was a chapter turning. You're standing in one right now, and it has an end date you've never seen.",
    roadmap: "Some of your next ten years are built for the big swing. Others will take everything you pour in and hand nothing back. They're already scored. Right now you're planning them blind.",
    calendar: "A wedding date. A launch day. A flight. You'll pick them the way everyone does: blind. Next month is already scored, day by day. Look before, or find out after.",
    compat: "The moment you start counting readings, you start skipping the ones that matter. The new job, the new name, the thing you're about to sign. Everything you say yes to has a number. Check it while it can still change your answer.",
    famous: "Run the people whose lives you already know. Watch the numbers call what happened to them, decade by decade. Then remember: you have the same numbers. Yours are still unfolding.",
    generic: "You've been living these numbers your whole life without ever reading them. Every person, every day, every hour, already scored. That ends when you unlock it.",
  };

  // Bank 14 plan copy lines arrive prefixed ("WEEKLY:", "LIFETIME SUPPORT:").
  function planLine(prefix) {
    const bank = b14();
    if (!bank) return null;
    const hit = (bank.plans.copy || []).find((l) => l.startsWith(prefix + ':'));
    return hit ? fillTokens(hit.slice(prefix.length + 1).trim()) : null;
  }

  window.c13OpenPaywall = function (context) {
    if (document.getElementById('c13Paywall')) return;
    const bank = b14();

    // Bank 14 doctrine: sell the exact thing the user just tried to do -
    // context first, pricing second. Surface paywalls lead with their own
    // benefit-first CTA as the head and a rotated surface line as the
    // body; the generic entry uses the primary upgrade screen structure.
    let head = 'Unlock Your Full Code';
    let sub = 'Founding launch offer · first 130 members';
    let bodyText = CONTEXT_COPY[context] || CONTEXT_COPY.generic;
    let bulletsHtml = '';
    let fine = 'Subscriptions renew automatically until canceled. Founding prices apply while founding spots last.';
    let exitHtml = '';
    if (bank) {
      const pool = surfacePool(context);
      if (pool) {
        head = (pool.ctas && pool.ctas.length ? pool.ctas[0] : pick14('pw:head', bank.headlines)) || head;
        // Not every surface pool carries its own body lines (e.g. `famous`
        // only has meter/near/limit/ctas) - pick14 returns null for those,
        // and fillTokens(null) passes null straight through, which rendered
        // as the literal text "null" in the popup (user, 2026-08-26: "theres
        // also something that just says null"). Falls back to the existing
        // hand-written CONTEXT_COPY line for that surface instead of ever
        // showing a raw null.
        const picked = pick14('pw:body:' + context, pool.lines);
        bodyText = picked
          ? fillTokens(picked, SURFACE_OF[context] === 'compat' || SURFACE_OF[context] === 'famous' ? context : null)
          : (CONTEXT_COPY[context] || CONTEXT_COPY.generic);
      } else {
        head = pick14('pw:head', bank.headlines) || head;
        const pickedGeneric = pick14('pw:body:generic', bank.global);
        bodyText = pickedGeneric ? fillTokens(pickedGeneric) : CONTEXT_COPY.generic;
      }
      sub = pick14('pw:sub', bank.supporting) || sub;
      // 4 benefit bullets, rotated daily, the whole set over time.
      const off = dayHash('pw:bullets') % bank.bullets.length;
      const chosen = [];
      for (let i = 0; i < 4; i++) chosen.push(bank.bullets[(off + i) % bank.bullets.length]);
      bulletsHtml = `<div class="c13-pw-bullets">${chosen.map((x) => `<div class="c13-pw-bullet">${x}</div>`).join('')}</div>`;
      const trust = pick14('pw:trust', bank.trust);
      const founding = fillTokens((bank.lifetime.lines || []).find((l) => l.indexOf('{member_cap}') !== -1 || l.indexOf('first') !== -1) || '');
      fine = [trust, founding].filter(Boolean).join(' ');
      const exitLabel = pick14('pw:exit', bank.exit.labels) || 'Not now';
      exitHtml = `<button type="button" class="c13-pw-exit" onclick="c13ClosePaywall()">${exitLabel}</button>`;
    }

    // 2026-08-26, user: "the weekly shouldn't have a 3 day trial... straight
    // to buy, only monthly." The trial itself lives on the Monthly Stripe
    // Payment Link's own settings (not this file) - this only swaps which
    // card's CTA/badge advertises it.
    const tierCopy = bank ? {
      weekly: { note: planLine('WEEKLY'), cta: 'Get Weekly', badge: 'Easy Start' },
      monthly: { note: planLine('MONTHLY'), cta: 'Start 3-Day Trial', badge: '3-Day Trial' },
      lifetime: { note: planLine('LIFETIME'), cta: 'Get Lifetime', badge: 'Founding Offer' },
    } : null;
    const cards = TIERS.map((t) => {
      const c = tierCopy && tierCopy[t.id];
      return `
      <div class="c13-tier${t.badgeHot ? ' hot' : ''}${t.badgeGold ? ' gold' : ''}">
        <div class="c13-tier-badge">${c ? c.badge : t.badge}</div>
        <div class="c13-tier-name">${t.name}</div>
        <div class="c13-tier-price"><s>${t.list}</s> <b>${t.offer}</b><span>${t.per}</span></div>
        <div class="c13-tier-note">${c && c.note ? c.note : t.note}</div>
        <button type="button" class="c13-tier-cta" onclick="c13Buy('${t.id}')">${c ? c.cta : t.cta}</button>
      </div>`;
    }).join('');

    const wrap = document.createElement('div');
    wrap.id = 'c13Paywall';
    wrap.innerHTML = `
      <div class="c13-pw-inner">
        <button type="button" class="c13-pw-close" onclick="c13ClosePaywall()" title="Close">&times;</button>
        <div class="c13-pw-head">${head}</div>
        <div class="c13-pw-sub">${sub}</div>
        <div class="c13-pw-body">${bodyText}</div>
        ${bulletsHtml}
        <div class="c13-tiers">${cards}</div>
        <div class="c13-pw-note" id="c13PaywallNote"></div>
        ${exitHtml}
        <div class="c13-pw-fine">${fine}</div>
      </div>`;
    document.body.appendChild(wrap);
    c13LockBodyScroll();
  };

  const css = `
    /* Plain block layout, not flex align-items:center - a flex container
       centering an item taller than its own viewport clips the item's top
       out of reach of overflow-y:auto's scroll (a well-known flexbox bug),
       which is exactly why this popup wasn't centering right on shorter
       screens (user, 2026-08-27). margin:auto on the inner box handles
       horizontal centering fine on its own and never clips vertically. */
    #c13Paywall { position: fixed; inset: 0; z-index: 950; background: rgba(0,0,0,.92);
      overflow-y: auto; }
    .c13-pw-inner { position: relative; width: min(430px, calc(100% - 28px)); margin: 24px auto;
      background: var(--panel, #0a0f1a); border: 1px solid var(--border, #223048);
      border-radius: 18px; padding: 26px 18px 18px; text-align: center;
      box-shadow: 0 0 60px rgba(245,197,66,.12); }
    /* A bare 26px glyph with no padding has almost no real hit area on
       mobile - widened to a proper ~40px tap target without changing
       where the "x" itself visually sits (user, 2026-08-27: "hard to
       tap"). */
    .c13-pw-close { position: absolute; top: 2px; right: 2px; background: none; border: none;
      width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
      color: var(--muted, #5b6a80); font-size: 26px; cursor: pointer; line-height: 1; }
    .c13-pw-head { font-family: var(--gk-display, inherit); font-size: 24px; font-weight: 700;
      color: var(--yellow, #f5c542); letter-spacing: .02em; }
    .c13-pw-sub { margin-top: 5px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase;
      color: var(--acc-text, #e8b04b); }
    .c13-pw-sig { margin-top: 12px; font-size: 15px; font-style: italic; color: var(--text, #dfe7f3);
      letter-spacing: .03em; }
    .c13-pw-body { margin: 10px auto 16px; max-width: 320px; font-size: 13.5px; line-height: 1.5;
      color: var(--text, #dfe7f3); }
    .c13-tiers { display: flex; flex-direction: column; gap: 10px; }
    .c13-tier { position: relative; border: 1px solid var(--border, #223048); border-radius: 14px;
      padding: 14px 12px 12px; background: rgba(255,255,255,.02); }
    .c13-tier.hot { border-color: var(--yellow, #f5c542); }
    .c13-tier.gold { border-color: var(--acc-text, #e8b04b); background: rgba(245,197,66,.06); }
    .c13-tier-badge { position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
      background: var(--panel, #0a0f1a); border: 1px solid var(--border, #223048); border-radius: 20px;
      padding: 2px 10px; font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase;
      color: var(--muted, #5b6a80); white-space: nowrap; }
    .c13-tier.hot .c13-tier-badge { color: var(--yellow, #f5c542); border-color: var(--yellow, #f5c542); }
    .c13-tier.gold .c13-tier-badge { color: var(--acc-text, #e8b04b); border-color: var(--acc-text, #e8b04b); }
    .c13-tier-name { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--text, #dfe7f3); }
    .c13-tier-price { margin-top: 4px; }
    .c13-tier-price s { color: var(--muted, #5b6a80); font-size: 14px; margin-right: 6px; }
    .c13-tier-price b { font-size: 24px; color: var(--yellow, #f5c542); font-family: var(--gk-display, inherit); }
    .c13-tier-price span { font-size: 12px; color: var(--muted, #5b6a80); }
    .c13-tier-note { margin-top: 3px; font-size: 11px; color: var(--muted, #5b6a80); }
    .c13-tier-cta { margin-top: 9px; width: 100%; padding: 10px 0; border-radius: 10px; border: none;
      cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700;
      background: var(--yellow, #f5c542); color: #10131c; }
    .c13-tier.gold .c13-tier-cta { background: var(--acc-text, #e8b04b); }
    .c13-pw-note { margin-top: 10px; font-size: 12px; color: var(--acc-text, #e8b04b); min-height: 0; display: none; }
    .c13-pw-note.on { display: block; }
    .c13-pw-bullets { margin: 4px auto 14px; max-width: 320px; text-align: left; }
    .c13-pw-bullet { position: relative; padding: 3px 0 3px 18px; font-size: 12.5px; line-height: 1.45;
      color: var(--text, #dfe7f3); }
    .c13-pw-bullet::before { content: '✦'; position: absolute; left: 0; top: 3px;
      color: var(--yellow, #f5c542); font-size: 11px; }
    .c13-pw-exit { margin-top: 12px; background: none; border: none; cursor: pointer; font-family: inherit;
      font-size: 12.5px; color: var(--muted, #5b6a80); text-decoration: underline; }
    .c13-pw-fine { margin-top: 10px; font-size: 10px; color: var(--muted, #5b6a80); line-height: 1.5; }
    .c13-meter-line { margin-top: 8px; font-size: 11.5px; color: var(--muted, #5b6a80); text-align: center; }
    .c13-meter-line.low { color: var(--acc-text, #e8b04b); }
    .c13-meter-count { font-weight: 700; color: var(--text, #dfe7f3); margin-bottom: 2px; }
    .c13-meter-plus { background: none; border: none; padding: 0; cursor: pointer; font-family: inherit;
      font-size: 11.5px; color: var(--acc-text, #e8b04b); text-decoration: underline; }
    .c13-lock { border: 1px dashed var(--border, #223048); border-radius: 14px; padding: 14px;
      margin: 10px 0; cursor: pointer; background: rgba(255,255,255,.02); }
    .c13-lock-top { display: flex; align-items: center; gap: 8px; justify-content: center; }
    .c13-lock-ic { font-size: 15px; }
    .c13-lock-title { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--text, #dfe7f3); }
    .c13-lock-tease { margin-top: 6px; font-size: 13px; color: var(--text, #dfe7f3); text-align: center; }
    .c13-lock-progress { margin-top: 4px; font-size: 11px; color: var(--muted, #5b6a80); text-align: center; }
    .c13-lock-cta { margin: 9px auto 0; width: fit-content; padding: 5px 16px; border-radius: 18px;
      font-size: 11.5px; font-weight: 700; background: var(--yellow, #f5c542); color: #10131c; }
    /* Blurred-in-place tease: the section stays visible so free users see
       the shape of what exists, but what's under the blur is DECOY data -
       the real values never enter the DOM, so nothing leaks via devtools. */
    .c13-blurwrap { position: relative; }
    /* Unscoped (2026-08-14): blurred values also live OUTSIDE a blurwrap
       now - the hours best/worst/money boxes blur just their value text. */
    .c13-blurred { filter: blur(7px); user-select: none; pointer-events: none; }
    .c13-blur-overlay { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 6px; cursor: pointer;
      background: rgba(0,0,0,.25); border-radius: 12px; border: none; width: 100%;
      font-family: inherit; color: var(--text, #dfe7f3); padding: 10px; }
    .c13-blur-overlay .c13-bo-line { font-size: 12px; text-align: center; line-height: 1.4;
      max-width: 300px; text-shadow: 0 1px 6px #000; }
    .c13-blur-overlay .c13-lock-cta { margin: 2px auto 0; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---- cloud entitlement grants (launch flow, 2026-08-25) --------------
     After a Stripe purchase the OWNER attaches Code13+ to the buyer's
     account by hand:
       Firebase console -> Authentication -> Users -> find the buyer's
       email -> copy their UID -> Firestore -> users -> {that UID} ->
       Start collection "meta" -> document id "plus" ->
       fields: active (boolean) true, tier (string) "lifetime".
     Console writes bypass security rules; clients can only READ their own
     doc (existing users/{uid} rule), so nothing new to publish. A signed
     in device picks the grant up on the next page load and reloads once
     to unlock. Deleting the doc revokes on next load the same way. The
     SDK is never force-loaded: this only runs in browsers that have
     signed in before (same condition firebase-loader auto-loads on). */
  (function grantSync() {
    let ever = null;
    try { ever = localStorage.getItem('numerology_ever_signed_in'); } catch (err) {}
    if (!ever) return;
    let tries = 0;
    (function waitForAuth() {
      if (!(window.firebase && firebase.auth && firebase.firestore)) {
        if (++tries < 200) setTimeout(waitForAuth, 150);
        return;
      }
      firebase.auth().onAuthStateChanged(function (user) {
        if (!user) return;
        firebase.firestore().collection('users').doc(user.uid)
          .collection('meta').doc('plus').get()
          .then(function (snap) {
            let local = null;
            try { local = JSON.parse(localStorage.getItem(ENTITLE_KEY) || 'null'); } catch (err) {}
            const granted = snap.exists && snap.data() && snap.data().active;
            if (granted && !(local && local.active)) {
              try {
                localStorage.setItem(ENTITLE_KEY, JSON.stringify({
                  active: true,
                  tier: (snap.data() && snap.data().tier) || 'lifetime',
                  src: 'cloud',
                }));
              } catch (err) {}
              location.reload();
            } else if (!granted && local && local.active && local.src === 'cloud') {
              try { localStorage.removeItem(ENTITLE_KEY); } catch (err) {}
              location.reload();
            }
          })
          .catch(function () { /* offline or transient: keep current state */ });
      });
    })();
  })();
})();
