const form = document.querySelector('#settings');
const status = document.querySelector('#status');
const defaults = {
  enabled: true,
  reduceShorts: true,
  hideNativeSubscriptions: true,
  hideExploreSection: true,
  hideMoreYouTubeSection: true,
  hideReportHistory: true,
  hideSidebarFooter: true
};

function updateEnabledState(isEnabled) {
  document.querySelectorAll('.settings-card').forEach((card) => {
    card.classList.toggle('is-disabled', !isEnabled);
    card.querySelectorAll('input').forEach((input) => {
      input.disabled = !isEnabled;
    });
  });
}

chrome.storage.sync.get(defaults, (settings) => {
  for (const input of form.elements) {
    if (!(input instanceof HTMLInputElement)) continue;

    input.checked = input.name === 'hideSecondaryLinks'
      ? settings.hideReportHistory && settings.hideSidebarFooter
      : settings[input.name];
  }
  updateEnabledState(settings.enabled);
});

form.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;

  if (input.name === 'enabled') updateEnabledState(input.checked);

  const changes = input.name === 'hideSecondaryLinks'
    ? { hideReportHistory: input.checked, hideSidebarFooter: input.checked }
    : { [input.name]: input.checked };

  chrome.storage.sync.set(changes, () => {
    status.value = 'Auf YouTube angewendet.';
    setTimeout(() => {
      status.value = 'Änderungen werden sofort angewendet.';
    }, 1200);
  });
});
