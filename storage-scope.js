/* Code13 storage isolation (2026-08-13). Both this app and the owner's
   numerology-app deploy to the SAME GitHub Pages origin
   (manwinacuna.github.io), and browser storage is per-origin, not
   per-path - so without this, Code13 read the numerology-app's
   localStorage on any device that had used both (the owner opened Code13
   and saw their entire personal Database in it).

   Fix: every localStorage/sessionStorage key this app touches is
   transparently prefixed "c13:". Loaded FIRST on every page, before any
   script that reads storage, so the whole codebase (db-core, profile,
   entitlements meters, lookup cache...) is isolated with zero per-key
   changes. The numerology-app's unprefixed keys become invisible to
   Code13 - never deleted, they still belong to the other app.
   big-store.js's IndexedDB name is namespaced separately in that file. */
(function () {
  const PREFIX = 'c13:';
  const proto = Storage.prototype;
  const rawGet = proto.getItem;
  const rawSet = proto.setItem;
  const rawRemove = proto.removeItem;
  proto.getItem = function (key) { return rawGet.call(this, PREFIX + key); };
  proto.setItem = function (key, value) { return rawSet.call(this, PREFIX + key, value); };
  proto.removeItem = function (key) { return rawRemove.call(this, PREFIX + key); };
})();
