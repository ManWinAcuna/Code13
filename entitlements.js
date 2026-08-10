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

   BILLING IS A STUB until the Play Store build exists: c13Buy() explains
   purchases open at launch. The entitlement itself reads one localStorage
   key so the real Play Billing/Firebase verification can swap in behind
   c13Entitled() without touching any gate. Dev grant for testing:
   localStorage.setItem('code13_plus', '{"active":true,"tier":"dev"}') */
(function () {
  const ENTITLE_KEY = 'code13_plus';
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

  // "27 free readings left · unlimited with Code13+" - the always-visible
  // counter line (locked copy decision: visible from first use).
  window.c13MeterLineHtml = function (kind) {
    if (window.c13Entitled()) return '';
    const m = METERS[kind];
    const left = window.c13MeterLeft(kind);
    // Full-send at the low end: the cap is real, so the copy says what
    // running out actually means.
    if (left <= 5) {
      return `<div class="c13-meter-line low">${left} ${m.noun} left. After that, you're back to guessing. <button type="button" class="c13-meter-plus" onclick="c13OpenPaywall('${kind}')">Code13+</button></div>`;
    }
    return `<div class="c13-meter-line">${left} ${m.noun} left · <button type="button" class="c13-meter-plus" onclick="c13OpenPaywall('${kind}')">unlimited with Code13+</button></div>`;
  };

  /* ---------------- Lock tease cards ----------------
     Locked copy voice: direct value tease + progress framing. Each locked
     surface names exactly what's behind the lock, terse, then Code13+. */
  window.c13LockHtml = function (title, tease, progress, context) {
    return `
      <div class="c13-lock" onclick="c13OpenPaywall('${context || 'generic'}')" role="button" tabindex="0">
        <div class="c13-lock-top"><span class="c13-lock-ic">🔒</span><span class="c13-lock-title">${title}</span></div>
        <div class="c13-lock-tease">${tease}</div>
        ${progress ? `<div class="c13-lock-progress">${progress}</div>` : ''}
        <div class="c13-lock-cta">Code13+</div>
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
      note: '3-day free trial', cta: 'Start Free Trial',
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
    if (note) {
      note.textContent = 'Purchases open when Code13 reaches the Play Store. Founding pricing is locked in for launch.';
      note.classList.add('on');
    }
  };

  window.c13ClosePaywall = function () {
    const el = document.getElementById('c13Paywall');
    if (el) el.remove();
  };

  // Each lock opens the paywall with its own pitch (owner's call: no one
  // generic body, and no shared line glued onto every context - the
  // first version's repeated proof sentence read as repetitive and
  // didn't fit half of them). Each body is its own emotional scene:
  // the reader's specific moment of flying blind, unresolved.
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

  window.c13OpenPaywall = function (context) {
    if (document.getElementById('c13Paywall')) return;
    const bodyText = CONTEXT_COPY[context] || CONTEXT_COPY.generic;
    const cards = TIERS.map((t) => `
      <div class="c13-tier${t.badgeHot ? ' hot' : ''}${t.badgeGold ? ' gold' : ''}">
        <div class="c13-tier-badge">${t.badge}</div>
        <div class="c13-tier-name">${t.name}</div>
        <div class="c13-tier-price"><s>${t.list}</s> <b>${t.offer}</b><span>${t.per}</span></div>
        <div class="c13-tier-note">${t.note}</div>
        <button type="button" class="c13-tier-cta" onclick="c13Buy('${t.id}')">${t.cta}</button>
      </div>`).join('');

    const wrap = document.createElement('div');
    wrap.id = 'c13Paywall';
    wrap.innerHTML = `
      <div class="c13-pw-inner">
        <button type="button" class="c13-pw-close" onclick="c13ClosePaywall()" title="Close">&times;</button>
        <div class="c13-pw-head">Unlock Your Full Code</div>
        <div class="c13-pw-sub">Founding launch offer · first 130 members</div>
        <div class="c13-pw-sig">From Guessing to Planning</div>
        <div class="c13-pw-body">${bodyText}</div>
        <div class="c13-tiers">${cards}</div>
        <div class="c13-pw-note" id="c13PaywallNote"></div>
        <div class="c13-pw-fine">Subscriptions renew automatically until canceled. Founding prices apply while founding spots last.</div>
      </div>`;
    document.body.appendChild(wrap);
  };

  const css = `
    #c13Paywall { position: fixed; inset: 0; z-index: 950; background: rgba(0,0,0,.92);
      display: flex; align-items: center; justify-content: center; overflow-y: auto; }
    .c13-pw-inner { position: relative; width: min(430px, calc(100% - 28px)); margin: 24px auto;
      background: var(--panel, #0a0f1a); border: 1px solid var(--border, #223048);
      border-radius: 18px; padding: 26px 18px 18px; text-align: center;
      box-shadow: 0 0 60px rgba(245,197,66,.12); }
    .c13-pw-close { position: absolute; top: 8px; right: 12px; background: none; border: none;
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
    .c13-pw-fine { margin-top: 10px; font-size: 10px; color: var(--muted, #5b6a80); line-height: 1.5; }
    .c13-meter-line { margin-top: 8px; font-size: 11.5px; color: var(--muted, #5b6a80); text-align: center; }
    .c13-meter-line.low { color: var(--acc-text, #e8b04b); }
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
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
