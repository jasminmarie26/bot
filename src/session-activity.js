"use strict";

const SESSION_OPEN_TAB_HEARTBEAT_INTERVAL_MS = 1000 * 60 * 5;
const SESSION_OPEN_TAB_STALE_MS = SESSION_OPEN_TAB_HEARTBEAT_INTERVAL_MS * 3;

function normalizeTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeSessionOpenTabId(rawTabId) {
  const normalizedTabId = String(rawTabId || "").trim();
  if (!normalizedTabId || normalizedTabId.length > 120) {
    return "";
  }

  return /^[A-Za-z0-9_-]+$/.test(normalizedTabId) ? normalizedTabId : "";
}

function normalizeSessionOpenTabsRecord(rawTabs, now = Date.now()) {
  const safeNow = normalizeTimestamp(now) || Date.now();
  const source = rawTabs && typeof rawTabs === "object" ? rawTabs : {};
  const normalizedTabs = {};

  Object.entries(source).forEach(([rawTabId, rawTimestamp]) => {
    const tabId = normalizeSessionOpenTabId(rawTabId);
    const lastSeenAt = normalizeTimestamp(rawTimestamp);
    if (!tabId || !lastSeenAt) {
      return;
    }

    if (safeNow - lastSeenAt > SESSION_OPEN_TAB_STALE_MS) {
      return;
    }

    normalizedTabs[tabId] = lastSeenAt;
  });

  return normalizedTabs;
}

function normalizeSessionTrackedPagePath(rawPath) {
  const value = String(rawPath || "").trim();
  if (!value) {
    return "";
  }

  try {
    const parsedUrl = new URL(value, "https://heldenhaftereisen.invalid");
    const normalizedPath = `${parsedUrl.pathname || "/"}${parsedUrl.search || ""}${parsedUrl.hash || ""}`;
    return normalizedPath.startsWith("/") && !normalizedPath.startsWith("//")
      ? normalizedPath.slice(0, 500)
      : "";
  } catch (_error) {
    return "";
  }
}

function normalizeSessionTrackedPageTitle(rawTitle) {
  return String(rawTitle || "")
    .replace(/\s+/g, " ")
    .replace(/^\(\d+\)\s*/g, "")
    .replace(/\s+\|\s+Heldenhafte Reisen$/i, "")
    .trim()
    .slice(0, 200);
}

function mergeSessionActivityState(nextSessionData, persistedSessionData, now = Date.now()) {
  if (!nextSessionData || typeof nextSessionData !== "object") {
    return nextSessionData;
  }

  if (!persistedSessionData || typeof persistedSessionData !== "object") {
    return nextSessionData;
  }

  const safeNow = normalizeTimestamp(now) || Date.now();
  const nextOpenTabs = normalizeSessionOpenTabsRecord(nextSessionData.open_tab_ids, safeNow);
  const persistedOpenTabs = normalizeSessionOpenTabsRecord(persistedSessionData.open_tab_ids, safeNow);
  const nextLastClosedAt = normalizeTimestamp(nextSessionData.last_all_tabs_closed_at);
  const persistedLastClosedAt = normalizeTimestamp(persistedSessionData.last_all_tabs_closed_at);
  const mergedLastClosedAt = Math.max(nextLastClosedAt, persistedLastClosedAt);
  const mergedOpenTabs = { ...persistedOpenTabs };

  Object.entries(nextOpenTabs).forEach(([tabId, lastSeenAt]) => {
    mergedOpenTabs[tabId] = Math.max(normalizeTimestamp(mergedOpenTabs[tabId]), lastSeenAt);
  });

  Object.keys(mergedOpenTabs).forEach((tabId) => {
    if (normalizeTimestamp(mergedOpenTabs[tabId]) <= mergedLastClosedAt) {
      delete mergedOpenTabs[tabId];
    }
  });

  if (Object.keys(mergedOpenTabs).length > 0) {
    nextSessionData.open_tab_ids = mergedOpenTabs;
    delete nextSessionData.last_all_tabs_closed_at;
  } else {
    delete nextSessionData.open_tab_ids;
    if (mergedLastClosedAt > 0) {
      nextSessionData.last_all_tabs_closed_at = mergedLastClosedAt;
    } else {
      delete nextSessionData.last_all_tabs_closed_at;
    }
  }

  const mergedLastHeartbeatAt = Math.max(
    normalizeTimestamp(nextSessionData.last_tab_heartbeat_at),
    normalizeTimestamp(persistedSessionData.last_tab_heartbeat_at)
  );
  if (mergedLastHeartbeatAt > 0) {
    nextSessionData.last_tab_heartbeat_at = mergedLastHeartbeatAt;
  } else {
    delete nextSessionData.last_tab_heartbeat_at;
  }

  const trackedPageCandidates = [
    {
      seenAt: normalizeTimestamp(persistedSessionData.last_page_seen_at),
      path: normalizeSessionTrackedPagePath(persistedSessionData.last_page_path),
      title: normalizeSessionTrackedPageTitle(persistedSessionData.last_page_title)
    },
    {
      seenAt: normalizeTimestamp(nextSessionData.last_page_seen_at),
      path: normalizeSessionTrackedPagePath(nextSessionData.last_page_path),
      title: normalizeSessionTrackedPageTitle(nextSessionData.last_page_title)
    }
  ]
    .filter((candidate) => candidate.path || candidate.title)
    .sort((left, right) => right.seenAt - left.seenAt);

  if (trackedPageCandidates.length > 0) {
    const latestTrackedPage = trackedPageCandidates[0];
    nextSessionData.last_page_path = latestTrackedPage.path;
    nextSessionData.last_page_title = latestTrackedPage.title;
    nextSessionData.last_page_seen_at = latestTrackedPage.seenAt;
  } else {
    delete nextSessionData.last_page_path;
    delete nextSessionData.last_page_title;
    delete nextSessionData.last_page_seen_at;
  }

  return nextSessionData;
}

function patchSessionStoreActivityMerge(store) {
  if (
    !store ||
    typeof store.get !== "function" ||
    typeof store.set !== "function" ||
    store.__hrActivityMergePatched === true
  ) {
    return store;
  }

  const originalSet = store.set.bind(store);
  const originalGet = store.get.bind(store);

  store.set = (sid, sessionData, callback) => {
    const done = typeof callback === "function" ? callback : () => {};

    originalGet(sid, (error, persistedSessionData) => {
      if (error || !persistedSessionData) {
        return originalSet(sid, sessionData, done);
      }

      return originalSet(sid, mergeSessionActivityState(sessionData, persistedSessionData), done);
    });
  };

  store.__hrActivityMergePatched = true;
  return store;
}

module.exports = {
  mergeSessionActivityState,
  patchSessionStoreActivityMerge
};
