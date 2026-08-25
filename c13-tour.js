/* Code13 first-run tour (Boost13 2026-08-25, 14 answers locked).
   Spotlight walkthrough over the REAL Today page: the page dims, a gold
   ring frames one element per beat, one line each, five gold dots.
   Beats: 1 the altar number, 2 inline birth date capture (date required,
   time optional), 3 your day verdict, 4 the hours (locked tease), 5 the
   bottom tabs, then a clean landing card. Skip appears only once the
   birth date is in (beats 3+). Devices that already hold a profile are
   marked seen automatically and never see it; replay via the ? button
   on Today or "Replay the app tour" on Profile (today.html?tour=1).
   The capture beat saves through the app's own saveProfile() and
   reloads once, resuming at beat 3. All tour lines are functional
   drafts - the owner rewrites any of them whenever.

   Also owns the styling of .gk-go-profile, the actionable buttons that
   replaced the app's dead-end "set your birthday" lines. */
(function () {
  var SEEN_KEY = 'c13_tour_seen_v1';
  var STEP_KEY = 'c13_tour_step_v1';
  var forced = false;
  try { forced = new URLSearchParams(location.search).get('tour') === '1'; } catch (e) {}

  function seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } }
  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); localStorage.removeItem(STEP_KEY); } catch (e) {}
  }
  function getProfile() { try { return loadProfile(); } catch (e) { return null; } }

  /* ------------------------------ css ------------------------------ */
  var css = `
    #c13Tour { position: fixed; inset: 0; z-index: 99980; font-family: var(--gk-ui, sans-serif); }
    #c13Tour.nohole { background: rgba(0, 0, 0, .86); }
    #c13Tour.nohole #c13TourHole { display: none; }
    #c13TourHole { position: fixed; border-radius: 18px; pointer-events: none;
      box-shadow: 0 0 0 2px rgba(245, 197, 66, .85), 0 0 24px rgba(245, 197, 66, .4),
        0 0 0 200vmax rgba(0, 0, 0, .86);
      transition: top .3s ease, left .3s ease, width .3s ease, height .3s ease; }
    #c13TourCard { position: fixed; left: 50%; transform: translateX(-50%);
      width: min(92vw, 342px); background: #0d0c0a;
      border: 1px solid rgba(245, 197, 66, .4); border-radius: 16px;
      padding: 18px 16px 14px; text-align: center;
      box-shadow: 0 12px 44px rgba(0, 0, 0, .75); }
    #c13TourCard.center { top: 50% !important; transform: translate(-50%, -50%); }
    .c13-tour-line { font-family: 'Cinzel', 'Times New Roman', serif; font-size: 14.5px;
      line-height: 1.62; color: #ece7dc; letter-spacing: .02em; }
    .c13-tour-dots { display: flex; justify-content: center; gap: 7px; margin: 13px 0 0; }
    .c13-tour-dots i { width: 6px; height: 6px; border-radius: 50%;
      background: rgba(245, 197, 66, .22); }
    .c13-tour-dots i.on { background: #f5c542; box-shadow: 0 0 8px rgba(245, 197, 66, .8); }
    .c13-tour-next { margin-top: 13px; width: 100%; padding: 11px 0; border: none;
      border-radius: 999px; background: linear-gradient(168deg, #ffdf7e, #e9b62e);
      color: #100c02; font-weight: 700; font-size: 11px; letter-spacing: .2em;
      text-transform: uppercase; cursor: pointer; font-family: inherit; }
    .c13-tour-skip { margin-top: 9px; background: none; border: none; color: #77705f;
      font-size: 10px; letter-spacing: .16em; text-transform: uppercase; cursor: pointer;
      display: block; width: 100%; font-family: inherit; }
    .c13-tour-form input { width: 100%; box-sizing: border-box; margin-top: 9px;
      background: rgba(255, 255, 255, .05); border: 1px solid rgba(255, 255, 255, .12);
      border-radius: 9px; color: #ece7dc; padding: 9px 10px; font-size: 16px;
      color-scheme: dark; font-family: inherit; }
    .c13-tour-hint { margin-top: 5px; font-size: 9.5px; color: #77705f; letter-spacing: .05em; }
    .c13-tour-hint.err { color: #e5393f; }
    #c13TourHelp { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 56px);
      left: 10px; z-index: 95; width: 30px; height: 30px; border-radius: 50%;
      background: rgba(13, 12, 10, .92); border: 1px solid rgba(255, 255, 255, .14);
      color: #77705f; font-size: 14px; cursor: pointer; font-family: inherit;
      -webkit-tap-highlight-color: transparent; }
    .gk-go-profile { display: inline-block; margin-top: 8px; padding: 9px 20px;
      border-radius: 999px; background: linear-gradient(168deg, #ffdf7e, #e9b62e);
      color: #100c02 !important; font-weight: 700; font-size: 10.5px;
      letter-spacing: .18em; text-transform: uppercase; text-decoration: none; }
  `;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ------------------------- the five beats ------------------------- */
  function q(sel) { return document.querySelector(sel); }
  var BEATS = [
    { target: function () { return q('#gkNum') || q('.gk-altar'); }, skip: false,
      line: "This is today's number. The whole day runs on its energy. Tap it any time for its meaning." },
    { target: function () { return q('.gk-ringzone') || q('.gk-altar'); }, skip: false, capture: true,
      line: 'Now make it yours. Your birth date is your code, and Code13 reads every day against it.' },
    { target: function () { return q('#gkVerdict') || q('#gkDayread'); }, skip: true,
      line: 'This is YOUR day now: your score against its energy and the move it calls for. New every midnight.' },
    { target: function () { return q('#gkDayread .c13-lock') || q('.gk-strip') || q('#gkDayread'); }, skip: true,
      line: 'Inside the day are your hours: best, worst, money hour. Monthly members see them in full.' },
    { target: function () { return q('.bb-bar'); }, skip: true,
      line: 'The rest lives down here: Compatibility, Calendar, your Profile. Everything reads from your birth date.' },
  ];

  var root = null;
  var current = 0;

  function teardown(done) {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    if (done) { markSeen(); addHelpBtn(); }
  }

  function dotsHtml(i) {
    var h = '<div class="c13-tour-dots">';
    for (var k = 1; k <= 5; k++) h += '<i class="' + (k === i ? 'on' : '') + '"></i>';
    return h + '</div>';
  }

  function showBeat(i) {
    current = i;
    try { localStorage.setItem(STEP_KEY, String(i)); } catch (e) {}
    var b = BEATS[i - 1];
    var el = b.target();
    if (!root) {
      root = document.createElement('div');
      root.id = 'c13Tour';
      root.innerHTML = '<div id="c13TourHole"></div><div id="c13TourCard"></div>';
      document.body.appendChild(root);
    }
    var card = q('#c13TourCard');

    var inner = '<div class="c13-tour-line">' + b.line + '</div>';
    if (b.capture) {
      var p = getProfile() || {};
      inner += '<div class="c13-tour-form">'
        + '<input type="date" id="c13TourDate" value="' + (p.date || '') + '" aria-label="Birth date">'
        + '<input type="time" id="c13TourTime" value="' + (p.time || '') + '" aria-label="Birth time (optional)">'
        + '<div class="c13-tour-hint" id="c13TourHint">Time is optional. It unlocks your hours later.</div>'
        + '</div>' + dotsHtml(i)
        + '<button type="button" class="c13-tour-next" id="c13TourGo">Set my date</button>';
    } else {
      inner += dotsHtml(i)
        + '<button type="button" class="c13-tour-next" id="c13TourGo">'
        + (i === 5 ? 'Finish' : 'Next') + '</button>';
    }
    if (b.skip) inner += '<button type="button" class="c13-tour-skip" id="c13TourSkip">skip the tour</button>';
    card.innerHTML = inner;

    function place() {
      var hole = q('#c13TourHole');
      if (el) {
        root.classList.remove('nohole');
        var r = el.getBoundingClientRect();
        var pad = 10;
        hole.style.top = (r.top - pad) + 'px';
        hole.style.left = (r.left - pad) + 'px';
        hole.style.width = (r.width + pad * 2) + 'px';
        hole.style.height = (r.height + pad * 2) + 'px';
        card.classList.remove('center');
        var ch = card.offsetHeight || 220;
        var below = r.bottom + 16;
        if (below + ch + 12 < window.innerHeight) card.style.top = below + 'px';
        else if (r.top - ch - 16 > 8) card.style.top = (r.top - ch - 16) + 'px';
        else card.classList.add('center');
      } else {
        root.classList.add('nohole');
        card.classList.add('center');
      }
    }
    if (el && el.scrollIntoView) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      setTimeout(place, 380);
      place();
    } else {
      place();
    }

    var go = q('#c13TourGo');
    if (b.capture) {
      go.addEventListener('click', function () {
        var dv = q('#c13TourDate').value;
        var tv = q('#c13TourTime').value;
        var hint = q('#c13TourHint');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dv)) {
          hint.textContent = 'The birth date is the one thing Code13 needs.';
          hint.classList.add('err');
          return;
        }
        var p = getProfile() || {};
        p.date = dv;
        if (tv) p.time = tv;
        try { saveProfile(p); } catch (e) {}
        try { localStorage.setItem(STEP_KEY, '3'); } catch (e) {}
        location.reload();
      });
    } else if (i === 5) {
      go.addEventListener('click', showEnding);
    } else {
      go.addEventListener('click', function () { showBeat(i + 1); });
    }
    var sk = q('#c13TourSkip');
    if (sk) sk.addEventListener('click', function () { teardown(true); });
  }

  function showEnding() {
    var card = q('#c13TourCard');
    root.classList.add('nohole');
    card.classList.add('center');
    card.innerHTML = '<div class="c13-tour-line">Your day is ready. Come back tomorrow: the number changes, and so does the read.</div>'
      + '<button type="button" class="c13-tour-next" id="c13TourGo">Begin</button>';
    q('#c13TourGo').addEventListener('click', function () { teardown(true); });
  }

  /* -------------------------- help button -------------------------- */
  function addHelpBtn() {
    if (document.getElementById('c13TourHelp')) return;
    var btn = document.createElement('button');
    btn.id = 'c13TourHelp';
    btn.type = 'button';
    btn.title = 'Replay the tour';
    btn.textContent = '?';
    btn.addEventListener('click', function () {
      btn.remove();
      startAt(1);
    });
    document.body.appendChild(btn);
  }

  function startAt(step) {
    var tries = 0;
    (function waitReady() {
      var ready = document.getElementById('gkDayread')
        && document.getElementById('gkDayread').innerHTML.length > 0;
      if (!ready && ++tries < 30) { setTimeout(waitReady, 200); return; }
      showBeat(step);
    })();
  }

  window.addEventListener('resize', function () {
    if (root && current) showBeat(current);
  });

  /* ----------------------------- boot ------------------------------ */
  var prof = getProfile();
  if (!forced) {
    if (seen()) { addHelpBtn(); return; }
    if (prof && prof.date) { markSeen(); addHelpBtn(); return; }
  }
  var resume = 1;
  try {
    var s = parseInt(localStorage.getItem(STEP_KEY) || '1', 10);
    if (s >= 1 && s <= 5) resume = s;
  } catch (e) {}
  // a resume past the capture only makes sense if the date actually landed
  if (resume > 2 && !(prof && prof.date)) resume = 1;
  setTimeout(function () { startAt(resume); }, 500);
})();
