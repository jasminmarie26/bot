(() => {
  const TRANSPARENT_PIXEL =
    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  const list = document.getElementById("site-updates-list");

  const updateModal = document.getElementById("update-modal");
  const updateForm = document.getElementById("update-form");
  const updateTitle = document.getElementById("update-modal-title");
  const updateSubmitButton = document.getElementById("update-submit-btn");
  const updateCloseButton = document.getElementById("update-close-btn");
  const updateField = updateForm?.querySelector("textarea[name='content']");

  const siteContentModal = document.getElementById("site-content-modal");
  const siteContentForm = document.getElementById("site-content-form");
  const siteContentModalTitle = document.getElementById("site-content-modal-title");
  const siteContentCloseButton = document.getElementById("site-content-close-btn");
  const siteContentTitleInput = document.getElementById("site-content-title-input");
  const siteContentBodyWrap = document.getElementById("site-content-body-wrap");
  const siteContentBodyInput = document.getElementById("site-content-body-input");

  const heroSection = document.getElementById("home-hero");
  const heroTitleElement = document.getElementById("home-hero-title");
  const heroBodyElement = document.getElementById("home-hero-body");
  const heroTitleSource = document.getElementById("home-hero-title-source");
  const heroBodySource = document.getElementById("home-hero-body-source");
  const updatesTitleElement = document.getElementById("updates-section-title");
  const updatesTitleSource = document.getElementById("updates-section-title-source");
  const accountCountElement = document.getElementById("home-account-count");
  const loggedInCountElement = document.getElementById("home-logged-in-count");
  const staffCountElement = document.getElementById("home-staff-online-count");
  const rpCharacterCountElement = document.getElementById("home-rp-character-count");
  const freeRpOnlineCountElement = document.getElementById("home-free-rp-online-count");
  const erpOnlineCountElement = document.getElementById("home-erp-online-count");
  const larpCharacterCountElement = document.getElementById("home-larp-character-count");
  const larpOnlineCountElement = document.getElementById("home-larp-online-count");
  const discordNameElement = document.getElementById("home-discord-name");
  const discordMemberCountElement = document.getElementById("home-discord-member-count");
  const discordOnlineCountElement = document.getElementById("home-discord-online-count");
  const discordIconElement = document.getElementById("home-discord-icon");
  const discordIconFallbackElement = document.getElementById("home-discord-icon-fallback");
  const discordLinkElements = Array.from(document.querySelectorAll("[data-home-discord-link]"));
  const staffCardElement = staffCountElement?.closest(".home-stat") || null;
  const liveUpdatesLink = document.querySelector("[data-live-updates-link-root]");
  const liveUpdatesBadge = liveUpdatesLink?.querySelector("[data-live-updates-badge]") || null;
  const liveUpdatesPageRoot = document.querySelector("[data-live-updates-page-root]");
  const liveUpdatesPagination = document.getElementById("site-updates-pagination");
  const initialLiveUpdatesRevision = String(
    liveUpdatesPageRoot?.dataset.liveUpdatesInitialRevision ||
    liveUpdatesLink?.dataset.liveUpdatesInitialRevision ||
    ""
  ).trim();
  const initialLiveUpdatesRevisions = Array.from(
    new Set(
      String(
        liveUpdatesPageRoot?.dataset.liveUpdatesInitialRevisions ||
        liveUpdatesLink?.dataset.liveUpdatesInitialRevisions ||
        ""
      )
        .split("|")
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
  const hadInitialLiveUpdatesBaseline = Boolean(
    initialLiveUpdatesRevision || initialLiveUpdatesRevisions.length
  );

  const canEditUpdates = Boolean(updateForm);
  const LIVE_UPDATES_LAST_SEEN_KEY = "site-updates:last-seen-revision";
  const LIVE_UPDATES_LATEST_KEY = "site-updates:latest-revision";
  const LIVE_UPDATES_REVISIONS_LIMIT = Math.max(initialLiveUpdatesRevisions.length, 50);
  const LIVE_UPDATES_STATE_ENDPOINT = "/api/live-updates/state";
  const LIVE_UPDATES_SYNC_COOLDOWN_MS = 4000;
  const liveUpdatesPageSize = Math.max(
    1,
    Number.parseInt(liveUpdatesPageRoot?.dataset.liveUpdatesPageSize || "10", 10) || 10
  );
  const isPaginatedLiveUpdatesPage = Boolean(liveUpdatesPageRoot && list && liveUpdatesPagination);
  let currentLiveUpdatesPage = 1;
  let currentLiveUpdatesRevisions = initialLiveUpdatesRevisions.length
    ? [...initialLiveUpdatesRevisions]
    : initialLiveUpdatesRevision
      ? [initialLiveUpdatesRevision]
      : [];
  let lastLiveUpdatesSyncAt = 0;
  let liveUpdatesSyncPromise = null;
  let activeServerInstanceId = "";
  let serverInstanceReloadPending = false;
  const isChatPage = document.body?.classList?.contains("page-chat") === true;
  const isAdminUser = document.body?.dataset.currentUserIsAdmin === "true";
  let serverInstanceNoticeElement = null;
  let adminReloadTonePlayed = false;

  if (
    !list &&
    !heroSection &&
    !liveUpdatesLink &&
    !liveUpdatesPageRoot &&
    !updateModal &&
    !siteContentModal &&
    typeof io !== "function"
  ) {
    return;
  }

  function readLocalStorage(key) {
    try {
      return String(window.localStorage.getItem(key) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function writeLocalStorage(key, value) {
    const prepared = String(value || "").trim();
    if (!prepared) return;

    try {
      window.localStorage.setItem(key, prepared);
    } catch (_error) {
      // Ignore storage failures and keep the live badge best-effort only.
    }
  }

  function showServerReloadNotice() {
    if (!(document.body instanceof HTMLElement)) {
      return;
    }

    if (isAdminUser && !adminReloadTonePlayed) {
      adminReloadTonePlayed = true;
      playAdminServerReloadTone();
    }

    if (!serverInstanceNoticeElement) {
      const notice = document.createElement("div");
      notice.setAttribute("role", "status");
      notice.setAttribute("aria-live", "polite");
      notice.textContent = "Neue Version wird geladen...";
      notice.style.position = "fixed";
      notice.style.left = "50%";
      notice.style.top = "18px";
      notice.style.transform = "translateX(-50%)";
      notice.style.zIndex = "99999";
      notice.style.padding = "0.85rem 1.15rem";
      notice.style.borderRadius = "999px";
      notice.style.background = "rgba(12, 18, 28, 0.94)";
      notice.style.color = "#f8fafc";
      notice.style.boxShadow = "0 18px 40px rgba(15, 23, 42, 0.35)";
      notice.style.fontSize = "0.95rem";
      notice.style.fontWeight = "700";
      notice.style.letterSpacing = "0.01em";
      notice.style.opacity = "0";
      notice.style.transition = "opacity 160ms ease";
      document.body.appendChild(notice);
      serverInstanceNoticeElement = notice;
      window.requestAnimationFrame(() => {
        if (serverInstanceNoticeElement) {
          serverInstanceNoticeElement.style.opacity = "1";
        }
      });
      return;
    }

    serverInstanceNoticeElement.style.opacity = "1";
  }

  function playAdminServerReloadTone() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (typeof AudioContextCtor !== "function") {
      return;
    }

    try {
      const audioContext = new AudioContextCtor();
      const masterGain = audioContext.createGain();
      masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      masterGain.connect(audioContext.destination);

      const notes = [
        { frequency: 880, start: 0, duration: 0.08 },
        { frequency: 1174.66, start: 0.13, duration: 0.12 }
      ];

      notes.forEach((note) => {
        const oscillator = audioContext.createOscillator();
        const noteGain = audioContext.createGain();
        const startAt = audioContext.currentTime + note.start;
        const peakAt = startAt + 0.02;
        const stopAt = startAt + note.duration;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(note.frequency, startAt);
        noteGain.gain.setValueAtTime(0.0001, startAt);
        noteGain.gain.exponentialRampToValueAtTime(0.14, peakAt);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
        oscillator.connect(noteGain);
        noteGain.connect(masterGain);
        oscillator.start(startAt);
        oscillator.stop(stopAt + 0.02);
      });

      const closeContext = () => {
        window.setTimeout(() => {
          audioContext.close().catch(() => {});
        }, 450);
      };

      if (audioContext.state === "suspended") {
        audioContext.resume().then(closeContext).catch(() => {
          adminReloadTonePlayed = false;
        });
        return;
      }

      closeContext();
    } catch (_error) {
      adminReloadTonePlayed = false;
    }
  }

  function handleServerInstance(payload) {
    const applyReload = () => {
      if (isChatPage) {
        window.dispatchEvent(
          new CustomEvent("app:server-instance-reload", {
            detail: {
              instanceId: nextInstanceId
            }
          })
        );
        return;
      }

      window.location.reload();
    };
    const nextInstanceId = String(payload?.instanceId || "").trim();
    if (!nextInstanceId) {
      return;
    }

    if (!activeServerInstanceId) {
      activeServerInstanceId = nextInstanceId;
      return;
    }

    if (serverInstanceReloadPending || activeServerInstanceId === nextInstanceId) {
      activeServerInstanceId = nextInstanceId;
      return;
    }

    activeServerInstanceId = nextInstanceId;
    serverInstanceReloadPending = true;
    showServerReloadNotice();

    const finishReload = () => {
      if (!serverInstanceReloadPending) {
        return;
      }
      window.setTimeout(applyReload, 5000);
    };

    if (typeof window.fetch !== "function") {
      finishReload();
      return;
    }

    const requestHeaders = new Headers({
      "x-requested-with": "XMLHttpRequest"
    });
    const touchPromise = window.fetch("/session/touch", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      cache: "no-store",
      headers: requestHeaders
    });
    const timeoutPromise = new Promise((resolve) => {
      window.setTimeout(resolve, 2500);
    });

    Promise.race([touchPromise, timeoutPromise])
      .catch(() => null)
      .finally(finishReload);
  }

  function getLatestLiveUpdatesRevision() {
    return currentLiveUpdatesRevisions[0] || readLocalStorage(LIVE_UPDATES_LATEST_KEY) || initialLiveUpdatesRevision;
  }

  function syncLatestLiveUpdatesRevision(revision) {
    const prepared = String(revision || "").trim();
    if (!prepared) return "";
    writeLocalStorage(LIVE_UPDATES_LATEST_KEY, prepared);
    return prepared;
  }

  function parseRevisionToken(token) {
    const prepared = String(token || "").trim();
    if (!prepared) return null;

    const separatorIndex = prepared.lastIndexOf(":");
    if (separatorIndex <= 0 || separatorIndex >= prepared.length - 1) {
      return null;
    }

    const stamp = prepared.slice(0, separatorIndex).trim();
    const id = Number.parseInt(prepared.slice(separatorIndex + 1), 10);
    if (!stamp || !Number.isInteger(id) || id < 1) {
      return null;
    }

    return { stamp, id, raw: prepared };
  }

  function compareRevisionTokens(leftToken, rightToken) {
    const left = parseRevisionToken(leftToken);
    const right = parseRevisionToken(rightToken);
    if (!left && !right) return 0;
    if (!left) return -1;
    if (!right) return 1;

    if (left.stamp !== right.stamp) {
      return left.stamp > right.stamp ? 1 : -1;
    }

    if (left.id === right.id) {
      return 0;
    }

    return left.id > right.id ? 1 : -1;
  }

  function setCurrentLiveUpdatesRevisions(revisions) {
    const nextRevisions = [];
    revisions.forEach((value) => {
      const prepared = String(value || "").trim();
      if (!prepared || nextRevisions.includes(prepared)) {
        return;
      }
      nextRevisions.push(prepared);
    });

    nextRevisions.sort((left, right) => compareRevisionTokens(right, left));
    currentLiveUpdatesRevisions = nextRevisions.slice(0, LIVE_UPDATES_REVISIONS_LIMIT);
    if (currentLiveUpdatesRevisions[0]) {
      syncLatestLiveUpdatesRevision(currentLiveUpdatesRevisions[0]);
    }
  }

  function syncLiveUpdatesRevisionList(item) {
    const revision = String(item?.revision_token || item || "").trim();
    if (!revision) return "";

    const parsedRevision = parseRevisionToken(revision);
    const updateId = Number.isInteger(Number.parseInt(item?.id, 10))
      ? Number.parseInt(item.id, 10)
      : parsedRevision?.id || null;
    const filteredRevisions = currentLiveUpdatesRevisions.filter((entry) => {
      if (!entry || entry === revision) {
        return false;
      }
      if (!Number.isInteger(updateId) || updateId < 1) {
        return true;
      }
      return !String(entry).endsWith(`:${updateId}`);
    });

    setCurrentLiveUpdatesRevisions([revision, ...filteredRevisions]);
    return revision;
  }

  function removeLiveUpdatesRevisionByUpdateId(updateId) {
    const parsedUpdateId = Number.parseInt(updateId, 10);
    if (!Number.isInteger(parsedUpdateId) || parsedUpdateId < 1) {
      return;
    }

    setCurrentLiveUpdatesRevisions(
      currentLiveUpdatesRevisions.filter((entry) => !String(entry).endsWith(`:${parsedUpdateId}`))
    );
  }

  function getUnreadLiveUpdatesCount() {
    const lastSeenRevision = readLocalStorage(LIVE_UPDATES_LAST_SEEN_KEY);
    if (!lastSeenRevision) {
      return hadInitialLiveUpdatesBaseline ? 0 : currentLiveUpdatesRevisions.length;
    }

    if (!currentLiveUpdatesRevisions.length) {
      const latestRevision = getLatestLiveUpdatesRevision();
      return latestRevision && compareRevisionTokens(latestRevision, lastSeenRevision) > 0 ? 1 : 0;
    }

    return currentLiveUpdatesRevisions.reduce((count, revision) => {
      return count + (compareRevisionTokens(revision, lastSeenRevision) > 0 ? 1 : 0);
    }, 0);
  }

  function updateLiveUpdatesBadge() {
    if (!liveUpdatesLink || !liveUpdatesBadge) return;

    const unreadCount = getUnreadLiveUpdatesCount();

    liveUpdatesBadge.hidden = unreadCount < 1;
    if (unreadCount > 0) {
      liveUpdatesBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    }
  }

  function markLiveUpdatesAsSeen(revision = getLatestLiveUpdatesRevision()) {
    const prepared = String(revision || "").trim();
    if (!prepared) return;
    writeLocalStorage(LIVE_UPDATES_LAST_SEEN_KEY, prepared);
    updateLiveUpdatesBadge();
  }

  function syncLiveUpdatesRevisionFromItem(item, { autoSeen = false } = {}) {
    const revision = syncLiveUpdatesRevisionList(item);
    if (!revision) return;

    if (autoSeen) {
      markLiveUpdatesAsSeen(revision);
    } else {
      updateLiveUpdatesBadge();
    }
  }

  function syncBodyModalState() {
    const isAnyModalOpen =
      (updateModal && !updateModal.hidden) || (siteContentModal && !siteContentModal.hidden);

    document.body.classList.toggle("modal-open", Boolean(isAnyModalOpen));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildPlainHtml(content) {
    return escapeHtml(content).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");
  }

  function getUpdateItemData(article) {
    if (!article) return null;

    return {
      id: Number.parseInt(article.dataset.updateId || "", 10),
      author_name: article.dataset.updateAuthorName || "System",
      content: article.dataset.updateContent || "",
      created_at: article.dataset.updateCreatedAt || "",
      revision_token: article.dataset.updateRevisionToken || ""
    };
  }

  function getHomeContentData() {
    return {
      hero_title: heroTitleSource?.value || heroTitleElement?.textContent || "",
      hero_body: heroBodySource?.value || "",
      updates_title: updatesTitleSource?.value || updatesTitleElement?.textContent || ""
    };
  }

  function setTextContent(element, value) {
    if (!element) return;
    element.textContent = String(value ?? 0);
  }

  function getOrCreateStaffNamesElement() {
    let element = document.getElementById("home-staff-online-names");
    if (!element && staffCardElement) {
      element = document.createElement("small");
      element.id = "home-staff-online-names";
      element.className = "home-stat-names";
      staffCardElement.appendChild(element);
    }
    return element;
  }

  function getOrCreateStaffEmptyElement() {
    let element = document.getElementById("home-staff-online-empty");
    if (!element && staffCardElement) {
      element = document.createElement("small");
      element.id = "home-staff-online-empty";
      element.className = "home-stat-empty";
      element.textContent = "Niemand gerade online.";
      staffCardElement.appendChild(element);
    }
    return element;
  }

  function renderStaffNames(stats) {
    const adminNames = Array.isArray(stats?.adminOnlineNames) ? stats.adminOnlineNames : [];
    const moderatorNames = Array.isArray(stats?.moderatorOnlineNames)
      ? stats.moderatorOnlineNames
      : [];
    const entries = [
      ...adminNames.map((name) => ({ role: "admin", label: `${name} (A)` })),
      ...moderatorNames.map((name) => ({ role: "moderator", label: String(name || "").trim() }))
    ];
    const namesElement = getOrCreateStaffNamesElement();
    const emptyElement = getOrCreateStaffEmptyElement();

    if (!namesElement || !emptyElement) return;

    namesElement.replaceChildren();
    if (!entries.length) {
      namesElement.hidden = true;
      emptyElement.hidden = false;
      return;
    }

    entries.forEach((entry, index) => {
      const nameElement = document.createElement("span");
      nameElement.className =
        entry.role === "admin" ? "staff-name-admin" : "staff-name-moderator";
      nameElement.textContent = entry.label;
      namesElement.appendChild(nameElement);
      if (index < entries.length - 1) {
        namesElement.appendChild(document.createTextNode(", "));
      }
    });

    namesElement.hidden = false;
    emptyElement.hidden = true;
  }

  function applyHomeStats(stats) {
    if (!stats || typeof stats !== "object") return;

    setTextContent(accountCountElement, stats.accountCount);
    setTextContent(loggedInCountElement, stats.loggedInUserCount);
    setTextContent(
      staffCountElement,
      Number(stats.adminOnlineCount || 0) + Number(stats.moderatorOnlineCount || 0)
    );
    setTextContent(rpCharacterCountElement, stats.rpServerCount);
    setTextContent(freeRpOnlineCountElement, stats.freeRpOnlineCount);
    setTextContent(erpOnlineCountElement, stats.erpOnlineCount);
    setTextContent(larpCharacterCountElement, stats.larpServerCount);
    setTextContent(larpOnlineCountElement, stats.larpOnlineCount);
    setTextContent(
      discordMemberCountElement,
      Number.isFinite(Number(stats.discordMemberCount)) ? Number(stats.discordMemberCount) : "—"
    );
    setTextContent(
      discordOnlineCountElement,
      Number.isFinite(Number(stats.discordOnlineCount)) ? Number(stats.discordOnlineCount) : "—"
    );

    if (discordNameElement) {
      discordNameElement.textContent = "Discord";
    }

    if (discordIconElement) {
      const iconUrl = String(stats.discordIconUrl || "").trim();
      if (iconUrl) {
        discordIconElement.src = iconUrl;
        discordIconElement.hidden = false;
        if (discordIconFallbackElement) {
          discordIconFallbackElement.hidden = true;
        }
      } else {
        discordIconElement.src = TRANSPARENT_PIXEL;
        discordIconElement.hidden = true;
        if (discordIconFallbackElement) {
          discordIconFallbackElement.hidden = false;
        }
      }
    }

    if (discordLinkElements.length && stats.discordInviteUrl) {
      discordLinkElements.forEach((element) => {
        element.href = String(stats.discordInviteUrl);
      });
    }

    renderStaffNames(stats);
  }

  function applyHomeContent(homeContent) {
    if (!homeContent || typeof homeContent !== "object") return;

    if (heroTitleElement && homeContent.hero_title) {
      document.title = homeContent.hero_title;
    } else if (liveUpdatesPageRoot && homeContent.updates_title) {
      document.title = homeContent.updates_title;
    }

    if (heroTitleSource) {
      heroTitleSource.value = homeContent.hero_title || "";
    }

    if (heroBodySource) {
      heroBodySource.value = homeContent.hero_body || "";
    }

    if (heroTitleElement) {
      heroTitleElement.textContent = homeContent.hero_title || "";
    }

    if (heroBodyElement) {
      heroBodyElement.innerHTML =
        homeContent.hero_body_html || buildPlainHtml(homeContent.hero_body || "");
    }

    if (updatesTitleElement) {
      updatesTitleElement.textContent = homeContent.updates_title || "";
    }

    if (updatesTitleSource) {
      updatesTitleSource.value = homeContent.updates_title || "";
    }
  }

  function removeEmptyState() {
    const emptyState = document.getElementById("site-updates-empty");
    if (emptyState && emptyState.parentNode) {
      emptyState.parentNode.removeChild(emptyState);
    }
  }

  function ensureEmptyState() {
    if (!list) return;
    if (list.querySelector(".update-item")) return;
    if (document.getElementById("site-updates-empty")) return;

    const emptyState = document.createElement("p");
    emptyState.id = "site-updates-empty";
    emptyState.className = "muted";
    emptyState.textContent = "Noch keine Neuigkeiten veröffentlicht.";
    list.appendChild(emptyState);
  }

  function parsePositivePageNumber(value, fallback = 1) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return fallback;
    }

    return parsed;
  }

  function getLiveUpdatesPageHref(pageNumber) {
    const nextPage = Math.max(1, parsePositivePageNumber(pageNumber, 1));
    const nextUrl = new URL(window.location.href);
    if (nextPage <= 1) {
      nextUrl.searchParams.delete("page");
    } else {
      nextUrl.searchParams.set("page", String(nextPage));
    }

    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  }

  function syncLiveUpdatesPageUrl(pageNumber) {
    if (!isPaginatedLiveUpdatesPage || typeof window.history?.replaceState !== "function") {
      return;
    }

    window.history.replaceState(null, "", getLiveUpdatesPageHref(pageNumber));
  }

  function sortLiveUpdateItems() {
    if (!list) return [];

    const articles = Array.from(list.querySelectorAll(".update-item"));
    articles.sort((leftArticle, rightArticle) => {
      const leftToken = String(leftArticle.dataset.updateRevisionToken || "").trim();
      const rightToken = String(rightArticle.dataset.updateRevisionToken || "").trim();
      return compareRevisionTokens(rightToken, leftToken);
    });

    if (articles.length > 1) {
      const fragment = document.createDocumentFragment();
      articles.forEach((article) => {
        fragment.appendChild(article);
      });
      list.appendChild(fragment);
    }

    return articles;
  }

  function renderLiveUpdatesPagination() {
    if (!isPaginatedLiveUpdatesPage || !list || !liveUpdatesPagination) {
      return;
    }

    const articles = sortLiveUpdateItems();
    const totalItems = articles.length;
    if (!totalItems) {
      currentLiveUpdatesPage = 1;
      liveUpdatesPagination.innerHTML = "";
      liveUpdatesPagination.hidden = true;
      syncLiveUpdatesPageUrl(1);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / liveUpdatesPageSize));
    currentLiveUpdatesPage = Math.min(Math.max(currentLiveUpdatesPage, 1), totalPages);

    const startIndex = (currentLiveUpdatesPage - 1) * liveUpdatesPageSize;
    const endIndex = startIndex + liveUpdatesPageSize;
    articles.forEach((article, index) => {
      article.hidden = index < startIndex || index >= endIndex;
    });

    liveUpdatesPagination.innerHTML = "";
    if (totalPages <= 1) {
      liveUpdatesPagination.hidden = true;
      syncLiveUpdatesPageUrl(1);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const link = document.createElement("a");
      link.className = `site-updates-page-link${pageNumber === currentLiveUpdatesPage ? " is-active" : ""}`;
      link.href = getLiveUpdatesPageHref(pageNumber);
      link.textContent = String(pageNumber);
      link.setAttribute("aria-label", `Seite ${pageNumber}`);
      if (pageNumber === currentLiveUpdatesPage) {
        link.setAttribute("aria-current", "page");
      }
      fragment.appendChild(link);
    }

    liveUpdatesPagination.appendChild(fragment);
    liveUpdatesPagination.hidden = false;
    syncLiveUpdatesPageUrl(currentLiveUpdatesPage);
  }

  function createDeleteForm(updateId) {
    const formElement = document.createElement("form");
    formElement.method = "POST";
    formElement.action = `/updates/${updateId}/delete`;
    formElement.className = "inline-form";
    formElement.addEventListener("submit", (event) => {
      if (!window.confirm("Update wirklich löschen?")) {
        event.preventDefault();
      }
    });

    const button = document.createElement("button");
    button.className = "ghost-btn icon-btn update-delete-btn";
    button.type = "submit";
    button.setAttribute("aria-label", "Update löschen");
    button.title = "Update löschen";
    button.textContent = "X";
    formElement.appendChild(button);

    return formElement;
  }

  function createActionButtons(updateId) {
    const actions = document.createElement("div");
    actions.className = "update-item-actions";

    const editButton = document.createElement("button");
    editButton.className = "ghost-btn icon-btn update-edit-btn";
    editButton.type = "button";
    editButton.dataset.updateEdit = "";
    editButton.setAttribute("aria-label", "Update-Inhalt bearbeiten");
    editButton.title = "Update-Inhalt bearbeiten";
    editButton.innerHTML = "&#9998;";
    actions.appendChild(editButton);

    actions.appendChild(createDeleteForm(updateId));
    return actions;
  }

  function createUpdateElement(item) {
    const article = document.createElement("article");
    article.className = "update-item";

    const updateId = Number.parseInt(item?.id, 10);
    if (Number.isInteger(updateId) && updateId > 0) {
      article.dataset.updateId = String(updateId);
    }
    article.dataset.updateAuthorName = item?.author_name || "System";
    article.dataset.updateContent = item?.content || "";
    article.dataset.updateCreatedAt = item?.display_timestamp || item?.created_at || "";
    article.dataset.updateRevisionToken = item?.revision_token || "";

    const header = document.createElement("header");
    header.className = "update-meta";

    const author = document.createElement("strong");
    author.textContent = item?.author_name || "System";
    header.appendChild(author);

    const metaRight = document.createElement("div");
    metaRight.className = "update-meta-right";

    const time = document.createElement("small");
    time.textContent = item?.display_timestamp || item?.created_at || "";
    metaRight.appendChild(time);

    if (canEditUpdates && Number.isInteger(updateId) && updateId > 0) {
      metaRight.appendChild(createActionButtons(updateId));
    }

    header.appendChild(metaRight);
    article.appendChild(header);

    const body = document.createElement("div");
    body.className = "update-body guestbook-entry-body";
    body.innerHTML = item?.content_html || buildPlainHtml(item?.content || "");
    article.appendChild(body);

    return article;
  }

  function renderLiveUpdatesSnapshot(items) {
    if (!list) return;

    const normalizedItems = Array.isArray(items)
      ? items
          .filter((item) => {
            const updateId = Number.parseInt(item?.id, 10);
            return Number.isInteger(updateId) && updateId > 0;
          })
          .sort((left, right) =>
            compareRevisionTokens(right?.revision_token || "", left?.revision_token || "")
          )
      : [];

    list.replaceChildren();
    if (!normalizedItems.length) {
      ensureEmptyState();
      if (isPaginatedLiveUpdatesPage) {
        renderLiveUpdatesPagination();
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    normalizedItems.forEach((item) => {
      fragment.appendChild(createUpdateElement(item));
    });
    list.appendChild(fragment);

    if (isPaginatedLiveUpdatesPage) {
      renderLiveUpdatesPagination();
    } else {
      while (list.querySelectorAll(".update-item").length > 30) {
        const updates = list.querySelectorAll(".update-item");
        updates[updates.length - 1].remove();
      }
    }
  }

  function renderOrReplaceUpdate(item, { prepend = false } = {}) {
    if (!list || !item) return;

    const updateId = Number.parseInt(item.id, 10);
    if (!Number.isInteger(updateId) || updateId <= 0) return;

    const article = createUpdateElement(item);
    const existing = list.querySelector(`[data-update-id="${updateId}"]`);
    if (existing) {
      existing.replaceWith(article);
    } else if (prepend) {
      removeEmptyState();
      list.insertBefore(article, list.firstChild);
    } else {
      removeEmptyState();
      list.appendChild(article);
    }

    if (isPaginatedLiveUpdatesPage) {
      renderLiveUpdatesPagination();
    } else {
      while (list.querySelectorAll(".update-item").length > 30) {
        const updates = list.querySelectorAll(".update-item");
        updates[updates.length - 1].remove();
      }
    }
  }

  function deleteUpdate(updateId) {
    if (!list) return;
    const existing = list.querySelector(`[data-update-id="${updateId}"]`);
    if (existing) {
      existing.remove();
    }
    ensureEmptyState();
    if (isPaginatedLiveUpdatesPage) {
      renderLiveUpdatesPagination();
    }
  }

  function buildLiveUpdatesStateUrl() {
    const requestUrl = new URL(LIVE_UPDATES_STATE_ENDPOINT, window.location.origin);
    if (isPaginatedLiveUpdatesPage) {
      requestUrl.searchParams.set("scope", "full");
    } else if (list) {
      requestUrl.searchParams.set("limit", "30");
    } else {
      requestUrl.searchParams.set("limit", "50");
    }
    return requestUrl.toString();
  }

  async function refreshLiveUpdatesState({ force = false, markSeenIfVisible = false } = {}) {
    if (typeof window.fetch !== "function") {
      return null;
    }

    if (!liveUpdatesLink && !liveUpdatesPageRoot && !list) {
      return null;
    }

    if (!force && liveUpdatesSyncPromise) {
      return liveUpdatesSyncPromise;
    }

    if (
      !force &&
      lastLiveUpdatesSyncAt &&
      Date.now() - lastLiveUpdatesSyncAt < LIVE_UPDATES_SYNC_COOLDOWN_MS
    ) {
      return null;
    }

    liveUpdatesSyncPromise = window
      .fetch(buildLiveUpdatesStateUrl(), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          accept: "application/json"
        }
      })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const payload = await response.json();
        applyHomeContent(payload?.homeContent);

        const revisions = Array.isArray(payload?.recentSiteUpdateRevisions)
          ? payload.recentSiteUpdateRevisions
          : [];
        const latestRevision = String(payload?.latestSiteUpdateRevisionToken || "").trim();
        setCurrentLiveUpdatesRevisions(
          revisions.length ? revisions : latestRevision ? [latestRevision] : []
        );

        if (list && Array.isArray(payload?.siteUpdates)) {
          renderLiveUpdatesSnapshot(payload.siteUpdates);
        }

        if (markSeenIfVisible && liveUpdatesPageRoot && document.visibilityState !== "hidden") {
          markLiveUpdatesAsSeen(getLatestLiveUpdatesRevision());
        } else {
          updateLiveUpdatesBadge();
        }

        return payload;
      })
      .catch(() => null)
      .finally(() => {
        lastLiveUpdatesSyncAt = Date.now();
        liveUpdatesSyncPromise = null;
      });

    return liveUpdatesSyncPromise;
  }

  function setUpdateFormMode(mode, item = null) {
    if (!updateForm || !updateField || !updateTitle || !updateSubmitButton) return;

    if (mode === "edit" && item) {
      updateForm.action = `/updates/${item.id}/edit`;
      updateForm.dataset.mode = "edit";
      updateTitle.textContent = "Live-Update-Inhalt bearbeiten";
      updateSubmitButton.textContent = "Speichern";
      updateField.value = item.content || "";
    } else {
      updateForm.action = "/updates";
      updateForm.dataset.mode = "create";
      updateTitle.textContent = "Neues Live-Update";
      updateSubmitButton.textContent = "Veröffentlichen";
      updateField.value = "";
    }
  }

  function openUpdateModal(item = null) {
    if (!updateModal) return;
    setUpdateFormMode(item ? "edit" : "create", item);
    updateModal.hidden = false;
    updateModal.classList.add("is-open");
    syncBodyModalState();
    if (updateField) {
      updateField.focus();
      updateField.selectionStart = updateField.value.length;
      updateField.selectionEnd = updateField.value.length;
    }
  }

  function closeUpdateModal() {
    if (!updateModal) return;
    updateModal.classList.remove("is-open");
    updateModal.hidden = true;
    setUpdateFormMode("create");
    syncBodyModalState();
  }

  function openSiteContentModal(target) {
    if (!siteContentModal || !siteContentForm || !siteContentTitleInput || !siteContentModalTitle) {
      return;
    }

    const homeContent = getHomeContentData();

    if (target === "updates-title") {
      siteContentForm.action = "/site-content/updates-title";
      siteContentForm.dataset.mode = "updates-title";
      siteContentModalTitle.textContent = "Live-Updates-Überschrift bearbeiten";
      siteContentTitleInput.value = homeContent.updates_title || "";
      if (siteContentBodyWrap) {
        siteContentBodyWrap.hidden = true;
      }
      if (siteContentBodyInput) {
        siteContentBodyInput.value = "";
        siteContentBodyInput.required = false;
      }
    } else {
      siteContentForm.action = "/site-content/hero";
      siteContentForm.dataset.mode = "hero";
      siteContentModalTitle.textContent = "Startseitenbereich bearbeiten";
      siteContentTitleInput.value = homeContent.hero_title || "";
      if (siteContentBodyWrap) {
        siteContentBodyWrap.hidden = false;
      }
      if (siteContentBodyInput) {
        siteContentBodyInput.value = homeContent.hero_body || "";
        siteContentBodyInput.required = true;
      }
    }

    siteContentModal.hidden = false;
    siteContentModal.classList.add("is-open");
    syncBodyModalState();
    siteContentTitleInput.focus();
  }

  function closeSiteContentModal() {
    if (!siteContentModal) return;
    siteContentModal.classList.remove("is-open");
    siteContentModal.hidden = true;
    syncBodyModalState();
  }

  function insertBbcodeInto(field, openTag, closeTag, placeholder = "Text") {
    if (!field) return;

    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? 0;
    const selectedText = field.value.slice(start, end);
    const innerText = selectedText || placeholder;
    const replacement = `${openTag}${innerText}${closeTag}`;

    field.setRangeText(replacement, start, end, "select");

    const innerStart = start + openTag.length;
    const innerEnd = innerStart + innerText.length;
    field.focus();
    field.selectionStart = innerStart;
    field.selectionEnd = innerEnd;
  }

  function resolveBbcodeField(button) {
    if (!button) return null;
    const target = button.dataset.bbcodeTarget || "";
    if (target === "site-content-body") {
      return siteContentBodyInput;
    }
    return updateField;
  }

  function insertLinkBbcode(field) {
    if (!field) return;

    const rawUrl = window.prompt("Link eingeben:", "https://");
    if (rawUrl === null) return;

    const cleanedUrl = rawUrl.trim();
    if (!cleanedUrl) {
      field.focus();
      return;
    }

    insertBbcodeInto(field, `[url=${cleanedUrl}]`, "[/url]", "Linktext");
  }

  if (updateModal) {
    document.querySelectorAll("[data-update-open]").forEach((button) => {
      button.addEventListener("click", () => openUpdateModal());
    });

    if (updateCloseButton) {
      updateCloseButton.addEventListener("click", closeUpdateModal);
    }

    updateModal.addEventListener("click", (event) => {
      if (event.target === updateModal) {
        closeUpdateModal();
      }
    });
  }

  if (siteContentModal) {
    document.querySelectorAll("[data-site-content-open]").forEach((button) => {
      button.addEventListener("click", () => {
        openSiteContentModal(button.dataset.siteContentOpen || "hero");
      });
    });

    if (siteContentCloseButton) {
      siteContentCloseButton.addEventListener("click", closeSiteContentModal);
    }

    siteContentModal.addEventListener("click", (event) => {
      if (event.target === siteContentModal) {
        closeSiteContentModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (updateModal && !updateModal.hidden) {
      closeUpdateModal();
    }
    if (siteContentModal && !siteContentModal.hidden) {
      closeSiteContentModal();
    }
  });

  document.querySelectorAll("[data-bbcode-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      const tag = button.dataset.bbcodeTag;
      if (!tag) return;
      insertBbcodeInto(resolveBbcodeField(button), `[${tag}]`, `[/${tag}]`);
    });
  });

  document.querySelectorAll("[data-bbcode-link]").forEach((button) => {
    button.addEventListener("click", () => {
      insertLinkBbcode(resolveBbcodeField(button));
    });
  });

  if (list) {
    list.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-update-edit]");
      if (!editButton) return;

      const article = editButton.closest(".update-item");
      const item = getUpdateItemData(article);
      if (item && Number.isInteger(item.id) && item.id > 0) {
        openUpdateModal(item);
      }
    });
  }

  if (isPaginatedLiveUpdatesPage) {
    currentLiveUpdatesPage = parsePositivePageNumber(
      new URLSearchParams(window.location.search).get("page"),
      1
    );
    renderLiveUpdatesPagination();
  }

  if (typeof io !== "function") return;

  if (initialLiveUpdatesRevision) {
    if (!currentLiveUpdatesRevisions.length) {
      setCurrentLiveUpdatesRevisions([initialLiveUpdatesRevision]);
    } else {
      syncLatestLiveUpdatesRevision(getLatestLiveUpdatesRevision());
    }
    if (!readLocalStorage(LIVE_UPDATES_LAST_SEEN_KEY) && liveUpdatesLink) {
      writeLocalStorage(LIVE_UPDATES_LAST_SEEN_KEY, getLatestLiveUpdatesRevision());
    }
  }

  if (liveUpdatesPageRoot) {
    markLiveUpdatesAsSeen(getLatestLiveUpdatesRevision());

    const markCurrentRevisionAsSeen = () => {
      if (document.visibilityState !== "hidden") {
        refreshLiveUpdatesState({ markSeenIfVisible: true });
      }
    };

    document.addEventListener("visibilitychange", markCurrentRevisionAsSeen);
    window.addEventListener("focus", markCurrentRevisionAsSeen);
  }

  if (liveUpdatesLink) {
    updateLiveUpdatesBadge();
    liveUpdatesLink.addEventListener("click", (event) => {
      markLiveUpdatesAsSeen(getLatestLiveUpdatesRevision());

      if (liveUpdatesLink.dataset.liveUpdatesOpenMode === "same-tab") {
        return;
      }

      const shouldHandleInNamedTab =
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey;
      if (!shouldHandleInNamedTab) {
        return;
      }

      const liveUpdatesHref = liveUpdatesLink.href;
      const liveUpdatesTarget =
        liveUpdatesLink.dataset.liveUpdatesTarget ||
        liveUpdatesLink.getAttribute("target") ||
        "site-live-updates";
      if (!liveUpdatesHref || !liveUpdatesTarget) {
        return;
      }

      event.preventDefault();
      const openedWindow = window.open(liveUpdatesHref, liveUpdatesTarget);
      if (openedWindow && typeof openedWindow.focus === "function") {
        openedWindow.focus();
      }
    });

    window.addEventListener("pageshow", () => {
      updateLiveUpdatesBadge();
      refreshLiveUpdatesState({
        markSeenIfVisible: Boolean(liveUpdatesPageRoot && document.visibilityState !== "hidden")
      });
    });

    window.addEventListener("storage", (event) => {
      if (event.key === LIVE_UPDATES_LAST_SEEN_KEY || event.key === LIVE_UPDATES_LATEST_KEY) {
        updateLiveUpdatesBadge();
      }
    });
  }

  const socket = io({
    transports: ["websocket"]
  });

  socket.on("app:server-instance", handleServerInstance);

  socket.on("connect", () => {
    socket.emit("app:server-instance:request");
    refreshLiveUpdatesState({
      force: true,
      markSeenIfVisible: Boolean(liveUpdatesPageRoot && document.visibilityState !== "hidden")
    });
  });

  if (list) {
    socket.on("site:update:create", (item) => {
      renderOrReplaceUpdate(item, { prepend: true });
      syncLiveUpdatesRevisionFromItem(item, {
        autoSeen: Boolean(liveUpdatesPageRoot && document.visibilityState !== "hidden")
      });
    });

    socket.on("site:update:update", (item) => {
      renderOrReplaceUpdate(item);
      syncLiveUpdatesRevisionFromItem(item, {
        autoSeen: Boolean(liveUpdatesPageRoot && document.visibilityState !== "hidden")
      });
    });

    socket.on("site:update:delete", (payload) => {
      const updateId = Number.parseInt(payload?.id, 10);
      if (Number.isInteger(updateId) && updateId > 0) {
        deleteUpdate(updateId);
        removeLiveUpdatesRevisionByUpdateId(updateId);
        updateLiveUpdatesBadge();
      }
    });
  } else {
    socket.on("site:update:create", (item) => {
      syncLiveUpdatesRevisionFromItem(item);
    });

    socket.on("site:update:update", (item) => {
      syncLiveUpdatesRevisionFromItem(item);
    });

    socket.on("site:update:delete", (payload) => {
      removeLiveUpdatesRevisionByUpdateId(payload?.id);
      updateLiveUpdatesBadge();
    });
  }

  socket.on("site:home-content:update", (homeContent) => {
    applyHomeContent(homeContent);
  });

  socket.on("site:stats:update", (stats) => {
    applyHomeStats(stats);
  });
})();
