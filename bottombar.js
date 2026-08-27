/* App-wide bottom tab bar (The Stable's nav pattern, promoted to the whole
   app). Self-contained: injects its own CSS + markup, replaces the scrolling
   topnav (hidden, markup left untouched), and highlights the active tab —
   including on sub-pages (UFC under Markets, category under Tools, etc.).
   stable.html does NOT load this: it keeps its own internal tab bar. */
(function () {
  // Code13 ships only the 8 agreed pages (no Markets/Stable/EMAX/Cloud
  // Restore - those are numerology-app-only, see project_code13_boost13_spec
  // memory: "strictly the 8, no exceptions").
  // Today stands alone, dead center (owner's call 2026-08-13) - the same
  // center-slot treatment the Stable horse gets in numerology-app.
  // Database is promoted to its own tab (it's the flagship paid feature).
  // 2026-08-26, user: swapped which slot is the dropdown - Famous Lookup
  // now stands alone (was buried a tap deep inside Tools), and Tools took
  // over Database's old slot/label, now holding Calculator, Compatibility,
  // AND Database together.
  // 2026-08-26: owner-provided icon set (real inline SVG, viewBox 64x64) -
  // swaps the plain emoji glyphs for the illustrated line-art badges. Sheet
  // items (Calendar/Astrology/Calculator/Compatibility/Database) keep their
  // small emoji icons - only the 5 main tabs got real art.
  const ICON_SVG = {
    days: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="11" y="15" width="42" height="38" rx="5"/><path d="M19 9v12M45 9v12M11 27h42"/><text x="32" y="44" text-anchor="middle" class="icon-number">13</text></svg>',
    famous: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="27" cy="27" r="16"/><path d="M39 39l14 14"/><path class="nav-accent" d="M27 18 L29.4 24.6 L36 27 L29.4 29.4 L27 36 L24.6 29.4 L18 27 L24.6 24.6 Z"/></svg>',
    today: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="11"/><path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M52 12l-6 6M18 46l-6 6"/><circle cx="32" cy="32" r="20" class="sun-orbit"/></svg>',
    tools: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="9" width="44" height="46" rx="4"/><path d="M19 15v34M29 15v34M39 15v34M49 15v34"/><path d="M14 24h36M14 39h36"/><circle cx="19" cy="24" r="3"/><circle cx="29" cy="24" r="3"/><circle cx="39" cy="24" r="3"/><circle cx="49" cy="24" r="3"/><circle cx="19" cy="39" r="3"/><circle cx="29" cy="39" r="3"/><circle cx="39" cy="39" r="3"/><circle cx="49" cy="39" r="3"/></svg>',
    profile: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="21" r="10"/><path d="M15 53c0-12.7 7.6-20 17-20s17 7.3 17 20"/></svg>',
  };

  const TABS = [
    { id: 'days', label: 'Days', items: [
      { href: 'calendar.html', icon: '📅', label: 'Calendar' },
      { href: 'astrology.html', icon: '🌙', label: 'Astrology' },
    ], match: ['calendar', 'astrology'] },
    { id: 'famous', label: 'Lookup', href: 'famous.html', match: ['famous'] },
    { id: 'today', label: 'Today', href: 'today.html', match: ['today'] },
    { id: 'tools', label: 'Tools', items: [
      { href: 'calculator.html', icon: '🧮', label: 'Calculator' },
      { href: 'compatibility.html', icon: '🤝', label: 'Compatibility' },
      { href: 'database.html', icon: '🗂', label: 'Database' },
    ], match: ['calculator', 'compatibility', 'database', 'category'] },
    { id: 'profile', label: 'Profile', href: 'profile.html', match: ['profile'] },
  ];

  const file = (location.pathname.split('/').pop() || 'profile.html').replace('.html', '') || 'profile';
  const activeTab = TABS.find((t) => t.match.some((m) => file === m || file.startsWith(m)));

  // Ground truth from device telemetry (iPhone 15 Pro Max): in the installed
  // app, scroll-locked pages get an 873pt canvas on a 932pt screen — the
  // bottom 59pt (status-bar height) is UNPAINTABLE, so no fixed/sticky/
  // translate trick can ever reach it. The Stable (normal document scroll)
  // gets the full canvas under identical meta tags. So in standalone mode we
  // unlock document scrolling (neutralize the .scroll-viewport lock) and let
  // plain fixed positioning work exactly like it does on The Stable.
  if (navigator.standalone === true) document.documentElement.classList.add('bb-standalone');

  const css = `
    .topnav { display: none !important; }
    /* iOS standalone (home-screen app) reports a layout viewport ~78pt short
       on these scroll-locked pages — Safari proper is fine, The Stable
       (document scrolls) is fine. Every anchoring strategy inherits the lie,
       so the frame measures the shortfall (screen.height - innerHeight) and
       translates itself down by exactly that much. Fixed on body: fixed
       descendants escape ancestor overflow clipping, so the translated bar
       still paints in the zone below the misreported viewport bottom. */
    .bb-frame { position: fixed; inset: 0; z-index: 500; display: flex; flex-direction: column;
      justify-content: flex-end; pointer-events: none; }
    body:has(> .bb-frame) .page { padding-bottom: calc(94px + env(safe-area-inset-bottom)); }
    /* Standalone unlock: give these pages The Stable's proven conditions —
       the document scrolls, the canvas runs full-screen, fixed lands true.
       (Safari keeps the scroll-lock and its anti-drift benefits.) */
    html.bb-standalone, html.bb-standalone body { height: auto !important; overflow-y: auto !important; }
    html.bb-standalone .scroll-viewport { position: static !important; inset: auto !important;
      overflow: visible !important; }
    /* style.css parks the sign-in pill bottom-right on phones — that spot
       belongs to the bar now, so the pill goes back up top on bar pages.
       Top-RIGHT is its exclusive territory (update pill keeps top-left).
       Collapsed to a small cloud-only circle — the email was eating a whole
       strip of screen; tap behavior (sign-in / account) is unchanged. */
    .auth-widget { top: calc(env(safe-area-inset-top) + 12px) !important; bottom: auto !important;
      right: 10px !important; left: auto !important; z-index: 95;
      width: 38px; height: 38px; border-radius: 50% !important; padding: 0 !important;
      overflow: hidden; font-size: 0 !important; display: flex; align-items: center; justify-content: center; }
    .auth-widget::before { content: '☁️'; font-size: 17px; }
    .auth-widget * { font-size: 0 !important; }
    /* Bottom bar visual design (2026-08-26, owner-provided). Grid instead of
       the old flex row so all 5 tabs stay perfectly even regardless of label
       width. */
    /* Content sits LOW in the bar (2026-08-27, user, twice: "the nav bar
       needs to go down more" / "still looks the same"). The first attempt
       floored the safe-area padding - a no-op, since env() was already
       reporting the real ~34pt inset; that full 34pt + 7px + centering
       slack under the labels was itself the "gap". Now the safe-area
       contribution is deliberately UNDERSHOT (env - 14px, floored at 6px)
       and the track is shorter, so the icons/labels ride ~20pt lower,
       close above the home indicator like a native tab bar - iOS happily
       floats the indicator over a bar's padding zone. */
    .bb-bar { pointer-events: auto; display: grid; grid-template-columns: repeat(5, 1fr);
      align-items: center; min-height: 68px;
      padding: 6px max(8px, env(safe-area-inset-right)) max(calc(env(safe-area-inset-bottom) - 14px), 6px) max(8px, env(safe-area-inset-left));
      background: linear-gradient(to top, #020202 0%, rgba(3,3,3,.98) 70%, rgba(3,3,3,.94) 100%);
      border-top: 1px solid rgba(232,185,76,.12); }
    .bb-tab { position: relative; height: 100%; width: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
      background: none; border: none; cursor: pointer;
      color: #80796b; font-family: var(--gk-display, 'Cinzel', serif);
      font-size: 10px; font-weight: 500; letter-spacing: 2px;
      -webkit-tap-highlight-color: transparent; transition: color 180ms ease, transform 180ms ease; }
    .bb-icon { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
      transition: transform 200ms ease, filter 200ms ease; }
    .bb-icon svg { width: 100%; height: 100%; overflow: visible; fill: none;
      stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .bb-label { text-transform: uppercase; }
    .icon-number { fill: currentColor; stroke: none; font-family: Georgia, serif; font-size: 17px; }
    .nav-accent { fill: #a95cff; stroke: #a95cff; }
    .sun-orbit { opacity: .28; stroke-dasharray: 2 5; }
    .bb-tab.active { color: #ffd45f; }
    .bb-tab.active .bb-icon { transform: translateY(-2px);
      filter: drop-shadow(0 0 4px rgba(255,201,78,.75)) drop-shadow(0 0 12px rgba(255,190,55,.28)); }
    .bb-tab.active::after { content: ''; position: absolute; width: 40px; height: 3px; bottom: 1px;
      border-radius: 100px; background: #ffd45f;
      box-shadow: 0 0 5px rgba(255,212,95,.9), 0 0 14px rgba(255,185,55,.65), 0 0 28px rgba(255,185,55,.25); }
    .bb-tab.active::before { content: ''; position: absolute; bottom: -20px; width: 85px; height: 60px;
      background: radial-gradient(ellipse, rgba(233,183,63,.19) 0%, rgba(233,183,63,.08) 35%, transparent 72%);
      pointer-events: none; }
    /* Today's aura tracks the day's own energy color instead of a fixed gold
       - reuses --acc/--acc-dim/--acc-ghost (godlike.css, driven by
       data-energy on <html>), not a new palette. Every other tab keeps the
       fixed gold-bright active color. */
    .bb-tab[data-tab="today"].active { color: var(--acc, #ffd45f); }
    .bb-tab[data-tab="today"].active .bb-icon {
      filter: drop-shadow(0 0 4px var(--acc-dim, rgba(255,201,78,.75))) drop-shadow(0 0 12px var(--acc-ghost, rgba(255,190,55,.28))); }
    .bb-tab[data-tab="today"].active::after { background: var(--acc, #ffd45f);
      box-shadow: 0 0 5px var(--acc-dim, rgba(255,212,95,.9)), 0 0 14px var(--acc-ghost, rgba(255,185,55,.65)); }
    .bb-tab[data-tab="today"].active::before {
      background: radial-gradient(ellipse, var(--acc-ghost, rgba(233,183,63,.19)) 0%, transparent 72%); }
    @media (hover: hover) {
      .bb-tab:hover { color: #c8ad6d; }
      .bb-tab.active:hover { color: #ffd45f; }
      .bb-tab[data-tab="today"].active:hover { color: var(--acc, #ffd45f); }
    }
    @media (max-width: 430px) {
      .bb-bar { min-height: 60px; }
      .bb-icon { width: 27px; height: 27px; }
      .bb-tab { font-size: 8px; letter-spacing: 1.4px; gap: 4px; }
    }
    .bb-backdrop { position: fixed; inset: 0; z-index: 490; background: rgba(0,0,0,.5); display: none; }
    .bb-backdrop.open { display: block; }
    .bb-sheet { pointer-events: auto; margin: 0 auto 8px; width: calc(100% - 20px); max-width: 420px;
      background: var(--panel, #0a0f1a); border: 1px solid var(--border, #223048);
      border-radius: 14px; padding: 6px; display: none;
      box-shadow: 0 -6px 30px rgba(0,0,0,.5); }
    .bb-sheet.open { display: block; animation: bbUp .16s ease; }
    @keyframes bbUp { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }
    .bb-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 13px 14px;
      background: none; border: none; border-radius: 10px; cursor: pointer; font-family: inherit;
      color: var(--text, #dfe7f3); font-size: 15px; text-align: left; }
    .bb-item .bb-ico { font-size: 19px; width: 24px; text-align: center; }
    .bb-item.active { background: rgba(245, 197, 66, .12); color: var(--yellow, #f5c542); }
  `;

  function build() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const backdrop = document.createElement('div');
    backdrop.className = 'bb-backdrop';
    document.body.appendChild(backdrop);

    // Full-screen click-through frame; sheets + bar bottom-align inside it
    // (the both-edges-anchored geometry that lands true in standalone iOS).
    const frame = document.createElement('div');
    frame.className = 'bb-frame';

    const bar = document.createElement('nav');
    bar.className = 'bb-bar';
    const sheets = {};

    TABS.forEach((tab) => {
      const btn = document.createElement('button');
      btn.className = 'bb-tab' + (activeTab && activeTab.id === tab.id ? ' active' : '');
      btn.dataset.tab = tab.id;
      btn.innerHTML = '<span class="bb-icon">' + (ICON_SVG[tab.id] || '') + '</span><span class="bb-label">' + tab.label + '</span>';
      if (tab.href) {
        btn.addEventListener('click', () => {
          if (window.gkNavigate) window.gkNavigate(tab.href); else location.href = tab.href;
        });
      } else {
        const sheet = document.createElement('div');
        sheet.className = 'bb-sheet';
        tab.items.forEach((item) => {
          const it = document.createElement('button');
          const itFile = item.href.replace('.html', '');
          it.className = 'bb-item' + (file === itFile ? ' active' : '');
          it.innerHTML = '<span class="bb-ico">' + item.icon + '</span>' + item.label;
          it.addEventListener('click', () => {
            if (window.gkNavigate) window.gkNavigate(item.href); else location.href = item.href;
          });
          sheet.appendChild(it);
        });
        frame.appendChild(sheet);
        sheets[tab.id] = sheet;
        btn.addEventListener('click', () => {
          const wasOpen = sheet.classList.contains('open');
          closeAll();
          if (!wasOpen) { sheet.classList.add('open'); backdrop.classList.add('open'); }
        });
      }
      bar.appendChild(btn);
    });

    function closeAll() {
      Object.values(sheets).forEach((s) => s.classList.remove('open'));
      backdrop.classList.remove('open');
    }
    backdrop.addEventListener('click', closeAll);

    frame.appendChild(bar);
    document.body.appendChild(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
