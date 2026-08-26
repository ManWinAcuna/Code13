/* Code13 walkthrough engine (Boost13 2026-08-25, 14 answers; extended to
   the whole app same day, owner call: "do the same for profile,
   calculator, compatibility, famous lookup").

   Spotlight tours over the REAL pages: dim + gold ring + one Cinzel line
   per beat + gold dot progress. Today runs the full first-run flow (five
   beats with the INLINE birth date capture; skip only after the date is
   in; devices that already hold a profile are auto-marked seen; ends on
   a clean landing card). The other pages run short 2-3 beat intros,
   skippable from beat one, shown once per device per page. Replay:
   the ? button each page grows after its tour is seen, plus
   today.html?tour=1 from Profile's replay link (?tour=1 forces any
   page's tour). All lines are functional drafts the owner rewrites
   freely.

   Also owns the styling of .gk-go-profile, the actionable buttons that
   replaced the app's dead-end "set your birthday" lines. */
(function () {
  var m = location.pathname.match(/([a-z-]+)\.html/);
  var PAGE = m ? m[1] : 'today';
  if (location.pathname === '/' || location.pathname === '') PAGE = 'today';

  function q(sel) { return document.querySelector(sel); }

  var TOURS = {
    today: {
      main: true,
      seenKey: 'c13_tour_seen_v1',
      beats: [
        { target: function () { return q('#gkNum') || q('.gk-altar'); },
          line: "This is today's number. The whole day runs on its energy. Tap it any time for its meaning." },
        { target: function () { return q('.gk-ringzone') || q('.gk-altar'); }, capture: true,
          line: 'Now make it yours. Your birth date is your code, and Code13 reads every day against it.' },
        { target: function () { return q('#gkVerdict') || q('#gkDayread'); },
          line: 'This is YOUR day now: your score against its energy and the move it calls for. New every midnight.' },
        { target: function () { return q('#gkDayread .c13-lock') || q('.gk-strip') || q('#gkDayread'); },
          line: 'Inside the day are your hours: best, worst, money hour. Monthly members see them in full.' },
        { target: function () { return q('.bb-bar'); },
          line: 'The rest lives down here: Compatibility, Calendar, your Profile. Everything reads from your birth date.' },
      ],
    },
    profile: {
      seenKey: 'c13_tour_seen_profile_v1',
      beats: [
        { target: function () { return q('#profileCoreSection'); },
          line: 'Your chart lives here: Life Path, Day Born, Day#, Combo. Tap any number for its full story.' },
        { target: function () { return q('#profileZodiacSection'); },
          line: 'Your zodiac layers and your Personal Cycles: the year, month, and day you are moving through right now.' },
        { target: function () {
            // render.js hides Personal Hours outright (display:none) until a
            // birth TIME is entered, not just a date - a plain querySelector
            // still finds that hidden element (it's real DOM, just
            // invisible), so `||` never fell through and the spotlight
            // targeted a 0x0 rect at the top of the page. User, 2026-08-26:
            // "the last one before done is just up top all glitched."
            var hours = q('#personalHoursSection');
            if (hours && !hours.offsetParent) hours = null;
            return hours || q('.pinnacles-collapsible');
          },
          line: 'The deep layers: your hours and your Pinnacles. Monthly members see them unveiled.' },
      ],
    },
    calculator: {
      seenKey: 'c13_tour_seen_calculator_v1',
      beats: [
        { target: function () { var el = q('#bday'); return (el && el.closest('.box')) || el; },
          line: 'Type any birth date: a friend, a crush, a rival. Code13 reads them like it reads you.' },
        { target: function () { return q('.grid4'); },
          line: 'Their full chart appears here. Add a birth time and their hours compute too.' },
      ],
    },
    compatibility: {
      seenKey: 'c13_tour_seen_compatibility_v1',
      beats: [
        { target: function () {
            // compatibility.js hides #modeSelect (display:none) once a mode
            // is already picked - a plain querySelector still finds that
            // hidden element (it's real DOM, just invisible), so the
            // spotlight targeted a 0x0 rect at the top of the page for
            // anyone replaying the tour after their first visit. Same bug
            // as Profile's "up top all glitched" fix - falls back to a
            // centered card (like beat 2 below) instead of a broken hole.
            var el = q('#modeSelect');
            if (el && !el.offsetParent) el = null;
            return el;
          },
          line: 'Compatibility: you against a person, a date, or anything with a birthday. Pick a mode.' },
        { target: function () { return null; },
          line: 'Every check weighs all the layers: numerology, Vietnamese, Western. One score, then the why.' },
      ],
    },
    famous: {
      seenKey: 'c13_tour_seen_famous_v1',
      beats: [
        { target: function () { return q('.famous-search-box'); },
          line: 'Look up anyone famous. Their birth date pulls in automatically and their full chart opens.' },
        { target: function () { return null; },
          line: 'Their chart reads exactly like yours: same numbers, same layers. Dates come from public sources, so a rare one can be off.' },
      ],
    },
  };

  var cfg = TOURS[PAGE];
  if (!cfg) return;
  var SEEN_KEY = cfg.seenKey;
  var STEP_KEY = 'c13_tour_step_v1'; // only the main tour resumes across a reload
  var N = cfg.beats.length;
  var forced = false;
  try { forced = new URLSearchParams(location.search).get('tour') === '1'; } catch (e) {}

  // Every page's seen-state rides to the account now (2026-08-26, owner
  // call: an account is required to use the app at all, so there's no
  // reason page intros should stay device-only anymore - user noticed
  // Today's tour was remembered across devices but "not sure it's
  // remembering it on all of them"). 'today' keeps its original Firestore
  // field name (mainSeen) for backward compatibility with data already
  // written before this change; the other four pages get their own field.
  var ACCOUNT_FIELD = cfg.main ? 'mainSeen' : PAGE + 'Seen';

  function seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } }
  function markSeen() {
    try {
      localStorage.setItem(SEEN_KEY, '1');
      if (cfg.main) localStorage.removeItem(STEP_KEY);
    } catch (e) {}
    // Best-effort, never blocks the UI.
    try {
      if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        var patch = {}; patch[ACCOUNT_FIELD] = true;
        firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid)
          .collection('meta').doc('tour').set(patch, { merge: true }).catch(function () {});
      }
    } catch (e) {}
  }
  function getProfile() { try { return loadProfile(); } catch (e) { return null; } }

  // Resolves true/false/null (null = no account to check, or check failed -
  // caller should fall through to normal local-only behavior). Only called
  // when this device has signed in before, so a fresh guest never pays a
  // network wait to learn what it already knows.
  function readAccountTourSeen() {
    return new Promise(function (resolve) {
      var everSignedIn = false;
      try { everSignedIn = !!localStorage.getItem('numerology_ever_signed_in'); } catch (e) {}
      if (!everSignedIn) { resolve(null); return; }
      var tries = 0;
      (function waitFb() {
        if (window.firebase && firebase.auth && firebase.firestore) {
          firebase.auth().onAuthStateChanged(function (user) {
            if (!user) { resolve(null); return; }
            firebase.firestore().collection('users').doc(user.uid)
              .collection('meta').doc('tour').get()
              .then(function (snap) { resolve(!!(snap.exists && snap.data() && snap.data()[ACCOUNT_FIELD])); })
              .catch(function () { resolve(null); });
          }, function () { resolve(null); });
        } else if (++tries < 20) {
          setTimeout(waitFb, 150);
        } else {
          resolve(null);
        }
      })();
    });
  }

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

  var root = null;
  var current = 0;

  function teardown(done) {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    if (done) { markSeen(); addHelpBtn(); }
  }

  function dotsHtml(i) {
    var h = '<div class="c13-tour-dots">';
    for (var k = 1; k <= N; k++) h += '<i class="' + (k === i ? 'on' : '') + '"></i>';
    return h + '</div>';
  }

  // Main tour: skip only once the date is in (beats 3+). Page tours:
  // skippable from the first beat.
  function skipAllowed(i) { return cfg.main ? i >= 3 : true; }

  function showBeat(i) {
    current = i;
    if (cfg.main) { try { localStorage.setItem(STEP_KEY, String(i)); } catch (e) {} }
    var b = cfg.beats[i - 1];
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
        + (i === N ? (cfg.main ? 'Finish' : 'Done') : 'Next') + '</button>';
    }
    if (skipAllowed(i)) inner += '<button type="button" class="c13-tour-skip" id="c13TourSkip">skip the tour</button>';
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
    } else if (i === N) {
      go.addEventListener('click', function () {
        if (cfg.main) showEnding();
        else teardown(true);
      });
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
    if (!cfg.main) { showBeat(step); return; }
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

  function proceed() {
    var resume = 1;
    if (cfg.main) {
      try {
        var s = parseInt(localStorage.getItem(STEP_KEY) || '1', 10);
        if (s >= 1 && s <= N) resume = s;
      } catch (e) {}
      if (resume > 2 && !(prof && prof.date)) resume = 1;
    }
    setTimeout(function () { startAt(resume); }, 500);
  }

  if (!forced) {
    if (seen()) { addHelpBtn(); return; }
    // only the MAIN tour is auto-skipped for devices that already hold a
    // profile; the short page intros show once for everyone
    if (cfg.main && prof && prof.date) { markSeen(); addHelpBtn(); return; }
    // Local storage doesn't know yet - ask the account before committing to
    // show the tour, so signing in on a new/cleared device doesn't repeat
    // it, for EVERY page's tour now (not just Today's) - an account is
    // required app-wide, so there's no guest case left to fast-path around.
    // Accounts that have never signed in still resolve this near-instantly
    // (readAccountTourSeen short-circuits to null).
    readAccountTourSeen().then(function (accountSeen) {
      if (accountSeen === true) { markSeen(); addHelpBtn(); return; }
      proceed();
    });
    return;
  }
  proceed();
})();
