/* Pre-launch lock (owner call 2026-08-22): until launch, every app page
   bounces straight to the landing page (index.html) - the landing is the
   ONLY public surface. Client-side gate, same honest scope as always on
   GitHub Pages: it keeps visitors out of the UI; a fresh browser holds no
   user data for it to protect.

   Owner unlock: open any page with ?key=<secret> once - the device is
   flagged in localStorage and every page works normally from then on.
   At launch: delete this file and its <script> tag from every page. */
(function () {
  var KEY = 'c13_prelaunch_unlock_v1';
  var SECRET = 'horse1313';
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('key') === SECRET) { localStorage.setItem(KEY, '1'); return; }
    if (localStorage.getItem(KEY) === '1') return;
  } catch (e) { /* storage blocked: fall through to the landing page */ }
  location.replace('index.html');
})();
