(function initProfile() {
  const bdayInput = document.getElementById('bday');
  const timeInput = document.getElementById('btime');
  const noteEl = document.getElementById('profileSavedNote');

  const profile = loadProfile();
  if (profile && profile.date) {
    bdayInput.value = isoToDisplay(profile.date);
    if (profile.time) timeInput.value = profile.time;
    render();
    renderPersonalHours();
    noteEl.textContent = '✓';
    noteEl.title = 'Loaded from your saved profile';
  }

  let saveTimer = null;
  function persist() {
    const iso = displayToISO(bdayInput.value);
    if (!iso) return;
    saveProfile({ date: iso, time: timeInput.value || '' });
    noteEl.textContent = '✓';
    noteEl.title = 'Saved to your profile';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { noteEl.textContent = ''; noteEl.title = ''; }, 2000);
  }

  bdayInput.addEventListener('input', persist);
  timeInput.addEventListener('input', persist);

  // Membership status (2026-08-28, user: "let people know what their
  // current subscription status is in the profile"). Reads the same
  // entitlement every gate uses (c13PlanTier, entitlements.js) - never a
  // separate source that could disagree with what's actually unlocked.
  // Free users can tap it to open the paywall; members see their tier.
  (function renderMembership() {
    const box = document.getElementById('membershipBox');
    const valueEl = document.getElementById('membershipValue');
    if (!box || !valueEl) return;
    const TIER_LABEL = { weekly: 'Code13+ Weekly', monthly: 'Code13+ Monthly', lifetime: 'Code13+ Lifetime', dev: 'Code13+' };
    const tier = window.c13PlanTier ? c13PlanTier() : null;
    if (tier) {
      valueEl.textContent = TIER_LABEL[tier] || 'Code13+';
      box.classList.add('member');
    } else {
      valueEl.innerHTML = 'Free <button type="button" class="c13-meter-plus" onclick="c13OpenPaywall(\'generic\')">Get Code13+</button>';
    }
  })();

  // Called by auth-widget.js after a post-sign-in cloud pull, instead of a
  // full page reload - re-reads the just-synced profile straight into the
  // fields and re-renders in place.
  window.__refreshAfterCloudSync = function () {
    const freshProfile = loadProfile();
    if (freshProfile && freshProfile.date) {
      bdayInput.value = isoToDisplay(freshProfile.date);
      if (freshProfile.time) timeInput.value = freshProfile.time;
    }
    render();
    renderPersonalHours();
  };
})();
