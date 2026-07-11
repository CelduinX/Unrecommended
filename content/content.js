(() => {
  'use strict';

  const ROOT_ATTRIBUTE = 'data-unrecommended';
  const SUBSCRIPTION_ENTRY_ID = 'unrecommended-subscription-feed';
  const SUBSCRIPTION_VIEW_SWITCHER_ID = 'unrecommended-subscription-view-switcher';
  const VIDEO_DESCRIPTION_CLASS = 'unrecommended-video-description';
  const WATCHED_ATTRIBUTE = 'data-unrecommended-watched';
  const DEFAULTS = {
    enabled: true,
    reduceShorts: true,
    subscriptionView: 'grid',
    hideNativeSubscriptions: true,
    hideExploreSection: true,
    hideMoreYouTubeSection: true,
    hideReportHistory: true,
    hideSidebarFooter: true
  };
  let currentSettings = { ...DEFAULTS };
  const descriptionCache = new Map();
  const queuedDescriptionCards = new WeakSet();

  const descriptionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      descriptionObserver.unobserve(entry.target);
      loadVideoDescription(entry.target);
    });
  }, { rootMargin: '200px 0px' });

  function applySettings(settings) {
    currentSettings = { ...DEFAULTS, ...settings };
    const root = document.documentElement;
    root.toggleAttribute(ROOT_ATTRIBUTE, Boolean(currentSettings.enabled));
    root.toggleAttribute('data-unrecommended-reduce-shorts', Boolean(currentSettings.reduceShorts));
    root.toggleAttribute('data-unrecommended-hide-native-subscriptions', Boolean(currentSettings.hideNativeSubscriptions));
    root.toggleAttribute('data-unrecommended-hide-explore', Boolean(currentSettings.hideExploreSection));
    root.toggleAttribute('data-unrecommended-hide-more-youtube', Boolean(currentSettings.hideMoreYouTubeSection));
    root.toggleAttribute('data-unrecommended-hide-report-history', Boolean(currentSettings.hideReportHistory));
    root.toggleAttribute('data-unrecommended-hide-sidebar-footer', Boolean(currentSettings.hideSidebarFooter));
    applySubscriptionView(currentSettings.subscriptionView);
    updateYouTubeUi();
  }

  function applySubscriptionView(view) {
    const normalizedView = view === 'list' ? 'list' : 'grid';
    document.documentElement.setAttribute('data-unrecommended-subscription-view', normalizedView);

    document.querySelectorAll(`#${SUBSCRIPTION_VIEW_SWITCHER_ID} button`).forEach((button) => {
      const isActive = button.dataset.view === normalizedView;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    if (normalizedView === 'list') queueVideoDescriptions();
  }

  function queueVideoDescriptions() {
    const isListView = document.documentElement.getAttribute('data-unrecommended-subscription-view') === 'list';
    if (!currentSettings.enabled || !isListView || location.pathname !== '/feed/subscriptions') return;

    document.querySelectorAll('ytd-rich-item-renderer').forEach((card) => {
      if (card.querySelector(`.${VIDEO_DESCRIPTION_CLASS}`) || queuedDescriptionCards.has(card)) return;

      const videoLink = card.querySelector('a[href^="/watch"]');
      if (!videoLink) return;

      queuedDescriptionCards.add(card);
      card.dataset.unrecommendedVideoUrl = videoLink.href;
      descriptionObserver.observe(card);
    });
  }

  async function loadVideoDescription(card) {
    const videoUrl = card.dataset.unrecommendedVideoUrl;
    if (!videoUrl || card.querySelector(`.${VIDEO_DESCRIPTION_CLASS}`)) return;

    try {
      let description = descriptionCache.get(videoUrl);

      if (description === undefined) {
        const response = await fetch(videoUrl, { credentials: 'include' });
        if (!response.ok) return;

        const page = new DOMParser().parseFromString(await response.text(), 'text/html');
        description = page.querySelector('meta[itemprop="description"]')?.content
          || page.querySelector('meta[name="description"]')?.content
          || page.querySelector('meta[property="og:description"]')?.content
          || '';
        descriptionCache.set(videoUrl, description);
      }

      if (!description || !card.isConnected) return;

      const metadata = card.querySelector('.ytLockupViewModelMetadata, yt-lockup-metadata-view-model');
      if (!metadata) return;

      const descriptionElement = document.createElement('p');
      descriptionElement.className = VIDEO_DESCRIPTION_CLASS;
      descriptionElement.textContent = description;
      metadata.append(descriptionElement);
    } catch {
      // Einzelne nicht abrufbare Videos sollen den übrigen Feed nicht beeinflussen.
    }
  }

  function addSubscriptionFeedEntry() {
    const existingEntry = document.getElementById(SUBSCRIPTION_ENTRY_ID);
    if (existingEntry?.tagName === 'A') {
      syncSubscriptionFeedEntryState(existingEntry);
      return;
    }
    existingEntry?.remove();

    const shortsEntry = Array.from(document.querySelectorAll('ytd-guide-entry-renderer'))
      .find((entry) => entry.querySelector('#endpoint[title="Shorts"]'));
    if (!shortsEntry) return;

    const nativeEndpoint = shortsEntry.querySelector('#endpoint');
    const nativeSubscriptionsEntry = Array.from(document.querySelectorAll('ytd-guide-entry-renderer'))
      .find((candidate) => candidate.querySelector('#endpoint[href="/feed/subscriptions"]'));

    const entry = document.createElement('a');
    entry.id = SUBSCRIPTION_ENTRY_ID;
    entry.className = 'unrecommended-guide-entry';
    entry.href = '/feed/subscriptions';
    entry.title = 'Abo-Feed';
    entry.setAttribute('aria-label', 'Abo-Feed');
    entry.innerHTML = `
      <span class="unrecommended-guide-entry__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M6 1a2 2 0 0 0-2 2h16a2 2 0 0 0-2-2H6ZM1 7v13a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2Zm9 10v-7l6 3.5-6 3.5Z" />
        </svg>
      </span>
      <span class="unrecommended-guide-entry__label">Abo-Feed</span>`;

    if (nativeEndpoint) entry.style.color = getComputedStyle(nativeEndpoint).color;

    shortsEntry.before(entry);
    syncSubscriptionFeedEntryState(entry, nativeSubscriptionsEntry);
  }

  function syncSubscriptionFeedEntryState(entry, nativeSubscriptionsEntry) {
    const isActive = location.pathname === '/feed/subscriptions';
    entry.classList.toggle('is-active', isActive);

    if (!isActive) {
      entry.style.removeProperty('background-color');
      return;
    }

    const nativeEntry = nativeSubscriptionsEntry || Array.from(document.querySelectorAll('ytd-guide-entry-renderer'))
      .find((candidate) => candidate.querySelector('#endpoint[href="/feed/subscriptions"]'));
    if (nativeEntry) entry.style.backgroundColor = getComputedStyle(nativeEntry).backgroundColor;
  }

  function markRelevantSubscriptionsSection() {
    const markedSections = document.querySelectorAll('[data-unrecommended-subscriptions-relevant]');

    if (location.pathname !== '/feed/subscriptions') {
      markedSections.forEach((section) => section.removeAttribute('data-unrecommended-subscriptions-relevant'));
      return;
    }

    const relevantHeading = Array.from(document.querySelectorAll('ytd-rich-shelf-renderer h2'))
      .find((heading) => heading.textContent.trim() === 'Relevanteste');
    const relevantSection = relevantHeading?.closest('ytd-rich-section-renderer');
    if (relevantSection) relevantSection.setAttribute('data-unrecommended-subscriptions-relevant', '');
  }

  function addSubscriptionViewSwitcher() {
    const existingSwitcher = document.getElementById(SUBSCRIPTION_VIEW_SWITCHER_ID);

    if (location.pathname !== '/feed/subscriptions') {
      existingSwitcher?.remove();
      return;
    }

    if (existingSwitcher) {
      applySubscriptionView(document.documentElement.getAttribute('data-unrecommended-subscription-view'));
      return;
    }

    const allSubscriptionsLink = document.querySelector('ytd-shelf-renderer #subscribe-button a[href="/feed/channels"]');
    const allSubscriptionsButton = allSubscriptionsLink?.closest('#subscribe-button');
    if (!allSubscriptionsButton) return;

    const switcher = document.createElement('div');
    switcher.id = SUBSCRIPTION_VIEW_SWITCHER_ID;
    switcher.className = 'unrecommended-view-switcher';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Abo-Feed-Ansicht');
    switcher.style.color = getComputedStyle(allSubscriptionsLink).color;
    switcher.innerHTML = `
      <button type="button" data-view="grid" title="Grid-Ansicht" aria-label="Grid-Ansicht">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
        </svg>
      </button>
      <button type="button" data-view="list" title="Listenansicht" aria-label="Listenansicht">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 5h4v4H4V5Zm6 0h10v4H10V5ZM4 10h4v4H4v-4Zm6 0h10v4H10v-4ZM4 15h4v4H4v-4Zm6 0h10v4H10v-4Z" />
        </svg>
      </button>`;

    switcher.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-view]');
      if (!button) return;

      applySubscriptionView(button.dataset.view);
      chrome.storage.sync.set({ subscriptionView: button.dataset.view });
    });

    allSubscriptionsButton.before(switcher);
    applySubscriptionView(document.documentElement.getAttribute('data-unrecommended-subscription-view'));
  }

  function markSidebarSections() {
    const nativeSubscriptionsEntry = Array.from(document.querySelectorAll('ytd-guide-entry-renderer'))
      .find((entry) => entry.querySelector('#endpoint[href="/feed/subscriptions"]'));
    nativeSubscriptionsEntry?.closest('ytd-guide-section-renderer')
      ?.setAttribute('data-unrecommended-native-subscriptions', '');

    document.querySelectorAll('ytd-guide-section-renderer').forEach((section) => {
      const heading = section.querySelector('h3, #guide-section-title')?.textContent.trim();
      if (heading === 'Entdecken') section.setAttribute('data-unrecommended-explore', '');
      if (heading === 'Mehr von YouTube') section.setAttribute('data-unrecommended-more-youtube', '');
    });
  }

  function markWatchedSubscriptionVideos() {
    if (location.pathname !== '/feed/subscriptions') return;

    document.querySelectorAll('ytd-rich-item-renderer').forEach((card) => {
      const progressSegment = card.querySelector('.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment');
      const progress = Number.parseFloat(progressSegment?.style.width || '0');
      card.toggleAttribute(WATCHED_ATTRIBUTE, progress >= 90);
    });
  }

  function updateYouTubeUi() {
    const isEnabled = currentSettings.enabled;

    if (isEnabled) {
      addSubscriptionFeedEntry();
    } else {
      document.getElementById(SUBSCRIPTION_ENTRY_ID)?.remove();
    }

    markRelevantSubscriptionsSection();

    if (isEnabled) {
      addSubscriptionViewSwitcher();
      queueVideoDescriptions();
    } else {
      document.getElementById(SUBSCRIPTION_VIEW_SWITCHER_ID)?.remove();
    }

    markSidebarSections();
    markWatchedSubscriptionVideos();
  }

  const navigationObserver = new MutationObserver(updateYouTubeUi);
  navigationObserver.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('yt-navigate-finish', updateYouTubeUi);

  chrome.storage.sync.get(DEFAULTS, applySettings);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    chrome.storage.sync.get(DEFAULTS, applySettings);
  });
})();
