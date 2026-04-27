(() => {
  const roomLockIconMarkup = [
    '<svg class="room-lock-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
    '<path class="room-lock-fill" d="M12 3.7a4.45 4.45 0 0 0-4.45 4.45v1.92c0 .18-.06.35-.16.5l-1.31 2a1.08 1.08 0 0 0 .91 1.67h10.02a1.08 1.08 0 0 0 .91-1.67l-1.31-2c-.1-.15-.16-.32-.16-.5V8.15A4.45 4.45 0 0 0 12 3.7Z"/>',
    '<path d="M8.1 10.02V8.35a3.9 3.9 0 1 1 7.8 0v1.67"/>',
    '<rect x="6.35" y="10.02" width="11.3" height="9.28" rx="2.15" ry="2.15"/>',
    '<path d="M12 13.15v2.8"/>',
    '</svg>'
  ].join("");

  const chatShell = document.getElementById("chat-shell");
  const chatBox = document.getElementById("chat-box");
  const chatScroll = document.getElementById("chat-scroll");
  const chatFeed = document.getElementById("chat-feed");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const onlineCharList = document.getElementById("online-char-list");
  const chatRoomHeading = document.querySelector(".chat-room-heading");
  const chatRoomTitle = document.querySelector(".chat-room-title");
  const chatRoomDivider = document.querySelector(".chat-room-divider");
  let chatRoomDescription = document.querySelector(".chat-room-description");
  const onlineActionsMenu = document.getElementById("online-actions-menu");
  const onlineActionGuestbook = document.getElementById("online-action-guestbook");
  const onlineActionWhisper = document.getElementById("online-action-whisper");
  const onlineActionFriend = document.getElementById("online-action-friend");
  const onlineActionIgnoreCharacter = document.getElementById("online-action-ignore-character");
  const onlineActionIgnoreAccount = document.getElementById("online-action-ignore-account");
  const whisperToggle = document.getElementById("chat-whisper-toggle");
  const whisperToggleBadge = document.getElementById("chat-whisper-toggle-badge");
  const soundToggle = document.getElementById("chat-sound-toggle");
  const soundPanel = document.getElementById("chat-sound-panel");
  const entrySoundCheckbox = document.getElementById("chat-entry-sound-toggle");
  const messageSoundCheckbox = document.getElementById("chat-message-sound-toggle");
  const whisperPanel = document.getElementById("chat-whisper-panel");
  const whisperPanelCloseBtn = document.getElementById("chat-whisper-close-btn");
  const whisperList = document.getElementById("chat-whisper-list");
  const whisperListEmpty = document.getElementById("chat-whisper-list-empty");
  const whisperPlaceholder = document.getElementById("chat-whisper-placeholder");
  const whisperThreadShell = document.getElementById("chat-whisper-thread-shell");
  const whisperThreadTitle = document.getElementById("chat-whisper-thread-title");
  const whisperThread = document.getElementById("whisper-thread");
  const whisperThreadEmpty = document.getElementById("whisper-thread-empty");
  const whisperForm = document.getElementById("whisper-form");
  const whisperInput = document.getElementById("whisper-input");
  const whisperTargetUserIdInput = document.getElementById("whisper-target-user-id");
  const roomInviteModal = document.getElementById("room-invite-modal");
  const roomInviteMessage = document.getElementById("room-invite-message");
  const roomInviteDescription = document.getElementById("room-invite-description");
  const roomInviteAcceptBtn = document.getElementById("room-invite-accept");
  const roomInviteDeclineBtn = document.getElementById("room-invite-decline");
  const headerIdentity = document.querySelector("[data-header-identity]");
  const userMenuIdentity = document.querySelector("[data-chat-user-menu-identity]");
  const chatUserMenus = Array.from(document.querySelectorAll(".rp-user-menu"));
  const chatRoomListLink = document.querySelector("[data-chat-roomlist-link]");
  const chatRpBoardLinks = Array.from(document.querySelectorAll("[data-rp-board-link-root]"));
  const chatCharacterLinkTargets = Array.from(document.querySelectorAll("[data-chat-character-href-template]"));
  const roomIdRaw = chatBox?.dataset?.roomId || "";
  const serverId = (chatBox?.dataset?.serverId || "free-rp").trim().toLowerCase();
  const standardRoomId = (chatBox?.dataset?.standardRoomId || "").trim().toLowerCase();
  const currentCharacterName = String(chatBox?.dataset?.currentCharacterName || "").trim();
  let currentDisplayName = String(chatBox?.dataset?.currentDisplayName || currentCharacterName || "").trim();
  let currentDisplayServerId = String(chatBox?.dataset?.serverId || serverId || "").trim().toLowerCase();
  const currentUserId = Number(chatBox?.dataset?.currentUserId || "");
  const currentUserIsAdmin = document.body?.dataset?.currentUserIsAdmin === "true";
  function isStandaloneAppMode() {
    try {
      if (window.matchMedia) {
        const displayModeQueries = [
          "(display-mode: standalone)",
          "(display-mode: fullscreen)",
          "(display-mode: window-controls-overlay)"
        ];
        if (displayModeQueries.some((query) => window.matchMedia(query).matches)) {
          return true;
        }
      }
    } catch (_error) {
      // Ignore display-mode detection errors and fall through to other checks.
    }

    try {
      if (window.navigator?.standalone === true) {
        return true;
      }
    } catch (_error) {
      // Ignore iOS standalone detection errors.
    }

    return String(document.referrer || "").startsWith("android-app://");
  }

  if (isStandaloneAppMode()) {
    document.body?.classList.add("is-standalone-app");
  }
  const activeCharacterIdRaw = chatBox?.dataset?.activeCharacterId || "";
  const roomId = Number(roomIdRaw);
  let currentActiveCharacterId = Number(activeCharacterIdRaw);
  let currentPresenceKey = getOwnPresenceKey(currentActiveCharacterId);
  let socialState = normalizeSocialState(window.__appSocialState || {});
  let lastRenderedOnlineEntries = [];
  function parseClientAfkTimeoutMinutes(value) {
    const parsedValue = Number(value);
    return Number.isInteger(parsedValue) && parsedValue >= 5 && parsedValue <= 240 ? parsedValue : 20;
  }

  let autoAfkEnabled = chatBox?.dataset?.autoAfkEnabled !== "0";
  let afkTimeoutMinutes = parseClientAfkTimeoutMinutes(chatBox?.dataset?.afkTimeoutMinutes || "");
  const showChatMessageTimestamps = chatBox?.dataset?.showChatTimestamps === "1";
  let afkTimeoutMs = afkTimeoutMinutes * 60 * 1000;
  const hasRoom = Number.isInteger(roomId) && roomId > 0;
  const chatChannelStorageKey = hasRoom
    ? `room-${roomId}`
    : `standard-${standardRoomId || "none"}`;
  const chatInputHistoryKey = [
    "chat-input-history",
    Number.isInteger(currentUserId) && currentUserId > 0 ? currentUserId : "guest",
    serverId,
    chatChannelStorageKey
  ].join(":");
  const chatInputDraftKey = [
    "chat-input-draft",
    Number.isInteger(currentUserId) && currentUserId > 0 ? currentUserId : "guest",
    serverId,
    chatChannelStorageKey
  ].join(":");
  const chatReloadSnapshotKey = [
    "chat-reload-snapshot",
    Number.isInteger(currentUserId) && currentUserId > 0 ? currentUserId : "guest",
    serverId,
    chatChannelStorageKey
  ].join(":");
  let selectedOnlineEntry = null;
  let typingEmitActive = false;
  let typingStopTimer = null;
  let afkTimer = null;
  let isCurrentChannelAfk = false;
  let currentAfkMode = "";
  const typingStateByUserId = new Map();
  const onlineEntriesByUserId = new Map();
  const whisperStateByPresenceKey = new Map();
  let whisperThreadsByKey = new Map();
  let whisperUnreadThreadKeys = new Set();
  const pendingRoomInvites = [];
  let activeRoomInvite = null;
  let activeWhisperThreadKey = "";
  let whisperSequence = 0;
  const entrySoundPreferenceKey = "chat-room-entry-sound-enabled";
  const messageSoundPreferenceKey = "chat-room-message-sound-enabled";
  const chatInputHistoryLimit = 50;
  const chatMessageRestoreLimit = 150;
  const chatReloadSnapshotMaxAgeMs = 5 * 60 * 1000;
  const typingIdleDelayMs = 1400;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext || null;
  const AudioElementCtor = typeof window.Audio === "function" ? window.Audio : null;
  let notificationAudioContext = null;
  let notificationAudioUnlockListenersBound = false;
  let notificationAudioPlaybackUnlocked = false;
  let notificationAudioPrimePromise = null;
  let entrySoundEnabled = true;
  let messageSoundEnabled = true;
  let isSoundPanelOpen = false;
  const activeNotificationAudios = new Set();
  const notificationToneDataUrls = {
    entry: "",
    chat: ""
  };
  if (!chatBox || !chatScroll || !chatFeed || !form || !input) return;
  const defaultDocumentTitle = String(document.title || "Heldenhafte Reisen").trim() || "Heldenhafte Reisen";
  const chatTabSiteLabel = "HR";
  const siteTitleLabel = chatTabSiteLabel;
  let unreadChatTabCount = 0;
  const chatBottomSnapThresholdPx = 48;
  let skipChatReloadSnapshotOnUnload = false;

  function clearChatReloadSnapshot() {
    removeSessionStorage(chatReloadSnapshotKey);
  }

  function prepareForIntentionalChatLeave() {
    skipChatReloadSnapshotOnUnload = true;
    clearChatReloadSnapshot();
  }

  function getChatBottomDistance() {
    if (!chatScroll) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, chatScroll.scrollHeight - chatScroll.clientHeight - chatScroll.scrollTop);
  }

  function isChatNearBottom() {
    return getChatBottomDistance() <= chatBottomSnapThresholdPx;
  }

  function scrollChatToBottom() {
    if (!chatScroll) {
      return;
    }
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }

  function keepChatPinnedToBottom(callback) {
    const shouldKeepBottom = isChatNearBottom();
    const result = typeof callback === "function" ? callback() : undefined;
    if (shouldKeepBottom) {
      window.requestAnimationFrame(() => {
        scrollChatToBottom();
      });
    }
    return result;
  }

  function getCurrentRoomLabel() {
    const titleTextNode = chatRoomTitle?.querySelector(".chat-room-title-text");
    return String(titleTextNode?.textContent || chatRoomTitle?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildPreferredChatTabTitleBase() {
    const titleParts = [];
    const nextDisplayName = String(currentDisplayName || chatBox?.dataset?.currentDisplayName || "").trim();
    const roomLabel = getCurrentRoomLabel();

    if (nextDisplayName) {
      titleParts.push(nextDisplayName);
    }
    if (nextDisplayName || roomLabel) {
      titleParts.push(chatTabSiteLabel);
    }
    if (roomLabel) {
      titleParts.push(roomLabel);
    }

    return titleParts.length ? titleParts.join(" \u2022 ") : defaultDocumentTitle;
  }

  function buildChatTabTitleBase() {
    const titleParts = [];
    const nextDisplayName = String(currentDisplayName || chatBox?.dataset?.currentDisplayName || "").trim();
    const roomLabel = getCurrentRoomLabel();

    if (nextDisplayName) {
      titleParts.push(nextDisplayName);
    }
    if (nextDisplayName || roomLabel) {
      titleParts.push(chatTabSiteLabel);
    }
    if (roomLabel) {
      titleParts.push(roomLabel);
    }

    return titleParts.length ? `${titleParts.join(" • ")} | ${siteTitleLabel}` : defaultDocumentTitle;
  }

  function updateChatTabTitle() {
    const nextBaseTitle = buildPreferredChatTabTitleBase();
    document.title = unreadChatTabCount > 0
      ? `(${unreadChatTabCount}) ${nextBaseTitle}`
      : nextBaseTitle;
  }

  function syncChatUrlCharacterId() {
    if (!Number.isInteger(currentActiveCharacterId) || currentActiveCharacterId < 1) {
      return;
    }

    try {
      const currentUrl = new URL(window.location.href);
      const nextCharacterId = String(currentActiveCharacterId);
      if (currentUrl.searchParams.get("character_id") === nextCharacterId) {
        return;
      }

      currentUrl.searchParams.set("character_id", nextCharacterId);
      window.history.replaceState(
        window.history.state,
        "",
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
      );
    } catch (_error) {
      // Ignore history replacement failures.
    }
  }

  function buildCurrentChatRoomListUrl() {
    return Number.isInteger(currentActiveCharacterId) && currentActiveCharacterId > 0
      ? `/characters/${currentActiveCharacterId}#roomlist`
      : "/dashboard";
  }

  function buildCurrentRpBoardUrl() {
    if (!Number.isInteger(currentActiveCharacterId) || currentActiveCharacterId < 1) {
      return "/rp-board";
    }

    const nextServerId = String(currentDisplayServerId || serverId || chatBox?.dataset?.serverId || "")
      .trim()
      .toLowerCase();
    const params = new URLSearchParams({
      character_id: String(currentActiveCharacterId)
    });

    if (nextServerId) {
      params.set("server_id", nextServerId);
    }

    return `/rp-board?${params.toString()}`;
  }

  function syncChatCharacterLinks() {
    if (!Number.isInteger(currentActiveCharacterId) || currentActiveCharacterId < 1) {
      return;
    }

    const nextCharacterId = String(currentActiveCharacterId);
    const nextServerId = String(currentDisplayServerId || serverId || chatBox?.dataset?.serverId || "")
      .trim()
      .toLowerCase();
    chatCharacterLinkTargets.forEach((node) => {
      const hrefTemplate = String(node?.dataset?.chatCharacterHrefTemplate || "").trim();
      if (!hrefTemplate) {
        return;
      }

      if (node.hasAttribute("data-chat-roomlist-link")) {
        node.href = buildCurrentChatRoomListUrl();
        return;
      }

      let nextHref = hrefTemplate.replace(/__CHARACTER_ID__/g, nextCharacterId);
      if (nextServerId) {
        nextHref = nextHref.replace(/__SERVER_ID__/g, nextServerId);
      }
      node.href = nextHref;
      if (node.hasAttribute("data-rp-board-character-id")) {
        node.setAttribute("data-rp-board-character-id", nextCharacterId);
      }
      if (node.hasAttribute("data-rp-board-server-id") && nextServerId) {
        node.setAttribute("data-rp-board-server-id", nextServerId);
      }
    });
  }

  function isChatTabActive() {
    return document.visibilityState === "visible" && document.hasFocus();
  }

  function markUnreadChatTab() {
    if (isChatTabActive()) {
      return;
    }

    unreadChatTabCount += 1;
    updateChatTabTitle();
  }

  function clearUnreadChatTab() {
    if (unreadChatTabCount < 1) {
      return;
    }

    unreadChatTabCount = 0;
    updateChatTabTitle();
  }

  function normalizeHexColor(value, fallback = "#EFEFEF") {
    const normalized = String(value || "").trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
  }

  function hexToRgb(value, fallback = "#EFEFEF") {
    const normalized = normalizeHexColor(value, fallback);
    return {
      r: Number.parseInt(normalized.slice(1, 3), 16),
      g: Number.parseInt(normalized.slice(3, 5), 16),
      b: Number.parseInt(normalized.slice(5, 7), 16)
    };
  }

  function getHexBrightness(value, fallback = "#EFEFEF") {
    const { r, g, b } = hexToRgb(value, fallback);
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  function getReadableUiTextColor(value, fallback = "#EFEFEF") {
    return getHexBrightness(value, fallback) > 150 ? "#1A1C20" : "#F4F5F7";
  }

  function getReadableUiMutedColor(value, fallback = "#EFEFEF") {
    return getHexBrightness(value, fallback) > 150 ? "#5F6670" : "rgba(244, 245, 247, 0.72)";
  }

  function getReadableUiBorderColor(value, fallback = "#EFEFEF") {
    return getHexBrightness(value, fallback) > 150 ? "rgba(26, 28, 32, 0.16)" : "rgba(244, 245, 247, 0.22)";
  }

  function normalizeBackgroundUrl(value) {
    const normalized = String(value || "").trim();
    return /^https?:\/\/.+/i.test(normalized) ? normalized : "";
  }

  function normalizeOpacityPercent(value, fallback = 100) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(100, Math.max(0, parsed));
  }

  function applyCharacterBackgroundAppearance(payload) {
    const payloadCharacterId = Number(payload?.character_id);
    if (
      !Number.isInteger(currentActiveCharacterId) ||
      currentActiveCharacterId < 1 ||
      payloadCharacterId !== currentActiveCharacterId
    ) {
      return;
    }

    const nextBackgroundColor = normalizeHexColor(payload?.chat_background_color, "#EFEFEF");
    const nextBackgroundUrl = normalizeBackgroundUrl(payload?.chat_background_url);
    const nextOpacity = normalizeOpacityPercent(payload?.chat_background_image_opacity, 100);
    const nextChatInputBackgroundColor = normalizeHexColor(
      payload?.chat_input_background_color,
      "#EFEFEF"
    );
    const nextChatOnlineListBackgroundColor = normalizeHexColor(
      payload?.chat_online_list_background_color,
      "#EFEFEF"
    );
    const backgroundRoot = chatBox || chatShell || document.body;
    const uiRoot = chatShell || chatBox || document.body;

    backgroundRoot.style.setProperty("--character-chat-background-color", nextBackgroundColor);
    backgroundRoot.style.setProperty(
      "--character-chat-background-image",
      nextBackgroundUrl ? `url(${JSON.stringify(nextBackgroundUrl)})` : "none"
    );
    backgroundRoot.style.setProperty("--character-chat-background-image-opacity", String(nextOpacity / 100));
    uiRoot.style.setProperty(
      "--character-chat-input-background-color",
      nextChatInputBackgroundColor
    );
    uiRoot.style.setProperty(
      "--character-chat-input-text-color",
      getReadableUiTextColor(nextChatInputBackgroundColor, "#EFEFEF")
    );
    uiRoot.style.setProperty(
      "--character-chat-input-placeholder-color",
      getReadableUiMutedColor(nextChatInputBackgroundColor, "#EFEFEF")
    );
    uiRoot.style.setProperty(
      "--character-chat-input-border-color",
      getReadableUiBorderColor(nextChatInputBackgroundColor, "#EFEFEF")
    );
    uiRoot.style.setProperty(
      "--character-chat-online-panel-background-color",
      nextChatOnlineListBackgroundColor
    );
    uiRoot.style.setProperty(
      "--character-chat-online-panel-text-color",
      getReadableUiTextColor(nextChatOnlineListBackgroundColor, "#EFEFEF")
    );
    uiRoot.style.setProperty(
      "--character-chat-online-panel-muted-color",
      getReadableUiMutedColor(nextChatOnlineListBackgroundColor, "#EFEFEF")
    );
    uiRoot.style.setProperty(
      "--character-chat-online-panel-border-color",
      getReadableUiBorderColor(nextChatOnlineListBackgroundColor, "#EFEFEF")
    );

    refreshExistingChatTextAppearance();
    renderOnlineCharacters(
      lastRenderedOnlineEntries.length ? lastRenderedOnlineEntries : captureRenderedOnlineEntriesFromDom()
    );
  }

  function formatRoleDisplayName(rawName, roleStyle = "") {
    const label = String(rawName || "").trim();
    return label.replace(/\s*\(M\)\s*$/i, "").trim();
  }

  function applySpecialNameDecor(node, rawName) {
    if (!node) return;
    const label = String(rawName || node.textContent || "").trim();
    node.classList.toggle("has-noctra-wings", /^noctra(?:\b|\s|\[|\()/i.test(label));
    node.classList.toggle("has-crescentia-moons", /^(?:crescentia|cresentia)(?:\b|\s|\[|\()/i.test(label));
    node.classList.toggle("has-cerberus-flame", /^cerberus(?:\b|\s|\[|\()/i.test(label));
  }

  function readSessionStorage(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function writeSessionStorage(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (_error) {
      // Ignore unavailable storage.
    }
  }

  function removeSessionStorage(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (_error) {
      // Ignore unavailable storage.
    }
  }

  function toPositiveIntegerOrNull(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function sanitizeChatMessageForRestore(message) {
    if (!message || typeof message !== "object") {
      return null;
    }

    return {
      type: String(message?.type || "").trim(),
      content: String(message?.content || ""),
      created_at: String(message?.created_at || "").trim(),
      message_time_iso: String(message?.message_time_iso || "").trim(),
      user_id: toPositiveIntegerOrNull(message?.user_id),
      character_id: toPositiveIntegerOrNull(message?.character_id),
      username: String(message?.username || "").trim(),
      role_style: String(message?.role_style || "").trim(),
      chat_text_color: String(message?.chat_text_color || "").trim(),
      show_name_time: Boolean(message?.show_name_time),
      system_kind: String(message?.system_kind || "").trim(),
      presence_kind: String(message?.presence_kind || "").trim(),
      presence_actor_name: String(message?.presence_actor_name || "").trim(),
      presence_actor_role_style: String(message?.presence_actor_role_style || "").trim(),
      presence_actor_chat_text_color: String(message?.presence_actor_chat_text_color || "").trim(),
      actor_target_name: String(message?.actor_target_name || "").trim(),
      actor_target_role_style: String(message?.actor_target_role_style || "").trim(),
      actor_target_chat_text_color: String(message?.actor_target_chat_text_color || "").trim(),
      actor_target_prefix: String(message?.actor_target_prefix || ""),
      actor_target_suffix: String(message?.actor_target_suffix || ""),
      presence_suffix: String(message?.presence_suffix || "").trim(),
      room_switch_target_name: String(message?.room_switch_target_name || "").trim()
    };
  }

  function consumeChatReloadSnapshot() {
    const rawValue = readSessionStorage(chatReloadSnapshotKey);
    if (!rawValue) {
      return null;
    }

    removeSessionStorage(chatReloadSnapshotKey);

    try {
      const parsed = JSON.parse(rawValue);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      const messages = Array.isArray(parsed.messages)
        ? parsed.messages
            .map((entry) => sanitizeChatMessageForRestore(entry))
            .filter(Boolean)
            .slice(-chatMessageRestoreLimit)
        : [];
      const scrollTop = Number(parsed.scrollTop);
      const disconnectAt =
        Number.isFinite(Number(parsed.disconnectAt)) && Number(parsed.disconnectAt) > 0
          ? Number(parsed.disconnectAt)
          : 0;
      if (disconnectAt > 0 && Date.now() - disconnectAt > chatReloadSnapshotMaxAgeMs) {
        return null;
      }

      return {
        reason: String(parsed.reason || "").trim(),
        disconnectAt,
        scrollTop: Number.isFinite(scrollTop) && scrollTop >= 0 ? scrollTop : null,
        characterId: toPositiveIntegerOrNull(parsed.characterId),
        messages
      };
    } catch (_error) {
      return null;
    }
  }

  function getOwnPresenceKey(characterId = currentActiveCharacterId) {
    const parsedCharacterId = Number(characterId);
    if (Number.isInteger(parsedCharacterId) && parsedCharacterId > 0) {
      return `character:${parsedCharacterId}`;
    }

    if (Number.isInteger(currentUserId) && currentUserId > 0) {
      return `user:${currentUserId}`;
    }

    return "guest";
  }

  function getChatAfkStateKey(presenceKey = currentPresenceKey) {
    return [
      "chat-afk-state",
      String(presenceKey || "").trim() || "guest",
      serverId,
      chatChannelStorageKey
    ].join(":");
  }

  function updateCurrentPresenceIdentity(payload) {
    if (!payload || !Object.prototype.hasOwnProperty.call(payload, "character_id")) {
      return;
    }

    const previousCharacterId = normalizePositiveNumber(currentActiveCharacterId);
    const previousPresenceKey = currentPresenceKey;
    const previousAfkStateKey = getChatAfkStateKey(previousPresenceKey);
    const parsedCharacterId = Number(payload?.character_id);
    currentActiveCharacterId =
      Number.isInteger(parsedCharacterId) && parsedCharacterId > 0
        ? parsedCharacterId
        : null;
    currentPresenceKey = getOwnPresenceKey(currentActiveCharacterId);

    if (chatBox) {
      chatBox.dataset.activeCharacterId =
        Number.isInteger(currentActiveCharacterId) && currentActiveCharacterId > 0
          ? String(currentActiveCharacterId)
          : "";
    }
    syncGlobalActiveCharacterId({
      dispatch: previousCharacterId !== normalizePositiveNumber(currentActiveCharacterId)
    });

    syncChatUrlCharacterId();
    syncChatCharacterLinks();

    if (previousPresenceKey !== currentPresenceKey) {
      setTypingStateForUser(previousPresenceKey, false);
      removeSessionStorage(previousAfkStateKey);
      isCurrentChannelAfk = false;
      currentAfkMode = "";
      clearStoredAfkState();
      switchWhisperState(currentPresenceKey);
      renderWhisperThreadList();
      renderWhisperThread();
      updateWhisperToggleBadge();
      scheduleAfkTimer();
    }
  }

  function resolvePresenceKey(payload) {
    const explicitKey = String(payload?.presence_key || "").trim();
    if (explicitKey) {
      return explicitKey;
    }

    const characterId = Number(payload?.character_id);
    if (Number.isInteger(characterId) && characterId > 0) {
      return `character:${characterId}`;
    }

    const userId = Number(payload?.user_id);
    if (Number.isInteger(userId) && userId > 0) {
      return `user:${userId}`;
    }

    return "";
  }

  function loadChatInputHistory() {
    const rawValue = readSessionStorage(chatInputHistoryKey);
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .slice(-chatInputHistoryLimit);
    } catch (_error) {
      return [];
    }
  }

  let chatInputHistory = loadChatInputHistory();
  let chatInputHistoryIndex = -1;
  let chatInputDraftBuffer = "";

  function saveChatInputHistory() {
    writeSessionStorage(chatInputHistoryKey, JSON.stringify(chatInputHistory.slice(-chatInputHistoryLimit)));
  }

  function getStoredChatDraft() {
    return String(readSessionStorage(chatInputDraftKey) || "");
  }

  function rememberChatDraft(value) {
    const nextValue = String(value || "");
    if (!nextValue.trim()) {
      return;
    }

    writeSessionStorage(chatInputDraftKey, nextValue);
  }

  function clearChatDraft() {
    removeSessionStorage(chatInputDraftKey);
  }

  function getStoredAfkState() {
    const rawValue = readSessionStorage(getChatAfkStateKey());
    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      return {
        mode: String(parsed.mode || "").trim().toLowerCase() === "auto" ? "auto" : "manual",
        reason: String(parsed.reason || "").trim().slice(0, 180)
      };
    } catch (_error) {
      return null;
    }
  }

  function rememberAfkState(mode, reason) {
    writeSessionStorage(
      getChatAfkStateKey(),
      JSON.stringify({
        mode: String(mode || "").trim().toLowerCase() === "auto" ? "auto" : "manual",
        reason: String(reason || "").trim().slice(0, 180)
      })
    );
  }

  function clearStoredAfkState() {
    removeSessionStorage(getChatAfkStateKey());
  }

  function rememberSentChatMessage(value) {
    const nextValue = String(value || "").trim();
    if (!nextValue) {
      return;
    }

    chatInputHistory.push(nextValue);
    if (chatInputHistory.length > chatInputHistoryLimit) {
      chatInputHistory = chatInputHistory.slice(-chatInputHistoryLimit);
    }
    saveChatInputHistory();
    clearChatDraft();
    chatInputHistoryIndex = -1;
    chatInputDraftBuffer = "";
  }

  function getChatHistoryNavigationEntries() {
    const entries = chatInputHistory.slice();
    const storedDraft = getStoredChatDraft();
    const currentValue = String(input?.value || "");
    const lastEntry = entries.length ? entries[entries.length - 1] : "";
    if (
      storedDraft &&
      storedDraft !== currentValue &&
      storedDraft !== chatInputDraftBuffer &&
      storedDraft !== lastEntry
    ) {
      entries.push(storedDraft);
    }
    return entries;
  }

  function applyChatInputValue(value) {
    const nextValue = String(value || "");
    input.value = nextValue;
    if (typeof input.setSelectionRange === "function") {
      input.setSelectionRange(nextValue.length, nextValue.length);
    }
    resizeChatInput();
    handleTypingInput();
  }

  function resizeChatInput() {
    if (!input || input.tagName !== "TEXTAREA") {
      return;
    }

    keepChatPinnedToBottom(() => {
      const maxHeight = 220;
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
      input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
    });
  }

  function shouldUseChatHistoryNavigation(event) {
    if (!input || input.tagName !== "TEXTAREA") {
      return true;
    }

    if (event.shiftKey) {
      return false;
    }

    const currentValue = String(input.value || "");
    if (!currentValue.includes("\n")) {
      return true;
    }

    const selectionStart = typeof input.selectionStart === "number" ? input.selectionStart : 0;
    const selectionEnd = typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
    if (selectionStart !== selectionEnd) {
      return false;
    }

    if (event.key === "ArrowUp") {
      return selectionStart === 0;
    }

    return selectionEnd === currentValue.length;
  }

  function handleChatHistoryNavigation(event) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return false;
    }

    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }

    if (!shouldUseChatHistoryNavigation(event)) {
      return false;
    }

    const entries = getChatHistoryNavigationEntries();
    if (!entries.length) {
      return false;
    }

    event.preventDefault();

    if (chatInputHistoryIndex === -1) {
      chatInputDraftBuffer = String(input?.value || "");
      chatInputHistoryIndex = entries.length;
    }

    if (event.key === "ArrowUp") {
      if (chatInputHistoryIndex > 0) {
        chatInputHistoryIndex -= 1;
      }
      applyChatInputValue(entries[chatInputHistoryIndex] || "");
      return true;
    }

    if (chatInputHistoryIndex < entries.length - 1) {
      chatInputHistoryIndex += 1;
      applyChatInputValue(entries[chatInputHistoryIndex] || "");
      return true;
    }

    chatInputHistoryIndex = -1;
    applyChatInputValue(chatInputDraftBuffer);
    chatInputDraftBuffer = "";
    return true;
  }

  function normalizeChatTextColor(rawColor) {
    const value = String(rawColor || "").trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "";
  }

  const chatColorParser = document.createElement("span");

  function parseCssColorToHex(rawColor) {
    const directHex = normalizeChatTextColor(rawColor);
    if (directHex) {
      return directHex;
    }

    const value = String(rawColor || "").trim();
    if (!value) {
      return "";
    }

    chatColorParser.style.color = "";
    chatColorParser.style.color = value;
    const normalized = String(chatColorParser.style.color || "").trim();
    const rgbMatch = normalized.match(
      /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+)\s*)?\)$/i
    );
    if (!rgbMatch) {
      return "";
    }
    if (typeof rgbMatch[4] === "string" && rgbMatch[4] !== "" && Number(rgbMatch[4]) === 0) {
      return "";
    }

    return `#${rgbMatch
      .slice(1, 4)
      .map((channel) =>
        Math.max(0, Math.min(255, Number.parseInt(channel, 10) || 0)).toString(16).padStart(2, "0")
      )
      .join("")
      .toUpperCase()}`;
  }

  function mixHexColors(fromHex, toHex, amount) {
    const from = hexToRgb(fromHex, "#AEE7B7");
    const to = hexToRgb(toHex, "#FFFFFF");
    const mix = Math.min(1, Math.max(0, Number(amount) || 0));
    return `#${[from.r, from.g, from.b]
      .map((channel, index) => {
        const target = [to.r, to.g, to.b][index];
        return Math.round(channel + (target - channel) * mix)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
      .toUpperCase()}`;
  }

  function getRelativeLuminance(hex) {
    const { r, g, b } = hexToRgb(hex, "#AEE7B7");
    const channels = [r, g, b].map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function getContrastRatio(firstHex, secondHex) {
    const first = getRelativeLuminance(firstHex);
    const second = getRelativeLuminance(secondHex);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function ensureTextContrast(rawColor, rawBackground, targetRatio = 4.5) {
    const color = parseCssColorToHex(rawColor);
    const background = parseCssColorToHex(rawBackground) || "#EFEFEF";
    if (!color) {
      return "";
    }

    if (getContrastRatio(color, background) >= targetRatio) {
      return color;
    }

    const whiteContrast = getContrastRatio("#FFFFFF", background);
    const blackContrast = getContrastRatio("#000000", background);
    const targetColor = whiteContrast >= blackContrast ? "#FFFFFF" : "#000000";
    let bestColor = color;
    let bestContrast = getContrastRatio(color, background);

    for (let step = 0.08; step <= 1; step += 0.08) {
      const candidate = mixHexColors(color, targetColor, step);
      const candidateContrast = getContrastRatio(candidate, background);
      if (candidateContrast > bestContrast) {
        bestColor = candidate;
        bestContrast = candidateContrast;
      }
      if (candidateContrast >= targetRatio) {
        return candidate;
      }
    }

    return bestColor;
  }

  const CHAT_NAME_GRADIENT_PRESETS = {
    admin: {
      stops: [
        { color: "#FF4D6D", position: "0%" },
        { color: "#FF985C", position: "45%" },
        { color: "#FFE08A", position: "100%" }
      ],
      fallbackColor: "#FF9C70"
    },
    noctraAdmin: {
      stops: [
        { color: "#5F0008", position: "0%" },
        { color: "#B40F1F", position: "34%" },
        { color: "#F24A1D", position: "72%" },
        { color: "#FFB35C", position: "100%" }
      ],
      fallbackColor: "#FFB35C"
    },
    cerberus: {
      stops: [
        { color: "#090505", position: "0%" },
        { color: "#360707", position: "20%" },
        { color: "#B01717", position: "52%" },
        { color: "#220707", position: "82%" },
        { color: "#050303", position: "100%" }
      ],
      fallbackColor: "#C72922"
    },
    crescentia: {
      stops: [
        { color: "#330075", position: "0%" },
        { color: "#7A58FF", position: "42%" },
        { color: "#000158", position: "100%" }
      ],
      fallbackColor: "#8F9FFF"
    }
  };

  function normalizePositiveNumber(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeSocialState(payload) {
    const friends = Array.isArray(payload?.friends)
      ? payload.friends
          .map((entry) => ({
            friend_type: String(entry?.friend_type || "").trim().toLowerCase() === "character" ? "character" : "user",
            source_character_id: normalizePositiveNumber(entry?.source_character_id),
            user_id: normalizePositiveNumber(entry?.user_id),
            friend_character_id: normalizePositiveNumber(entry?.friend_character_id)
          }))
          .filter((entry) => entry.user_id)
      : [];
    const friendUserIds = Array.isArray(payload?.friend_user_ids)
      ? payload.friend_user_ids.map((value) => normalizePositiveNumber(value)).filter(Boolean)
      : [];
    const friendCharacterIds = Array.isArray(payload?.friend_character_ids)
      ? payload.friend_character_ids.map((value) => normalizePositiveNumber(value)).filter(Boolean)
      : [];
    const ignoredAccountUserIds = Array.isArray(payload?.ignored_account_user_ids)
      ? payload.ignored_account_user_ids.map((value) => normalizePositiveNumber(value)).filter(Boolean)
      : [];
    const ignoredCharacterIds = Array.isArray(payload?.ignored_character_ids)
      ? payload.ignored_character_ids.map((value) => normalizePositiveNumber(value)).filter(Boolean)
      : [];

    return {
      friends,
      friendUserIds: new Set(friendUserIds),
      friendCharacterIds: new Set(friendCharacterIds),
      ignoredAccountUserIds: new Set(ignoredAccountUserIds),
      ignoredCharacterIds: new Set(ignoredCharacterIds)
    };
  }

  function getCurrentSocialSourceCharacterId() {
    return normalizePositiveNumber(currentActiveCharacterId) || normalizePositiveNumber(window.__appActiveCharacterId);
  }

  function friendMatchesCurrentCharacter(entry, sourceCharacterId = getCurrentSocialSourceCharacterId()) {
    const entrySourceCharacterId = normalizePositiveNumber(entry?.source_character_id);
    if (!sourceCharacterId || !entrySourceCharacterId) {
      return true;
    }
    return entrySourceCharacterId === sourceCharacterId;
  }

  function getCurrentCharacterFriendEntries() {
    const friends = Array.isArray(socialState?.friends) ? socialState.friends : [];
    return friends.filter((entry) => friendMatchesCurrentCharacter(entry));
  }

  function syncGlobalActiveCharacterId({ dispatch = false } = {}) {
    const nextCharacterId = normalizePositiveNumber(currentActiveCharacterId);
    window.__appActiveCharacterId = nextCharacterId;
    if (dispatch) {
      window.dispatchEvent(
        new CustomEvent("app:active-character-change", {
          detail: {
            characterId: nextCharacterId
          }
        })
      );
    }
  }

  syncGlobalActiveCharacterId();

  function isIgnoredSocialEntry(entry) {
    if (!entry || entry.is_npc === true) {
      return false;
    }

    const userId = normalizePositiveNumber(entry?.user_id ?? entry?.userId);
    const characterId = normalizePositiveNumber(entry?.character_id ?? entry?.characterId);
    return Boolean(
      (userId && socialState.ignoredAccountUserIds.has(userId)) ||
      (characterId && socialState.ignoredCharacterIds.has(characterId))
    );
  }

  function isFriendUserId(userId) {
    const parsedUserId = normalizePositiveNumber(userId);
    if (!parsedUserId) {
      return false;
    }
    if (Array.isArray(socialState.friends) && socialState.friends.length) {
      return getCurrentCharacterFriendEntries().some(
        (entry) => entry?.friend_type !== "character" && entry?.user_id === parsedUserId
      );
    }
    return socialState.friendUserIds.has(parsedUserId);
  }

  function isFriendCharacterId(characterId) {
    const parsedCharacterId = normalizePositiveNumber(characterId);
    if (!parsedCharacterId) {
      return false;
    }
    if (Array.isArray(socialState.friends) && socialState.friends.length) {
      return getCurrentCharacterFriendEntries().some(
        (entry) => entry?.friend_type === "character" && entry?.friend_character_id === parsedCharacterId
      );
    }
    return socialState.friendCharacterIds.has(parsedCharacterId);
  }

  function isIgnoredAccountUserId(userId) {
    const parsedUserId = normalizePositiveNumber(userId);
    return Boolean(parsedUserId && socialState.ignoredAccountUserIds.has(parsedUserId));
  }

  function isIgnoredCharacterId(characterId) {
    const parsedCharacterId = normalizePositiveNumber(characterId);
    return Boolean(parsedCharacterId && socialState.ignoredCharacterIds.has(parsedCharacterId));
  }

  function isIgnoredWhisperTarget(userId, characterId) {
    return Boolean(
      isIgnoredAccountUserId(userId) ||
      isIgnoredCharacterId(characterId)
    );
  }

  function captureRenderedOnlineEntriesFromDom() {
    if (!onlineCharList) {
      return [];
    }

    return Array.from(onlineCharList.querySelectorAll(".chat-online-item")).map((node) => ({
      presence_key: String(node.dataset.presenceKey || "").trim(),
      user_id: normalizePositiveNumber(node.dataset.userId) || 0,
      character_id: normalizePositiveNumber(node.dataset.characterId),
      name: String(node.dataset.name || node.textContent || "").trim(),
      show_birthday_cake: String(node.dataset.showBirthdayCake || "").trim() === "1",
      role_style: String(node.dataset.roleStyle || "").trim(),
      chat_text_color: String(node.dataset.chatTextColor || "").trim(),
      is_afk: node.querySelector(".chat-afk-clock") != null,
      is_npc: node.classList.contains("is-npc")
    }));
  }

  function getChatSurfaceColorForNode(node) {
    const surfaceRoot = node?.closest?.(".chat-online-panel")
      ? (chatShell || chatBox || document.body)
      : (chatBox || chatShell || document.body);
    const cssVariable = node?.closest?.(".chat-online-panel")
      ? "--character-chat-online-panel-background-color"
      : "--character-chat-background-color";
    const computedValue = surfaceRoot instanceof HTMLElement
      ? window.getComputedStyle(surfaceRoot).getPropertyValue(cssVariable)
      : "";
    return parseCssColorToHex(computedValue) || "#EFEFEF";
  }

  function getGradientPresetForNode(node) {
    if (!(node instanceof HTMLElement)) {
      return null;
    }

    if (node.classList.contains("has-cerberus-flame")) {
      return CHAT_NAME_GRADIENT_PRESETS.cerberus;
    }
    if (node.classList.contains("has-crescentia-moons")) {
      return CHAT_NAME_GRADIENT_PRESETS.crescentia;
    }
    if (node.classList.contains("role-name-admin") && node.classList.contains("has-noctra-wings")) {
      return CHAT_NAME_GRADIENT_PRESETS.noctraAdmin;
    }
    if (node.classList.contains("role-name-admin")) {
      return CHAT_NAME_GRADIENT_PRESETS.admin;
    }
    return null;
  }

  function applyAdaptiveGradientText(node, preset, backgroundHex) {
    if (!(node instanceof HTMLElement) || !preset) {
      return;
    }

    const shouldUseSolidFallback =
      document.body.classList.contains("chat-gradient-fallback")
      || document.body.classList.contains("is-standalone-app");

    if (shouldUseSolidFallback) {
      const solidColor = ensureTextContrast(preset.fallbackColor, backgroundHex, 4.5) || preset.fallbackColor;
      node.style.setProperty("background", "none", "important");
      node.style.setProperty("background-image", "none", "important");
      node.style.setProperty("-webkit-background-clip", "initial", "important");
      node.style.setProperty("background-clip", "initial", "important");
      node.style.setProperty("-webkit-text-fill-color", solidColor, "important");
      node.style.setProperty("color", solidColor, "important");
      return;
    }

    const gradient = `linear-gradient(90deg, ${preset.stops
      .map((stop) => `${ensureTextContrast(stop.color, backgroundHex, 3.7) || stop.color} ${stop.position}`)
      .join(", ")})`;
    node.style.setProperty("background", gradient, "important");
    node.style.setProperty("background-image", gradient, "important");
    node.style.setProperty("background-size", "100% 100%", "important");
    node.style.setProperty("background-repeat", "no-repeat", "important");
    node.style.setProperty("-webkit-background-clip", "text", "important");
    node.style.setProperty("background-clip", "text", "important");
    node.style.setProperty("-webkit-text-fill-color", "transparent", "important");
    node.style.setProperty("color", "transparent", "important");
  }

  function applyChatTextColor(node, rawColor, options = {}) {
    if (!(node instanceof HTMLElement)) return;

    const backgroundHex = parseCssColorToHex(options.backgroundColor) || getChatSurfaceColorForNode(node);
    const preset = options.allowGradient === false ? null : getGradientPresetForNode(node);

    if (preset) {
      applyAdaptiveGradientText(node, preset, backgroundHex);
      return;
    }

    const sourceColor = parseCssColorToHex(rawColor) || parseCssColorToHex(window.getComputedStyle(node).color);
    const adjustedColor = ensureTextContrast(sourceColor, backgroundHex, 4.5);
    if (adjustedColor) {
      node.style.setProperty("color", adjustedColor, "important");
    } else {
      node.style.removeProperty("color");
    }
  }

  function clearChatTextColor(node) {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    node.style.removeProperty("background");
    node.style.removeProperty("background-image");
    node.style.removeProperty("background-size");
    node.style.removeProperty("background-repeat");
    node.style.removeProperty("-webkit-background-clip");
    node.style.removeProperty("background-clip");
    node.style.removeProperty("-webkit-text-fill-color");
    node.style.removeProperty("color");
  }

  function setChatColorSource(node, rawColor) {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    const normalizedColor = normalizeChatTextColor(rawColor);
    if (normalizedColor) {
      node.dataset.chatColorSource = normalizedColor;
    } else {
      delete node.dataset.chatColorSource;
    }
  }

  function applyStoredChatTextColor(node, rawColor, options = {}) {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    const normalizedColor = normalizeChatTextColor(rawColor);
    const preset = options.allowGradient === false ? null : getGradientPresetForNode(node);
    if (!normalizedColor && !preset) {
      clearChatTextColor(node);
      return;
    }

    applyChatTextColor(node, normalizedColor, options);
  }

  function refreshExistingChatTextAppearance() {
    if (!(chatFeed instanceof HTMLElement)) {
      return;
    }

    chatFeed.querySelectorAll(".chat-own-message-time").forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const fallbackColor = String(node.dataset.chatTimeSourceColor || "").trim();
      applyStoredChatTextColor(node, fallbackColor, { allowGradient: false });
    });

    chatFeed.querySelectorAll("article.chat-message em").forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const fallbackColor = String(node.dataset.chatColorSource || "").trim();
      applyStoredChatTextColor(node, fallbackColor, { allowGradient: false });
    });

    chatFeed.querySelectorAll("article.chat-message strong").forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const fallbackColor = String(node.dataset.chatColorSource || "").trim();
      applyStoredChatTextColor(node, fallbackColor);
    });

    chatFeed.querySelectorAll("article.chat-message em > span").forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const fallbackColor = String(node.dataset.chatColorSource || "").trim();
      applyStoredChatTextColor(node, fallbackColor);
    });

    chatFeed.querySelectorAll("article.chat-message p > span").forEach((node) => {
      if (!(node instanceof HTMLElement) || node.classList.contains("chat-own-message-time")) {
        return;
      }
      const fallbackColor = String(
        node.dataset.chatColorSource || (node.closest(".chat-system") ? "#000000" : "")
      ).trim();
      applyStoredChatTextColor(node, fallbackColor, { allowGradient: false });
    });
  }

  function getBirthdayCakeLabel(label, showBirthdayCake) {
    const nextLabel = String(label || "").trim();
    if (!nextLabel) {
      return "";
    }
    return showBirthdayCake ? `${String.fromCodePoint(0x1F382)} ${nextLabel}` : nextLabel;
  }

  function setIdentityNodeAppearance(
    node,
    name,
    { roleStyle = "", chatTextColor = "", showBirthdayCake = false } = {}
  ) {
    if (!node) {
      return;
    }

    const nextName = String(name || "").trim();
    const nextRoleStyle = String(roleStyle || "").trim().toLowerCase();
    const nextChatTextColor = String(chatTextColor || "").trim();

    node.classList.remove(
      "role-name-admin",
      "role-name-moderator",
      "has-noctra-wings",
      "has-crescentia-moons",
      "has-cerberus-flame"
    );
    if (nextRoleStyle === "admin" || nextRoleStyle === "moderator") {
      node.classList.add(`role-name-${nextRoleStyle}`);
    }

    node.textContent = getBirthdayCakeLabel(nextName, showBirthdayCake);
    node.title = getBirthdayCakeLabel(nextName, showBirthdayCake);
    applySpecialNameDecor(node, nextName);

    if (nextChatTextColor) {
      node.style.color = nextChatTextColor;
    } else {
      node.style.removeProperty("color");
    }
  }

  function updateHeaderIdentity(payload) {
    const nextServerId = String(payload?.server_id || "").trim().toLowerCase();
    if (nextServerId) {
      currentDisplayServerId = nextServerId;
    }
    updateCurrentPresenceIdentity(payload);
    applyCharacterBackgroundAppearance(payload);
    applyAfkPreferences(payload);
    const nextName = String(payload?.name || "").trim();
    const nextRoleStyle = String(payload?.role_style || "").trim().toLowerCase();
    const nextColor = String(payload?.chat_text_color || "").trim();
    const showBirthdayCake = payload?.show_birthday_cake === true;
    if (!nextName) return;

    currentDisplayName = getBirthdayCakeLabel(nextName, showBirthdayCake);
    setIdentityNodeAppearance(headerIdentity, nextName, {
      roleStyle: nextRoleStyle,
      chatTextColor: nextColor,
      showBirthdayCake
    });
    setIdentityNodeAppearance(userMenuIdentity, nextName, {
      roleStyle: nextRoleStyle,
      chatTextColor: nextColor,
      showBirthdayCake
    });
    if (chatBox) {
      chatBox.dataset.currentDisplayName = getBirthdayCakeLabel(nextName, showBirthdayCake);
      chatBox.dataset.currentCharacterName = nextName;
    }
    updateChatTabTitle();
  }

  function applyAfkPreferences(payload) {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const hasAutoAfkEnabled = Object.prototype.hasOwnProperty.call(payload, "auto_afk_enabled");
    const hasAfkTimeoutMinutes = Object.prototype.hasOwnProperty.call(payload, "afk_timeout_minutes");
    if (!hasAutoAfkEnabled && !hasAfkTimeoutMinutes) {
      return;
    }

    autoAfkEnabled = hasAutoAfkEnabled
      ? payload.auto_afk_enabled === true || payload.auto_afk_enabled === 1 || payload.auto_afk_enabled === "1"
      : autoAfkEnabled;
    afkTimeoutMinutes = hasAfkTimeoutMinutes
      ? parseClientAfkTimeoutMinutes(payload.afk_timeout_minutes)
      : afkTimeoutMinutes;
    afkTimeoutMs = afkTimeoutMinutes * 60 * 1000;

    if (chatBox) {
      chatBox.dataset.autoAfkEnabled = autoAfkEnabled ? "1" : "0";
      chatBox.dataset.afkTimeoutMinutes = String(afkTimeoutMinutes);
    }

    if (!autoAfkEnabled) {
      clearAfkTimer();
      if (isCurrentChannelAfk && currentAfkMode === "auto") {
        socket.emit("chat:activity");
        isCurrentChannelAfk = false;
        currentAfkMode = "";
        clearStoredAfkState();
      }
      return;
    }

    scheduleAfkTimer();
  }

  let renderedChatMessages = [];
  let pendingChatReloadRecovery = consumeChatReloadSnapshot();
  let serverRestartReloadInProgress = false;

  if (Number.isInteger(pendingChatReloadRecovery?.characterId) && pendingChatReloadRecovery.characterId > 0) {
    currentActiveCharacterId = pendingChatReloadRecovery.characterId;
    currentPresenceKey = getOwnPresenceKey(currentActiveCharacterId);
    if (chatBox) {
      chatBox.dataset.activeCharacterId = String(currentActiveCharacterId);
    }
    syncGlobalActiveCharacterId();
  }

  function getWhisperStateKey(presenceKey = currentPresenceKey) {
    return String(presenceKey || "").trim() || "guest";
  }

  function switchWhisperState(presenceKey = currentPresenceKey) {
    const stateKey = getWhisperStateKey(presenceKey);
    let state = whisperStateByPresenceKey.get(stateKey);
    if (!state) {
      state = {
        threadsByKey: new Map(),
        unreadThreadKeys: new Set(),
        activeThreadKey: ""
      };
      whisperStateByPresenceKey.set(stateKey, state);
    }

    whisperThreadsByKey = state.threadsByKey;
    whisperUnreadThreadKeys = state.unreadThreadKeys;
    activeWhisperThreadKey = String(state.activeThreadKey || "").trim();
    return state;
  }

  function setActiveWhisperThreadKey(threadKey) {
    const normalizedThreadKey = String(threadKey || "").trim();
    activeWhisperThreadKey = normalizedThreadKey;
    const currentState = whisperStateByPresenceKey.get(getWhisperStateKey());
    if (currentState) {
      currentState.activeThreadKey = normalizedThreadKey;
    }
  }

  switchWhisperState(currentPresenceKey);

  function hasNightEyeMarker() {
    if (!(document.body instanceof HTMLElement)) {
      return false;
    }

    const combinedClassNames = `${document.documentElement.className || ""} ${document.body.className || ""}`
      .trim()
      .toLowerCase();
    if (combinedClassNames.includes("night-eye")) {
      return true;
    }

    return Boolean(
      document.querySelector(
        '[id*="night-eye"], [class*="night-eye"], [data-night-eye], style[id*="night-eye"], link[id*="night-eye"]'
      )
    );
  }

  function applyChatGradientFallbackIfNeeded() {
    if (!(document.body instanceof HTMLElement)) {
      return;
    }

    let shouldUseFallback = hasNightEyeMarker();

    if (!shouldUseFallback) {
      const probe = document.createElement("span");
      probe.className = "chat-online-name has-crescentia-moons";
      probe.textContent = "Crescentia";
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      probe.style.whiteSpace = "nowrap";
      probe.style.left = "-9999px";
      document.body.appendChild(probe);

      try {
        const computed = window.getComputedStyle(probe);
        const backgroundImage = String(computed.backgroundImage || "").trim().toLowerCase();
        const backgroundClip = String(
          computed.backgroundClip || computed.getPropertyValue("background-clip") || ""
        ).trim().toLowerCase();
        const webkitBackgroundClip = String(
          computed.webkitBackgroundClip || computed.getPropertyValue("-webkit-background-clip") || ""
        ).trim().toLowerCase();
        const webkitTextFillColor = String(
          computed.webkitTextFillColor || computed.getPropertyValue("-webkit-text-fill-color") || ""
        ).trim().toLowerCase();
        const hasGradient = backgroundImage && backgroundImage !== "none";
        const clipsToText = backgroundClip.includes("text") || webkitBackgroundClip.includes("text");
        const transparentFill = webkitTextFillColor.includes("transparent");
        shouldUseFallback = hasGradient && transparentFill && !clipsToText;
      } catch (_error) {
        shouldUseFallback = false;
      } finally {
        probe.remove();
      }
    }

    document.body.classList.toggle("chat-gradient-fallback", shouldUseFallback);
  }

  applyChatGradientFallbackIfNeeded();
  applySpecialNameDecor(headerIdentity, currentDisplayName);
  applySpecialNameDecor(userMenuIdentity, currentDisplayName);
  syncChatUrlCharacterId();
  syncChatCharacterLinks();
  updateChatTabTitle();

  function rememberRenderedChatMessage(message) {
    const snapshot = sanitizeChatMessageForRestore(message);
    if (!snapshot) {
      return;
    }

    renderedChatMessages.push(snapshot);
    if (renderedChatMessages.length > chatMessageRestoreLimit) {
      renderedChatMessages = renderedChatMessages.slice(-chatMessageRestoreLimit);
    }
  }

  function saveChatReloadSnapshot(reason = "page-reload") {
    if (skipChatReloadSnapshotOnUnload) {
      clearChatReloadSnapshot();
      return;
    }

    const snapshotReason = serverRestartReloadInProgress
      ? "server-instance-reload"
      : String(reason || "").trim() || "page-reload";

    writeSessionStorage(
      chatReloadSnapshotKey,
      JSON.stringify({
        reason: snapshotReason,
        disconnectAt: lastDisconnectAt > 0 ? lastDisconnectAt : Date.now(),
        scrollTop: chatScroll.scrollTop,
        characterId:
          Number.isInteger(currentActiveCharacterId) && currentActiveCharacterId > 0
            ? currentActiveCharacterId
            : null,
        messages: renderedChatMessages.slice(-chatMessageRestoreLimit)
      })
    );
  }

  function reloadChatAfterServerRestart() {
    if (serverRestartReloadInProgress) {
      return;
    }

    serverRestartReloadInProgress = true;
    window.__chatImmediateLeave?.setServerRestartReloadInProgress(true);
    saveChatReloadSnapshot("server-instance-reload");
    window.location.reload();
  }

  const socket = io({
    transports: ["websocket"],
    closeOnBeforeunload: true
  });

  function disconnectChatSocketForUnload() {
    if (serverRestartReloadInProgress) {
      return;
    }

    try {
      if (socket.connected || socket.active) {
        socket.disconnect();
      }
    } catch (_error) {
      // Ignore unload disconnect failures.
    }
  }

  socket.on("chat:message", appendMessage);
  socket.on("chat:whisper", handleWhisperMessage);
  socket.on("chat:online-characters", (entries) => {
    const nextEntries = Array.isArray(entries) ? entries.slice() : [];
    lastRenderedOnlineEntries = nextEntries;
    renderOnlineCharacters(nextEntries);
  });
  socket.on("chat:room-invite", handleRoomInvite);
  socket.on("chat:redirect", (payload) => {
    const nextUrl = String(payload?.url || "").trim();
    const delayMs = Number(payload?.delayMs);
    if (!nextUrl.startsWith("/")) return;
    prepareForIntentionalChatLeave();
    if (Number.isFinite(delayMs) && delayMs > 0) {
      window.setTimeout(() => {
        window.location.assign(nextUrl);
      }, delayMs);
      return;
    }
    window.location.assign(nextUrl);
  });
  socket.on("character:appearance:update", applyCharacterBackgroundAppearance);
  socket.on("user:display-profile", updateHeaderIdentity);
  socket.on("chat:typing", (payload) => {
    const presenceKey = resolvePresenceKey(payload);
    if (!presenceKey) {
      return;
    }

    setTypingStateForUser(presenceKey, Boolean(payload?.is_typing));
  });
  socket.on("chat:afk-state", (payload) => {
    if (resolvePresenceKey(payload) !== currentPresenceKey) {
      return;
    }

    if (payload?.active && String(payload?.mode || "").trim().toLowerCase() === "auto" && !autoAfkEnabled) {
      clearStoredAfkState();
      socket.emit("chat:activity");
      isCurrentChannelAfk = false;
      currentAfkMode = "";
      scheduleAfkTimer();
      return;
    }

    isCurrentChannelAfk = Boolean(payload?.active);
    currentAfkMode = isCurrentChannelAfk ? String(payload?.mode || "") : "";
    if (isCurrentChannelAfk) {
      rememberAfkState(currentAfkMode, String(payload?.reason || ""));
      clearAfkTimer();
      return;
    }

    clearStoredAfkState();
    scheduleAfkTimer();
  });
  socket.on("chat:room-state", updateRoomLockState);

  try {
    entrySoundEnabled = window.localStorage.getItem(entrySoundPreferenceKey) !== "0";
  } catch (_error) {
    entrySoundEnabled = true;
  }

  try {
    messageSoundEnabled = window.localStorage.getItem(messageSoundPreferenceKey) !== "0";
  } catch (_error) {
    messageSoundEnabled = true;
  }

  function clampNotificationSample(value) {
    return Math.max(-1, Math.min(1, Number(value) || 0));
  }

  function getNotificationWaveSample(waveType, phase) {
    const normalizedWave = String(waveType || "sine").trim().toLowerCase();
    if (normalizedWave === "triangle") {
      return (2 * Math.asin(Math.sin(phase))) / Math.PI;
    }
    if (normalizedWave === "square") {
      return Math.sin(phase) >= 0 ? 1 : -1;
    }
    return Math.sin(phase);
  }

  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return window.btoa(binary);
  }

  function buildNotificationToneDataUrl(kind) {
    const normalizedKind = kind === "entry" ? "entry" : "chat";
    if (notificationToneDataUrls[normalizedKind]) {
      return notificationToneDataUrls[normalizedKind];
    }

    if (typeof window.btoa !== "function") {
      return "";
    }

    const sampleRate = 22050;
    const totalDurationMs = normalizedKind === "entry" ? 420 : 320;
    const totalSamples = Math.max(1, Math.floor((totalDurationMs / 1000) * sampleRate));
    const samples = new Float32Array(totalSamples);
    const trackDefinitions = normalizedKind === "entry"
      ? [
          { startMs: 0, durationMs: 210, startFreq: 880, endFreq: 1320, volume: 0.5, wave: "triangle" },
          { startMs: 18, durationMs: 240, startFreq: 1320, endFreq: 1760, volume: 0.24, wave: "sine" },
          { startMs: 150, durationMs: 160, startFreq: 1174, endFreq: 1046, volume: 0.18, wave: "sine" }
        ]
      : [
          { startMs: 0, durationMs: 170, startFreq: 660, endFreq: 880, volume: 0.42, wave: "sine" },
          { startMs: 32, durationMs: 190, startFreq: 523, endFreq: 659, volume: 0.24, wave: "triangle" }
        ];

    for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
      const currentTime = sampleIndex / sampleRate;
      let mixedSample = 0;

      trackDefinitions.forEach((track) => {
        const startTime = track.startMs / 1000;
        const duration = track.durationMs / 1000;
        const endTime = startTime + duration;
        if (currentTime < startTime || currentTime >= endTime) {
          return;
        }

        const localTime = currentTime - startTime;
        const progress = duration > 0 ? localTime / duration : 0;
        const attack = Math.min(0.025, duration * 0.35);
        const release = Math.min(0.09, duration * 0.45);
        let envelope = 1;

        if (attack > 0 && localTime < attack) {
          envelope = localTime / attack;
        } else if (release > 0 && endTime - currentTime < release) {
          envelope = (endTime - currentTime) / release;
        }

        const frequency = track.startFreq + ((track.endFreq ?? track.startFreq) - track.startFreq) * progress;
        const phase = 2 * Math.PI * frequency * localTime;
        mixedSample += getNotificationWaveSample(track.wave, phase) * track.volume * Math.max(0, envelope);
      });

      samples[sampleIndex] = clampNotificationSample(mixedSample * 0.85);
    }

    const wavBuffer = new ArrayBuffer(44 + totalSamples * 2);
    const view = new DataView(wavBuffer);
    let offset = 0;

    function writeAscii(value) {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset, value.charCodeAt(index));
        offset += 1;
      }
    }

    writeAscii("RIFF");
    view.setUint32(offset, 36 + totalSamples * 2, true);
    offset += 4;
    writeAscii("WAVE");
    writeAscii("fmt ");
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, sampleRate * 2, true);
    offset += 4;
    view.setUint16(offset, 2, true);
    offset += 2;
    view.setUint16(offset, 16, true);
    offset += 2;
    writeAscii("data");
    view.setUint32(offset, totalSamples * 2, true);
    offset += 4;

    for (let index = 0; index < totalSamples; index += 1) {
      const pcmValue = Math.max(-32768, Math.min(32767, Math.round(samples[index] * 32767)));
      view.setInt16(offset, pcmValue, true);
      offset += 2;
    }

    const dataUrl = `data:audio/wav;base64,${bufferToBase64(wavBuffer)}`;
    notificationToneDataUrls[normalizedKind] = dataUrl;
    return dataUrl;
  }

  function registerNotificationAudioElement(audio) {
    activeNotificationAudios.add(audio);

    const cleanup = () => {
      activeNotificationAudios.delete(audio);
      audio.removeEventListener("ended", cleanup);
      audio.removeEventListener("error", cleanup);
    };

    audio.addEventListener("ended", cleanup);
    audio.addEventListener("error", cleanup);
    return cleanup;
  }

  function stopActiveNotificationAudios() {
    activeNotificationAudios.forEach((audio) => {
      try {
        audio.pause();
      } catch (_error) {
        // Ignore pause failures on already-finished sounds.
      }

      try {
        audio.currentTime = 0;
      } catch (_error) {
        // Ignore seek failures on transient audio elements.
      }

      activeNotificationAudios.delete(audio);
    });
  }

  async function playNotificationAudioElement(kind, { volume = 1 } = {}) {
    const normalizedKind = kind === "entry" ? "entry" : "chat";
    const preferenceEnabled = normalizedKind === "entry" ? entrySoundEnabled : messageSoundEnabled;
    if (!preferenceEnabled) {
      return false;
    }

    if (!AudioElementCtor || !notificationAudioPlaybackUnlocked) {
      return false;
    }

    const source = buildNotificationToneDataUrl(normalizedKind);
    if (!source) {
      return false;
    }

    const audio = new AudioElementCtor(source);
    audio.preload = "auto";
    audio.volume = Math.max(0, Math.min(1, volume));
    const cleanup = registerNotificationAudioElement(audio);

    try {
      const playback = audio.play();
      if (playback && typeof playback.then === "function") {
        await playback;
      }
      return true;
    } catch (_error) {
      cleanup();
      notificationAudioPlaybackUnlocked = false;
      bindNotificationAudioUnlockListeners();
      return false;
    }
  }

  async function primeNotificationAudioPlayback() {
    if (!AudioElementCtor || !isAnySoundEnabled()) {
      return false;
    }

    if (notificationAudioPrimePromise) {
      return notificationAudioPrimePromise;
    }

    const source = buildNotificationToneDataUrl("chat");
    if (!source) {
      return false;
    }

    notificationAudioPrimePromise = (async () => {
      const audio = new AudioElementCtor(source);
      audio.preload = "auto";
      audio.muted = true;
      audio.volume = 0;
      const cleanup = registerNotificationAudioElement(audio);

      try {
        const playback = audio.play();
        if (playback && typeof playback.then === "function") {
          await playback;
        }
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch (_error) {
          // Ignore seek failures on short priming sounds.
        }
        notificationAudioPlaybackUnlocked = true;
        return true;
      } catch (_error) {
        notificationAudioPlaybackUnlocked = false;
        return false;
      } finally {
        cleanup();
        notificationAudioPrimePromise = null;
      }
    })();

    return notificationAudioPrimePromise;
  }

  function getNotificationAudioContext() {
    if (!AudioContextCtor) return null;
    if (!notificationAudioContext || notificationAudioContext.state === "closed") {
      notificationAudioContext = new AudioContextCtor();
      if (typeof notificationAudioContext.addEventListener === "function") {
        notificationAudioContext.addEventListener("statechange", syncNotificationAudioUnlockState);
      }
    }
    return notificationAudioContext;
  }

  function removeNotificationAudioUnlockListeners() {
    if (!notificationAudioUnlockListenersBound) {
      return;
    }

    window.removeEventListener("pointerdown", unlockNotificationAudio);
    window.removeEventListener("keydown", unlockNotificationAudio);
    window.removeEventListener("touchstart", unlockNotificationAudio);
    window.removeEventListener("click", unlockNotificationAudio);
    notificationAudioUnlockListenersBound = false;
  }

  function bindNotificationAudioUnlockListeners() {
    if (notificationAudioUnlockListenersBound) {
      return;
    }

    window.addEventListener("pointerdown", unlockNotificationAudio);
    window.addEventListener("keydown", unlockNotificationAudio);
    window.addEventListener("touchstart", unlockNotificationAudio);
    window.addEventListener("click", unlockNotificationAudio);
    notificationAudioUnlockListenersBound = true;
  }

  function syncNotificationAudioUnlockState() {
    const context = notificationAudioContext;
    if (notificationAudioPlaybackUnlocked || context?.state === "running") {
      removeNotificationAudioUnlockListeners();
      return;
    }

    bindNotificationAudioUnlockListeners();
  }

  async function unlockNotificationAudio() {
    const context = getNotificationAudioContext();
    notificationAudioPlaybackUnlocked = true;

    if (context && context.state !== "running") {
      try {
        await context.resume();
      } catch (_error) {
        // Ignore resume failures for now and keep listening for the next real user gesture.
      }
    }

    if (notificationAudioPlaybackUnlocked) {
      await primeNotificationAudioPlayback();
    }

    syncNotificationAudioUnlockState();
  }

  function isAnySoundEnabled() {
    return entrySoundEnabled || messageSoundEnabled;
  }

  function updateSoundToggle() {
    if (soundToggle) {
      soundToggle.classList.toggle("is-open", isSoundPanelOpen);
      soundToggle.setAttribute("aria-expanded", isSoundPanelOpen ? "true" : "false");
      soundToggle.setAttribute(
        "aria-label",
        isSoundPanelOpen ? "Ton-Einstellungen schließen" : "Ton-Einstellungen öffnen"
      );
      soundToggle.title = "Ton-Einstellungen";
    }

    if (soundPanel) {
      soundPanel.hidden = !isSoundPanelOpen;
    }

    if (entrySoundCheckbox) {
      entrySoundCheckbox.checked = entrySoundEnabled;
    }

    if (messageSoundCheckbox) {
      messageSoundCheckbox.checked = messageSoundEnabled;
    }
  }

  function openSoundPanel() {
    if (!soundPanel) return;
    isSoundPanelOpen = true;
    updateSoundToggle();
  }

  function closeSoundPanel() {
    if (!isSoundPanelOpen) return;
    isSoundPanelOpen = false;
    updateSoundToggle();
  }

  function closeChatUserMenus() {
    chatUserMenus.forEach((menu) => {
      if (menu instanceof HTMLDetailsElement) {
        menu.open = false;
      }
    });
  }

  function toggleSoundPanel() {
    if (isSoundPanelOpen) {
      closeSoundPanel();
      return;
    }

    openSoundPanel();
  }

  async function persistSoundPreferences() {
    try {
      window.localStorage.setItem(entrySoundPreferenceKey, entrySoundEnabled ? "1" : "0");
      window.localStorage.setItem(messageSoundPreferenceKey, messageSoundEnabled ? "1" : "0");
    } catch (_error) {
      // Ignore storage failures; the toggles still work for the current session.
    }

    updateSoundToggle();
    if (!isAnySoundEnabled()) {
      stopActiveNotificationAudios();
    }
    if (isAnySoundEnabled()) {
      await unlockNotificationAudio();
    }
  }

  async function getReadyNotificationAudioContext(preferenceEnabled) {
    if (!preferenceEnabled) return null;
    const context = getNotificationAudioContext();
    if (!context) return;

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch (_error) {
        // Continue; the activation might happen elsewhere.
      }
    }

    if (context.state !== "running") return null;

    return context;
  }

  async function playEntryTone() {
    if (!entrySoundEnabled) {
      return;
    }

    if (await playNotificationAudioElement("entry", { volume: 0.98 })) {
      return;
    }

    const context = await getReadyNotificationAudioContext(entrySoundEnabled);
    if (!context) return;

    const lead = context.createOscillator();
    const shimmer = context.createOscillator();
    const gain = context.createGain();

    lead.type = "triangle";
    shimmer.type = "sine";

    lead.frequency.setValueAtTime(932, context.currentTime);
    lead.frequency.exponentialRampToValueAtTime(1396, context.currentTime + 0.1);
    lead.frequency.exponentialRampToValueAtTime(1174, context.currentTime + 0.28);

    shimmer.frequency.setValueAtTime(1396, context.currentTime);
    shimmer.frequency.exponentialRampToValueAtTime(1760, context.currentTime + 0.12);
    shimmer.frequency.exponentialRampToValueAtTime(1318, context.currentTime + 0.28);

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.085, context.currentTime + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.38);

    lead.connect(gain);
    shimmer.connect(gain);
    gain.connect(context.destination);

    lead.start(context.currentTime);
    shimmer.start(context.currentTime);
    lead.stop(context.currentTime + 0.4);
    shimmer.stop(context.currentTime + 0.4);
  }

  async function playChatTone() {
    if (!messageSoundEnabled) {
      return;
    }

    if (await playNotificationAudioElement("chat", { volume: 0.92 })) {
      return;
    }

    const context = await getReadyNotificationAudioContext(messageSoundEnabled);
    if (!context) return;

    const lead = context.createOscillator();
    const echo = context.createOscillator();
    const gain = context.createGain();

    lead.type = "sine";
    echo.type = "triangle";

    lead.frequency.setValueAtTime(740, context.currentTime);
    lead.frequency.exponentialRampToValueAtTime(988, context.currentTime + 0.08);
    lead.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.18);

    echo.frequency.setValueAtTime(523, context.currentTime + 0.01);
    echo.frequency.exponentialRampToValueAtTime(659, context.currentTime + 0.11);
    echo.frequency.exponentialRampToValueAtTime(587, context.currentTime + 0.2);

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);

    lead.connect(gain);
    echo.connect(gain);
    gain.connect(context.destination);

    lead.start(context.currentTime);
    echo.start(context.currentTime);
    lead.stop(context.currentTime + 0.3);
    echo.stop(context.currentTime + 0.3);
  }

  if (soundToggle) {
    soundToggle.addEventListener("click", async () => {
      toggleSoundPanel();
      if (isAnySoundEnabled()) {
        await unlockNotificationAudio();
      }
    });
  }

  if (entrySoundCheckbox) {
    entrySoundCheckbox.addEventListener("change", async () => {
      entrySoundEnabled = entrySoundCheckbox.checked;
      await persistSoundPreferences();
      if (entrySoundEnabled) {
        await playEntryTone();
      }
    });
  }

  if (messageSoundCheckbox) {
    messageSoundCheckbox.addEventListener("change", async () => {
      messageSoundEnabled = messageSoundCheckbox.checked;
      await persistSoundPreferences();
      if (messageSoundEnabled) {
        await playChatTone();
      }
    });
  }

  bindNotificationAudioUnlockListeners();
  updateSoundToggle();
  let hasJoinedCurrentChatSession = false;
  let lastDisconnectAt = 0;

  window.addEventListener("app:server-instance-reload", reloadChatAfterServerRestart);

  socket.on("connect", () => {
    window.__chatImmediateLeave?.setSocketId(socket.id || "");
    window.__chatImmediateLeave?.setServerRestartReloadInProgress(false);
    const isRecoveredServerRestart =
      pendingChatReloadRecovery?.reason === "server-instance-reload";
    const isRecoveredPageReload =
      pendingChatReloadRecovery?.reason === "page-reload";
    const joinReloadReason = isRecoveredServerRestart
      ? "server-instance-reload"
      : isRecoveredPageReload
      ? "page-reload"
      : "";
    socket.emit("chat:join", {
      roomId: hasRoom ? roomId : null,
      serverId,
      standardRoomId: hasRoom ? null : (standardRoomId || null),
      characterId:
        Number.isInteger(currentActiveCharacterId) && currentActiveCharacterId > 0
          ? currentActiveCharacterId
          : null,
      isReconnect: hasJoinedCurrentChatSession || isRecoveredServerRestart || isRecoveredPageReload,
      reloadReason: joinReloadReason,
      suppressEnterPresence: isRecoveredServerRestart,
      reconnectAgeMs:
        (isRecoveredServerRestart || isRecoveredPageReload)
          ? 0
          : hasJoinedCurrentChatSession && lastDisconnectAt > 0
          ? Math.max(0, Date.now() - lastDisconnectAt)
          : null
    });
    const storedAfkState = getStoredAfkState();
    if (storedAfkState && (storedAfkState.mode !== "auto" || autoAfkEnabled)) {
      isCurrentChannelAfk = true;
      currentAfkMode = storedAfkState.mode;
      clearAfkTimer();
      socket.emit("chat:afk:set", {
        reason: storedAfkState.reason,
        mode: storedAfkState.mode,
        silent: true
      });
    } else if (storedAfkState?.mode === "auto") {
      clearStoredAfkState();
    }
    hasJoinedCurrentChatSession = true;
    lastDisconnectAt = 0;
    pendingChatReloadRecovery = null;
    if (!storedAfkState || (storedAfkState.mode === "auto" && !autoAfkEnabled)) {
      scheduleAfkTimer();
    }
  });

  socket.on("disconnect", () => {
    window.__chatImmediateLeave?.setSocketId("");
    lastDisconnectAt = Date.now();
    clearAfkTimer();
  });

  function appendFormattedChatNodes(
    container,
    text,
    { allowItalic = true, allowBold = true } = {}
  ) {
    const source = String(text || "");
    let cursor = 0;
    let plainBuffer = "";

    function flushPlainBuffer() {
      if (!plainBuffer) return;
      container.appendChild(document.createTextNode(plainBuffer));
      plainBuffer = "";
    }

    while (cursor < source.length) {
      const currentChar = source[cursor];

      if (allowItalic && currentChar === "*") {
        const closingIndex = source.indexOf("*", cursor + 1);
        const italicEndIndex = closingIndex > cursor + 1 ? closingIndex : source.length;
        if (italicEndIndex > cursor + 1) {
          flushPlainBuffer();
          const italic = document.createElement("em");
          appendFormattedChatNodes(italic, source.slice(cursor + 1, italicEndIndex), {
            allowItalic: false,
            allowBold: true
          });
          container.appendChild(italic);
          cursor = closingIndex > cursor + 1 ? closingIndex + 1 : source.length;
          continue;
        }
      }

      if (allowBold && currentChar === "#") {
        let contentStart = cursor + 1;
        while (source[contentStart] === "#") {
          contentStart += 1;
        }

        const closingIndex = source.indexOf("#", contentStart);
        const hasClosingDelimiter = closingIndex > contentStart;
        const contentBoundary = hasClosingDelimiter ? closingIndex : source.length;
        if (contentBoundary > contentStart) {
          let contentEnd = contentBoundary;
          if (hasClosingDelimiter) {
            while (contentEnd > contentStart && source[contentEnd - 1] === "#") {
              contentEnd -= 1;
            }
          }

          if (contentEnd > contentStart) {
            const nextCursor = hasClosingDelimiter
              ? (() => {
                  let nextIndex = closingIndex + 1;
                  while (source[nextIndex] === "#") {
                    nextIndex += 1;
                  }
                  return nextIndex;
                })()
              : source.length;

            flushPlainBuffer();
            const strong = document.createElement("strong");
            appendFormattedChatNodes(strong, source.slice(contentStart, contentEnd), {
              allowItalic: true,
              allowBold: false
            });
            container.appendChild(strong);
            cursor = nextCursor;
            continue;
          }
        }
      }

      plainBuffer += currentChar;
      cursor += 1;
    }

    flushPlainBuffer();
  }

  function appendFormattedChatText(container, rawText, { leadingSpace = false } = {}) {
    if (leadingSpace) {
      container.appendChild(document.createTextNode(" "));
    }

    appendFormattedChatNodes(container, rawText, {
      allowItalic: true,
      allowBold: true
    });
  }

  function createStyledChatNameNode(rawName, roleStyle = "", rawColor = "") {
    const strong = document.createElement("strong");
    const normalizedRoleStyle = String(roleStyle || "").trim().toLowerCase();
    const displayName = formatRoleDisplayName(rawName, normalizedRoleStyle);
    strong.textContent = displayName;
    if (normalizedRoleStyle === "admin" || normalizedRoleStyle === "moderator") {
      strong.classList.add(`role-name-${normalizedRoleStyle}`);
    }
    applySpecialNameDecor(strong, displayName);
    setChatColorSource(strong, rawColor);
    applyStoredChatTextColor(strong, rawColor);
    return strong;
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getEmoteActionText(rawText, displayName) {
    const text = String(rawText || "").trim();
    if (!text.toLowerCase().startsWith("/me ")) {
      return "";
    }

    let actionText = text.slice(4).trim();
    const actorName = String(displayName || "").trim();

    if (actorName) {
      const actorPattern = new RegExp(`^${escapeRegExp(actorName)}(?:(?=\\s)|(?=[,.:;!?]))\\s*`, "i");
      actionText = actionText.replace(actorPattern, "").trimStart();
    }

    return actionText;
  }

  function getMessageTimeLabel(msg) {
    const rawValue = String(msg?.message_time_iso || msg?.created_at || "").trim();
    if (!rawValue) return "";

    const parsedDate = new Date(rawValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(parsedDate);
    } catch (_error) {
      return `${String(parsedDate.getHours()).padStart(2, "0")}:${String(parsedDate.getMinutes()).padStart(2, "0")}`;
    }
  }

  function appendMessage(msg, options = {}) {
    const isSystemMessage = String(msg?.type || "").trim().toLowerCase() === "system";
    if (!isSystemMessage && isIgnoredSocialEntry(msg)) {
      return;
    }

    rememberRenderedChatMessage(msg);
    const article = document.createElement("article");
    const emoteActionText = !isSystemMessage
      ? getEmoteActionText(msg?.content, msg?.username)
      : "";
    article.className = `chat-message${isSystemMessage ? " chat-system" : emoteActionText ? " chat-emote" : ""}`;

    const line = document.createElement("p");
    const body = document.createElement("span");
    const chatTextColor = normalizeChatTextColor(msg?.chat_text_color);
    const systemKind = String(msg?.system_kind || "").trim().toLowerCase();
    const isActorSystemMessage = systemKind === "presence" || systemKind === "actor-message";
    const messageTimeColor = isSystemMessage
      ? (
          isActorSystemMessage
            ? normalizeChatTextColor(msg?.presence_actor_chat_text_color || msg?.chat_text_color)
            : ""
        )
      : chatTextColor;
    const shouldShowMessageTime = showChatMessageTimestamps
      && (!isSystemMessage || isActorSystemMessage);
    const messageTimeLabel = shouldShowMessageTime
      ? getMessageTimeLabel(msg)
      : "";
    if (messageTimeLabel) {
      const timePrefix = document.createElement("span");
      timePrefix.className = "chat-own-message-time";
      timePrefix.dataset.chatTimeSourceColor = messageTimeColor || "";
      timePrefix.textContent = `[${messageTimeLabel}] `;
      applyStoredChatTextColor(timePrefix, messageTimeColor, { allowGradient: false });
      line.appendChild(timePrefix);
    }
    if (isSystemMessage) {
      const content = String(msg?.content || "");
      const presenceKind = String(msg?.presence_kind || "").trim().toLowerCase();
      const presenceActorName = String(msg?.presence_actor_name || "").trim();
      const presenceActorRoleStyle = String(msg?.presence_actor_role_style || "").trim().toLowerCase();
      const presenceActorChatTextColor = normalizeChatTextColor(msg?.presence_actor_chat_text_color);
      const actorTargetName = String(msg?.actor_target_name || "").trim();
      const actorTargetRoleStyle = String(msg?.actor_target_role_style || "").trim().toLowerCase();
      const actorTargetChatTextColor = normalizeChatTextColor(msg?.actor_target_chat_text_color);
      const actorTargetPrefix = String(msg?.actor_target_prefix || "");
      const actorTargetSuffix = String(msg?.actor_target_suffix || "");
      const presenceSuffix = String(msg?.presence_suffix || "").trim();
      const roomSwitchTargetName = String(msg?.room_switch_target_name || "").trim();
      if (systemKind === "presence" && presenceActorName && presenceSuffix) {
        const strong = createStyledChatNameNode(
          presenceActorName,
          presenceActorRoleStyle,
          presenceActorChatTextColor
        );
        body.textContent = ` ${presenceSuffix}`;
        line.appendChild(strong);
        if (
          presenceKind === "enter" &&
          options?.skipNotifications !== true
        ) {
          playEntryTone();
        }
      } else if (systemKind === "dice-roll" && presenceActorName && content) {
        const strong = createStyledChatNameNode(
          presenceActorName,
          presenceActorRoleStyle,
          presenceActorChatTextColor
        );
        body.textContent = ` ${content}`;
        line.appendChild(strong);
      } else if (systemKind === "room-switch" && presenceActorName && roomSwitchTargetName) {
        const strong = createStyledChatNameNode(
          presenceActorName,
          presenceActorRoleStyle,
          presenceActorChatTextColor
        );
        body.textContent = ` hat in den Raum ${roomSwitchTargetName} gewechselt.`;
        line.appendChild(strong);
      } else if (systemKind === "actor-message" && presenceActorName && content) {
        const strong = createStyledChatNameNode(
          presenceActorName,
          presenceActorRoleStyle,
          presenceActorChatTextColor
        );
        line.appendChild(strong);
        if (actorTargetName && (actorTargetPrefix || actorTargetSuffix)) {
          appendFormattedChatText(body, actorTargetPrefix, { leadingSpace: true });
          body.appendChild(
            createStyledChatNameNode(
              actorTargetName,
              actorTargetRoleStyle,
              actorTargetChatTextColor
            )
          );
          appendFormattedChatText(body, actorTargetSuffix);
        } else {
          appendFormattedChatText(body, content, { leadingSpace: true });
        }
      } else {
        body.textContent = content;
      }
      const systemBodyColor = systemKind === "actor-message"
        ? (presenceActorChatTextColor || "#000000")
        : "#000000";
      setChatColorSource(body, systemBodyColor);
      applyStoredChatTextColor(body, systemBodyColor, { allowGradient: false });
    } else if (emoteActionText) {
      const emote = document.createElement("em");
      const actor = document.createElement("span");
      const roleStyle = String(msg?.role_style || "").trim().toLowerCase();
      const displayName = formatRoleDisplayName(msg?.username, roleStyle);
      if (roleStyle === "admin" || roleStyle === "moderator") {
        actor.classList.add(`role-name-${roleStyle}`);
      }
      actor.textContent = displayName || "Unbekannt";
      applySpecialNameDecor(actor, displayName);
      setChatColorSource(actor, chatTextColor);
      setChatColorSource(emote, chatTextColor);
      applyStoredChatTextColor(actor, chatTextColor);
      applyStoredChatTextColor(emote, chatTextColor, { allowGradient: false });
      emote.appendChild(actor);
      if (emoteActionText) {
        emote.appendChild(document.createTextNode(" "));
        appendFormattedChatNodes(emote, emoteActionText, {
          allowItalic: false,
          allowBold: true
        });
      }
      line.appendChild(emote);
    } else {
      const strong = document.createElement("strong");
      const roleStyle = String(msg?.role_style || "").trim().toLowerCase();
      const displayName = formatRoleDisplayName(msg?.username, roleStyle);
      if (roleStyle === "admin" || roleStyle === "moderator") {
        strong.classList.add(`role-name-${roleStyle}`);
      }
      strong.textContent = `${displayName}:`;
      applySpecialNameDecor(strong, displayName);
      setChatColorSource(strong, chatTextColor);
      setChatColorSource(body, chatTextColor);
      applyStoredChatTextColor(strong, chatTextColor);
      applyStoredChatTextColor(body, chatTextColor, { allowGradient: false });
      line.appendChild(strong);
      appendFormattedChatText(body, msg.content, { leadingSpace: true });
    }
    line.appendChild(body);

    article.appendChild(line);
    chatFeed.appendChild(article);

    if (
      !isSystemMessage &&
      Number(msg?.user_id) > 0 &&
      Number(msg.user_id) !== currentUserId &&
      options?.skipNotifications !== true
    ) {
      markUnreadChatTab();
      playChatTone();
    }

    while (chatFeed.children.length > chatMessageRestoreLimit) {
      chatFeed.removeChild(chatFeed.firstChild);
    }

    scrollChatToBottom();
  }

  if (pendingChatReloadRecovery?.messages?.length) {
    pendingChatReloadRecovery.messages.forEach((message) => {
      appendMessage(message, { skipNotifications: true });
    });
    if (pendingChatReloadRecovery.scrollTop != null) {
      chatScroll.scrollTop = pendingChatReloadRecovery.scrollTop;
    }
  }

  function updateRoomLockState(payload) {
    if (!hasRoom || !chatRoomTitle) return;
    if (Number(payload?.roomId) !== roomId) return;

    const isLocked = Boolean(payload?.isLocked);
    let lockNode = chatRoomTitle.querySelector(".chat-room-lock");

    if (isLocked) {
        if (!lockNode) {
          lockNode = document.createElement("span");
          lockNode.className = "chat-room-lock";
          lockNode.setAttribute("aria-hidden", "true");
          lockNode.innerHTML = roomLockIconMarkup;
          chatRoomTitle.prepend(lockNode);
        }
      } else if (lockNode) {
        lockNode.remove();
      }

    if (typeof payload?.roomName === "string") {
      const roomNameText = String(payload.roomName || "").trim();
      let titleTextNode = chatRoomTitle.querySelector(".chat-room-title-text");

      if (!titleTextNode) {
        Array.from(chatRoomTitle.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .forEach((node) => node.remove());

        titleTextNode = document.createElement("span");
        titleTextNode.className = "chat-room-title-text";
        chatRoomTitle.append(titleTextNode);
      }

      titleTextNode.textContent = roomNameText;
    }

    updateChatTabTitle();

    if (!chatRoomHeading || !chatRoomDivider || !Object.prototype.hasOwnProperty.call(payload || {}, "roomDescription")) {
      return;
    }

    const nextRoomDescription = String(payload?.roomDescription || "").trim();
    if (nextRoomDescription) {
      if (!chatRoomDescription) {
        chatRoomDescription = document.createElement("p");
        chatRoomDescription.className = "chat-room-description";
        chatRoomHeading.insertBefore(chatRoomDescription, chatRoomDivider);
      }
      chatRoomDescription.textContent = nextRoomDescription;
      return;
    }

    if (chatRoomDescription) {
      chatRoomDescription.remove();
      chatRoomDescription = null;
    }
  }

  function getWhisperPartnerUserId(msg) {
    const fromUserId = Number(msg?.from_user_id);
    const toUserId = Number(msg?.to_user_id);

    if (Boolean(msg?.outgoing)) {
      return Number.isInteger(toUserId) && toUserId > 0 ? toUserId : null;
    }

    if (Number.isInteger(fromUserId) && fromUserId > 0 && fromUserId !== currentUserId) {
      return fromUserId;
    }

    if (Number.isInteger(toUserId) && toUserId > 0 && toUserId !== currentUserId) {
      return toUserId;
    }

    return null;
  }

  function getWhisperPartnerCharacterId(msg) {
    const fromCharacterId = normalizePositiveNumber(msg?.from_character_id);
    const toCharacterId = normalizePositiveNumber(msg?.to_character_id);

    if (Boolean(msg?.outgoing)) {
      return toCharacterId;
    }

    if (fromCharacterId && fromCharacterId !== currentActiveCharacterId) {
      return fromCharacterId;
    }

    if (toCharacterId && toCharacterId !== currentActiveCharacterId) {
      return toCharacterId;
    }

    return null;
  }

  function getWhisperThreadKey(characterId, userId) {
    const parsedCharacterId = normalizePositiveNumber(characterId);
    if (parsedCharacterId) {
      return `character:${parsedCharacterId}`;
    }

    const parsedUserId = normalizePositiveNumber(userId);
    return parsedUserId ? `user:${parsedUserId}` : "";
  }

  function getWhisperThreadKeyFromEntry(entry) {
    return getWhisperThreadKey(
      entry?.characterId ?? entry?.character_id,
      entry?.userId ?? entry?.user_id
    );
  }

  function getWhisperPartnerThreadKey(msg) {
    return getWhisperThreadKey(
      getWhisperPartnerCharacterId(msg),
      getWhisperPartnerUserId(msg)
    );
  }

  function getOnlineEntryByUserId(userId) {
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
      return null;
    }

    for (const entry of onlineEntriesByUserId.values()) {
      if (Number(entry?.userId) === parsedUserId) {
        return entry;
      }
    }

    return null;
  }

  function getOnlineEntryByThreadKey(threadKey) {
    const normalizedThreadKey = String(threadKey || "").trim();
    if (!normalizedThreadKey) {
      return null;
    }

    for (const entry of onlineEntriesByUserId.values()) {
      if (getWhisperThreadKeyFromEntry(entry) === normalizedThreadKey) {
        return entry;
      }
    }

    return null;
  }

  function getWhisperPartnerName(
    msg,
    partnerUserId = getWhisperPartnerUserId(msg),
    partnerThreadKey = getWhisperPartnerThreadKey(msg)
  ) {
    const explicitName = Boolean(msg?.outgoing) ? msg?.to_name : msg?.from_name;
    const rememberedName = whisperThreadsByKey.get(partnerThreadKey)?.name;
    const onlineName =
      getOnlineEntryByThreadKey(partnerThreadKey)?.name ||
      getOnlineEntryByUserId(partnerUserId)?.name;
    const resolvedName = String(explicitName || rememberedName || onlineName || "").trim();
    return resolvedName || "Unbekannt";
  }

  function ensureWhisperThread(threadKey, { userId = null, characterId = null, name = "" } = {}) {
    const normalizedThreadKey = String(threadKey || "").trim();
    if (!normalizedThreadKey) {
      return null;
    }

    const parsedUserId = normalizePositiveNumber(userId);
    const parsedCharacterId = normalizePositiveNumber(characterId);
    const existing = whisperThreadsByKey.get(normalizedThreadKey);
    if (existing) {
      if (parsedUserId) {
        existing.userId = parsedUserId;
      }
      existing.characterId = parsedCharacterId;
      if (String(name || "").trim()) {
        existing.name = String(name).trim();
      }
      return existing;
    }

    const created = {
      threadKey: normalizedThreadKey,
      userId: parsedUserId,
      characterId: parsedCharacterId,
      name: String(name || "").trim() || "Unbekannt",
      messages: [],
      lastSequence: 0
    };
    whisperThreadsByKey.set(normalizedThreadKey, created);
    return created;
  }

  function isWhisperPanelOpen() {
    return Boolean(whisperPanel && !whisperPanel.hidden);
  }

  function updateWhisperToggleState() {
    if (!whisperToggle) return;
    const isOpen = isWhisperPanelOpen();
    whisperToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    whisperToggle.title = isOpen ? "Flüsterverlauf schließen" : "Flüsterverlauf";
    whisperToggle.setAttribute("aria-label", isOpen ? "Flüsterverlauf schließen" : "Flüsterverlauf öffnen");
  }

  function updateWhisperToggleBadge() {
    if (!whisperToggleBadge) return;
    const unreadCount = whisperUnreadThreadKeys.size;
    whisperToggleBadge.hidden = unreadCount < 1;
    whisperToggleBadge.textContent = String(unreadCount);
  }

  function sortWhisperThreads() {
    return Array.from(whisperThreadsByKey.values())
      .filter((thread) => !isIgnoredWhisperTarget(thread?.userId, thread?.characterId))
      .sort((left, right) => {
      const rightSequence = Number(right?.lastSequence || 0);
      const leftSequence = Number(left?.lastSequence || 0);
      if (rightSequence !== leftSequence) {
        return rightSequence - leftSequence;
      }
      return String(left?.name || "").localeCompare(String(right?.name || ""), "de", {
        sensitivity: "base"
      });
      });
  }

  function scrollWhisperThreadToBottom() {
    if (!whisperThread) return;
    whisperThread.scrollTop = whisperThread.scrollHeight;
  }

  function renderWhisperThreadList() {
    if (!whisperList || !whisperListEmpty) return;

    const threads = sortWhisperThreads();
    whisperList.innerHTML = "";

    if (!threads.length) {
      whisperList.hidden = true;
      whisperListEmpty.hidden = false;
      return;
    }

    whisperList.hidden = false;
    whisperListEmpty.hidden = true;

    threads.forEach((thread) => {
      const button = document.createElement("button");
      const name = document.createElement("strong");
      const preview = document.createElement("span");
      const meta = document.createElement("small");
      const unreadDot = document.createElement("span");
      const lastEntry = thread.messages[thread.messages.length - 1] || null;

      button.type = "button";
      button.className = `chat-whisper-list-item${thread.threadKey === activeWhisperThreadKey ? " is-active" : ""}`;
      name.className = "chat-whisper-list-name";
      name.textContent = thread.name;

      preview.className = "chat-whisper-list-preview";
      preview.textContent = lastEntry
        ? String(lastEntry.content || "").trim().slice(0, 90) || "Neue Nachricht"
        : "Noch keine Nachrichten";

      meta.className = "chat-whisper-list-meta";
      meta.textContent = lastEntry?.created_at ? String(lastEntry.created_at) : "";

      if (whisperUnreadThreadKeys.has(thread.threadKey)) {
        unreadDot.className = "chat-whisper-list-unread";
        unreadDot.setAttribute("aria-hidden", "true");
        button.appendChild(unreadDot);
      }

      button.appendChild(name);
      button.appendChild(preview);
      button.appendChild(meta);
      button.addEventListener("click", () => {
        setActiveWhisperThreadKey(thread.threadKey);
        whisperUnreadThreadKeys.delete(thread.threadKey);
        renderWhisperThreadList();
        renderWhisperThread();
        updateWhisperToggleBadge();
        if (whisperInput) {
          whisperInput.focus();
        }
      });
      whisperList.appendChild(button);
    });
  }

  function renderWhisperThread() {
    if (!whisperThread || !whisperThreadEmpty || !whisperThreadShell || !whisperPlaceholder || !whisperForm || !whisperThreadTitle) {
      return;
    }

    const thread = whisperThreadsByKey.get(String(activeWhisperThreadKey || "").trim());
    whisperThread.innerHTML = "";

    if (!thread || isIgnoredWhisperTarget(thread.userId, thread.characterId)) {
      whisperThreadShell.hidden = true;
      whisperPlaceholder.hidden = false;
      whisperForm.hidden = true;
      if (whisperTargetUserIdInput) whisperTargetUserIdInput.value = "";
      if (whisperInput) whisperInput.value = "";
      return;
    }

    whisperThreadShell.hidden = false;
    whisperPlaceholder.hidden = true;
    whisperForm.hidden = false;
    whisperThreadTitle.textContent = `Flüstern mit ${thread.name}`;
    if (whisperTargetUserIdInput) {
      whisperTargetUserIdInput.value = String(thread.userId);
    }

    if (!thread.messages.length) {
      whisperThread.hidden = true;
      whisperThreadEmpty.hidden = false;
      return;
    }

    whisperThread.hidden = false;
    whisperThreadEmpty.hidden = true;

    thread.messages.forEach((entry) => {
      const article = document.createElement("article");
      article.className = `whisper-thread-message ${entry.outgoing ? "is-outgoing" : "is-incoming"}`;

      const meta = document.createElement("div");
      meta.className = "whisper-thread-meta";
      meta.textContent = entry.outgoing
        ? `An ${thread.name}`
        : `Von ${thread.name}`;

      const body = document.createElement("div");
      body.className = "whisper-thread-body";
      appendFormattedChatNodes(body, entry.content, {
        allowItalic: true,
        allowBold: true
      });
      const afkNoteText = entry.outgoing
        ? getWhisperAfkNoteText(
            entry.whisper_target_afk_name || thread.name,
            entry.whisper_target_is_afk,
            entry.whisper_target_afk_reason
          )
        : "";

      article.appendChild(meta);
      article.appendChild(body);

      if (afkNoteText) {
        const note = document.createElement("small");
        note.className = "whisper-thread-note";
        note.textContent = afkNoteText;
        article.appendChild(note);
      }

      if (entry.created_at) {
        const time = document.createElement("small");
        time.className = "whisper-thread-time";
        time.textContent = String(entry.created_at);
        article.appendChild(time);
      }

      whisperThread.appendChild(article);
    });

    scrollWhisperThreadToBottom();
  }

  function rememberWhisperMessage(msg) {
    const partnerUserId = getWhisperPartnerUserId(msg);
    const partnerCharacterId = getWhisperPartnerCharacterId(msg);
    const partnerThreadKey = getWhisperPartnerThreadKey(msg);
    if (!partnerThreadKey || !Number.isInteger(partnerUserId) || partnerUserId < 1) {
      return null;
    }

    const partnerName = getWhisperPartnerName(msg, partnerUserId, partnerThreadKey);
    const thread = ensureWhisperThread(partnerThreadKey, {
      userId: partnerUserId,
      characterId: partnerCharacterId,
      name: partnerName
    });
    if (!thread) {
      return null;
    }

    thread.name = partnerName;
    thread.messages.push({
      outgoing: Boolean(msg?.outgoing),
      content: String(msg?.content || ""),
      created_at: String(msg?.created_at || "").trim(),
      from_name: String(msg?.from_name || "").trim(),
      to_name: String(msg?.to_name || "").trim(),
      whisper_target_is_afk: Boolean(msg?.whisper_target_is_afk),
      whisper_target_afk_reason: String(msg?.whisper_target_afk_reason || "").trim(),
      whisper_target_afk_name: String(msg?.whisper_target_afk_name || "").trim()
    });
    thread.lastSequence = ++whisperSequence;

    while (thread.messages.length > 80) {
      thread.messages.shift();
    }

    return thread;
  }

  function getWhisperAfkNoteText(targetName, isAfk, reason) {
    const normalizedReason = String(reason || "").trim();
    if (!isAfk && !normalizedReason) {
      return "";
    }
    const normalizedName = String(targetName || "").trim() || "Dieser Charakter";
    return normalizedReason
      ? `${normalizedName} ist afk (${normalizedReason}).`
      : `${normalizedName} ist afk.`;
  }

  function appendWhisper(msg) {
    const article = document.createElement("article");
    article.className = `chat-message chat-whisper ${msg?.outgoing ? "is-outgoing" : "is-incoming"}`;

    const line = document.createElement("p");
    const strong = document.createElement("strong");
    const body = document.createElement("span");
    strong.textContent = msg?.outgoing
      ? `Flüstern an ${msg?.to_name || "Unbekannt"}:`
      : `Flüstern von ${msg?.from_name || "Unbekannt"}:`;
    line.appendChild(strong);
    appendFormattedChatText(body, msg?.content, { leadingSpace: true });
    line.appendChild(body);
    const afkNoteText = msg?.outgoing
      ? getWhisperAfkNoteText(
          msg?.whisper_target_afk_name || msg?.to_name,
          msg?.whisper_target_is_afk,
          msg?.whisper_target_afk_reason
        )
      : "";

    article.appendChild(line);
    if (afkNoteText) {
      const note = document.createElement("small");
      note.className = "chat-whisper-note";
      note.textContent = afkNoteText;
      article.appendChild(note);
    }
    chatFeed.appendChild(article);

    while (chatFeed.children.length > 150) {
      chatFeed.removeChild(chatFeed.firstChild);
    }

    scrollChatToBottom();
  }

  function closeOnlineMenu() {
    if (!onlineActionsMenu) return;
    onlineActionsMenu.hidden = true;
    selectedOnlineEntry = null;
  }

  function openWhisperPanel({ focusInput = false } = {}) {
    if (!whisperPanel) return;
    if (!activeWhisperThreadKey) {
      const firstThread = sortWhisperThreads()[0];
      if (firstThread) {
        setActiveWhisperThreadKey(firstThread.threadKey);
      }
    }
    whisperUnreadThreadKeys.clear();
    whisperPanel.hidden = false;
    updateWhisperToggleState();
    renderWhisperThreadList();
    renderWhisperThread();
    updateWhisperToggleBadge();
    if (focusInput && !whisperForm?.hidden && whisperInput) {
      whisperInput.focus();
    }
  }

  function closeWhisperPanel() {
    if (!whisperPanel) return;
    whisperPanel.hidden = true;
    updateWhisperToggleState();
  }

  function toggleWhisperPanel() {
    if (!whisperPanel) return;
    if (isWhisperPanelOpen()) {
      closeWhisperPanel();
    } else {
      openWhisperPanel();
    }
  }

  function activateWhisperThread(entry, { focusInput = false, openPanel = false } = {}) {
    const userId = Number(entry?.userId);
    const characterId = normalizePositiveNumber(entry?.characterId ?? entry?.character_id);
    const threadKey = getWhisperThreadKeyFromEntry(entry);
    if (!threadKey || !Number.isInteger(userId) || userId < 1) return;

    const name = String(
      entry?.name ||
      getOnlineEntryByThreadKey(threadKey)?.name ||
      getOnlineEntryByUserId(userId)?.name ||
      whisperThreadsByKey.get(threadKey)?.name ||
      "Unbekannt"
    ).trim() || "Unbekannt";
    ensureWhisperThread(threadKey, {
      userId,
      characterId,
      name
    });
    setActiveWhisperThreadKey(threadKey);
    whisperUnreadThreadKeys.delete(threadKey);
    renderWhisperThreadList();
    renderWhisperThread();
    updateWhisperToggleBadge();

    if (openPanel) {
      openWhisperPanel({ focusInput });
    } else if (focusInput && isWhisperPanelOpen() && !whisperForm?.hidden && whisperInput) {
      whisperInput.focus();
    }
  }

  function syncRoomInviteModal() {
    if (!roomInviteModal || !roomInviteMessage || !roomInviteDescription) return;

    if (!activeRoomInvite && pendingRoomInvites.length) {
      activeRoomInvite = pendingRoomInvites.shift();
    }

    if (!activeRoomInvite) {
      roomInviteModal.hidden = true;
      roomInviteModal.classList.remove("is-open");
      roomInviteMessage.textContent = "";
      roomInviteDescription.hidden = true;
      roomInviteDescription.textContent = "";
      return;
    }

    roomInviteMessage.textContent =
      `${activeRoomInvite.inviterName || "Jemand"} lädt dich in den Raum ${activeRoomInvite.roomName || "Unbekannt"} ein.`;

    const teaser = String(activeRoomInvite.roomTeaser || "").trim();
    if (teaser) {
      roomInviteDescription.hidden = false;
      roomInviteDescription.textContent = teaser;
    } else {
      roomInviteDescription.hidden = true;
      roomInviteDescription.textContent = "";
    }

    roomInviteModal.hidden = false;
    roomInviteModal.classList.add("is-open");
  }

  function handleRoomInvite(payload) {
    const inviteId = String(payload?.inviteId || "").trim();
    if (!inviteId) {
      return;
    }

    pendingRoomInvites.push({
      inviteId,
      inviterName: String(payload?.inviterName || "").trim() || "Jemand",
      roomName: String(payload?.roomName || "").trim() || "Unbekannt",
      roomTeaser: String(payload?.roomTeaser || "").trim()
    });
    playChatTone();
    syncRoomInviteModal();
  }

  function respondToRoomInvite(accepted) {
    if (!activeRoomInvite) {
      return;
    }

    socket.emit("chat:room-invite-response", {
      inviteId: activeRoomInvite.inviteId,
      accepted: Boolean(accepted)
    });

    activeRoomInvite = null;
    syncRoomInviteModal();
  }

  function applyOnlineMenuState() {
    if (!onlineActionGuestbook || !onlineActionWhisper || !selectedOnlineEntry) return;

    const hasCharacter = Number.isInteger(selectedOnlineEntry.characterId) && selectedOnlineEntry.characterId > 0;
    const hasUser = Number.isInteger(selectedOnlineEntry.userId) && selectedOnlineEntry.userId > 0;
    const isOwnEntry = hasUser && selectedOnlineEntry.userId === currentUserId;
    const hasSocialApi = typeof window.appSocialApi === "object" && window.appSocialApi !== null;
    const canManageOwnCharacterFriend = currentUserIsAdmin && isOwnEntry && hasCharacter;
    const usesCharacterFriend = hasCharacter && (!isOwnEntry || canManageOwnCharacterFriend);
    const isFriend = usesCharacterFriend
      ? isFriendCharacterId(selectedOnlineEntry.characterId)
      : (hasUser && isFriendUserId(selectedOnlineEntry.userId));
    const ignoresCharacter = hasCharacter && isIgnoredCharacterId(selectedOnlineEntry.characterId);
    const ignoresAccount = hasUser && isIgnoredAccountUserId(selectedOnlineEntry.userId);

    if (hasCharacter) {
      onlineActionGuestbook.href = `/characters/${selectedOnlineEntry.characterId}/guestbook`;
      onlineActionGuestbook.classList.remove("is-disabled");
      onlineActionGuestbook.setAttribute("aria-disabled", "false");
      onlineActionGuestbook.tabIndex = 0;
    } else {
      onlineActionGuestbook.href = "#";
      onlineActionGuestbook.classList.add("is-disabled");
      onlineActionGuestbook.setAttribute("aria-disabled", "true");
      onlineActionGuestbook.tabIndex = -1;
    }

    onlineActionWhisper.disabled = !hasUser;
    if (onlineActionFriend) {
      onlineActionFriend.disabled =
        !hasSocialApi || (!usesCharacterFriend && (!hasUser || isOwnEntry));
      onlineActionFriend.textContent = isFriend ? "Freund entfernen" : "Als Freund speichern";
    }
    if (onlineActionIgnoreCharacter) {
      onlineActionIgnoreCharacter.disabled = !hasCharacter || isOwnEntry || !hasSocialApi;
      onlineActionIgnoreCharacter.textContent = ignoresCharacter ? "Charakter wieder anzeigen" : "Charakter ignorieren";
    }
    if (onlineActionIgnoreAccount) {
      onlineActionIgnoreAccount.disabled = !hasUser || isOwnEntry || !hasSocialApi;
      onlineActionIgnoreAccount.textContent = ignoresAccount ? "Account wieder anzeigen" : "Account ignorieren";
    }
  }

  function positionOnlineMenu(triggerEl) {
    if (!onlineActionsMenu || !triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 120;
    const gap = 8;

    const left = Math.min(
      Math.max(gap, rect.left),
      Math.max(gap, window.innerWidth - menuWidth - gap)
    );
    const top = Math.min(
      Math.max(gap, rect.bottom + gap),
      Math.max(gap, window.innerHeight - menuHeight - gap)
    );

    onlineActionsMenu.style.left = `${left}px`;
    onlineActionsMenu.style.top = `${top}px`;
  }

  function openOnlineMenu(triggerEl) {
    if (!onlineActionsMenu) return;

    const userId = Number(triggerEl.dataset.userId);
    const characterId = Number(triggerEl.dataset.characterId);
    const presenceKey = String(triggerEl.dataset.presenceKey || "").trim();
    const name = String(triggerEl.dataset.name || triggerEl.textContent || "").trim() || "Unbekannt";

    selectedOnlineEntry = {
      presenceKey,
      userId: Number.isInteger(userId) && userId > 0 ? userId : null,
      characterId: Number.isInteger(characterId) && characterId > 0 ? characterId : null,
      name,
      isFriend: Number.isInteger(characterId) && characterId > 0
        ? isFriendCharacterId(characterId)
        : isFriendUserId(userId),
      ignoresCharacter: isIgnoredCharacterId(characterId),
      ignoresAccount: isIgnoredAccountUserId(userId)
    };

    applyOnlineMenuState();
    positionOnlineMenu(triggerEl);
    onlineActionsMenu.hidden = false;
  }

  function updateTypingIndicator(node, isTyping) {
    if (!node) return;

    let contentNode = node.querySelector(".chat-online-content");
    if (!contentNode) {
      contentNode = document.createElement("span");
      contentNode.className = "chat-online-content";

      while (node.firstChild) {
        contentNode.appendChild(node.firstChild);
      }

      node.appendChild(contentNode);
    }

    let typingNode = contentNode.querySelector(".chat-online-typing");
    if (!isTyping) {
      if (typingNode) {
        typingNode.remove();
      }
      return;
    }

    if (!typingNode) {
      typingNode = document.createElement("em");
      typingNode.className = "chat-online-typing";
      typingNode.textContent = "tippt...";
      contentNode.appendChild(typingNode);
    }
  }

  function syncTypingIndicatorForUser(userId) {
    const presenceKey = String(userId || "").trim();
    if (!onlineCharList || !presenceKey) return;

    const targetNode = onlineCharList.querySelector(`[data-presence-key="${presenceKey}"]`);
    if (!targetNode) return;

    updateTypingIndicator(targetNode, typingStateByUserId.get(presenceKey) === true);
  }

  function setTypingStateForUser(userId, isTyping) {
    const presenceKey = String(userId || "").trim();
    if (!presenceKey) {
      return;
    }

    if (isTyping) {
      typingStateByUserId.set(presenceKey, true);
    } else {
      typingStateByUserId.delete(presenceKey);
    }

    syncTypingIndicatorForUser(presenceKey);
  }

  function clearAfkTimer() {
    if (afkTimer) {
      window.clearTimeout(afkTimer);
      afkTimer = null;
    }
  }

  function scheduleAfkTimer() {
    clearAfkTimer();
    if (!autoAfkEnabled) {
      return;
    }
    if (isCurrentChannelAfk) {
      return;
    }

    afkTimer = window.setTimeout(() => {
      afkTimer = null;
      socket.emit("chat:afk:set", {
        reason: "",
        mode: "auto"
      });
    }, afkTimeoutMs);
  }

  function registerChatActivity({ typing = false } = {}) {
    if (isCurrentChannelAfk && currentAfkMode === "auto") {
      socket.emit("chat:activity");
      isCurrentChannelAfk = false;
      currentAfkMode = "";
    } else if (typing) {
      scheduleAfkTimer();
      return;
    }

    scheduleAfkTimer();
  }

  function emitTypingState(isTyping) {
    const nextState = Boolean(isTyping);
    if (typingEmitActive === nextState) {
      return;
    }

    typingEmitActive = nextState;
    setTypingStateForUser(currentPresenceKey, nextState);
    socket.emit("chat:typing", { isTyping: nextState });
  }

  function stopTypingIndicator() {
    if (typingStopTimer) {
      window.clearTimeout(typingStopTimer);
      typingStopTimer = null;
    }

    emitTypingState(false);
  }

  function scheduleTypingStop() {
    if (typingStopTimer) {
      window.clearTimeout(typingStopTimer);
    }

    typingStopTimer = window.setTimeout(() => {
      typingStopTimer = null;
      emitTypingState(false);
    }, typingIdleDelayMs);
  }

  function handleTypingInput() {
    const hasContent = Boolean(String(input?.value || "").trim());
    if (!hasContent) {
      stopTypingIndicator();
      return;
    }

    emitTypingState(true);
    scheduleTypingStop();
  }

  function renderOnlineCharacters(entries) {
    if (!onlineCharList) return;

    const list = Array.isArray(entries) ? entries.slice() : [];
    lastRenderedOnlineEntries = list.slice();
    const shouldIncludeTavernInnkeeper =
      String(onlineCharList.dataset.includeTavernInnkeeper || "").trim().toLowerCase() === "true";
    if (shouldIncludeTavernInnkeeper && !list.some((entry) => entry?.is_npc === true)) {
      list.push({
        presence_key: "npc:edric-muehlenbrand",
        user_id: 0,
        name: "Edric Mühlenbrand",
        character_id: null,
        role_style: "",
        chat_text_color: "#c4863a",
        has_room_rights: false,
        is_afk: false,
        is_npc: true
      });
    }
    const visibleEntries = list.filter((entry) => !isIgnoredSocialEntry(entry));
    visibleEntries.sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), "de", {
        sensitivity: "base"
      })
    );
    const presentPresenceKeys = new Set();
    onlineEntriesByUserId.clear();

    onlineCharList.innerHTML = "";

    if (!visibleEntries.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Niemand online.";
      onlineCharList.appendChild(empty);
      return;
    }

    visibleEntries.forEach((entry) => {
      const userId = Number(entry?.user_id);
      const characterId = Number(entry?.character_id);
      const presenceKey = resolvePresenceKey(entry);
      const label = String(entry?.name || "").trim();
      const showBirthdayCake = entry?.show_birthday_cake === true;
      const roleStyle = String(entry?.role_style || "").trim().toLowerCase();
      const chatTextColor = normalizeChatTextColor(entry?.chat_text_color);
      const isAfk = entry?.is_afk === true;
      const isNpc = entry?.is_npc === true;
      const displayName = formatRoleDisplayName(label || "Unbekannt", roleStyle);
      const displayNameWithBirthdayCake = getBirthdayCakeLabel(displayName, showBirthdayCake);
      const node = document.createElement(isNpc ? "div" : "button");
      const contentNode = document.createElement("span");
      const textNode = document.createElement("span");
      const afkClockNode = document.createElement("span");

      if (!isNpc) {
        node.type = "button";
      }
      node.classList.add("chat-online-item");
      if (isNpc) {
        node.classList.add("is-npc");
        node.setAttribute("aria-label", `${displayNameWithBirthdayCake} (Raumfigur)`);
        node.title = "Raumfigur";
      } else {
        node.classList.add("chat-online-trigger");
      }
      contentNode.className = "chat-online-content";
      if (isAfk) {
        contentNode.classList.add("is-afk");
      }
      textNode.classList.add("chat-online-name");
      if (isAfk) {
        textNode.classList.add("is-afk");
      }
      if (roleStyle === "admin" || roleStyle === "moderator") {
        textNode.classList.add(`role-name-${roleStyle}`);
      }
      if (presenceKey) {
        presentPresenceKeys.add(presenceKey);
        if (!isNpc) {
          onlineEntriesByUserId.set(presenceKey, {
            presenceKey,
            userId,
            characterId: Number.isInteger(characterId) && characterId > 0 ? characterId : null,
            name: displayName,
            showBirthdayCake,
            isAfk
          });
        }
      }
      node.dataset.userId = Number.isInteger(userId) && userId > 0 ? String(userId) : "";
      node.dataset.characterId = Number.isInteger(characterId) && characterId > 0 ? String(characterId) : "";
      node.dataset.presenceKey = presenceKey;
      node.dataset.name = displayName;
      node.dataset.showBirthdayCake = showBirthdayCake ? "1" : "0";
      node.dataset.roleStyle = roleStyle;
      node.dataset.chatTextColor = chatTextColor;
      afkClockNode.className = "chat-afk-clock";
      afkClockNode.setAttribute("aria-hidden", "true");
      afkClockNode.textContent = "\u25F7";
      applyChatTextColor(textNode, chatTextColor);
      textNode.textContent = displayNameWithBirthdayCake;
      applySpecialNameDecor(textNode, displayName);
      if (isAfk) {
        contentNode.appendChild(afkClockNode);
      }
      contentNode.appendChild(textNode);
      node.appendChild(contentNode);
      if (presenceKey) {
        updateTypingIndicator(node, typingStateByUserId.get(presenceKey) === true);
      }
      onlineCharList.appendChild(node);
    });

    Array.from(typingStateByUserId.keys()).forEach((presenceKey) => {
      if (!presentPresenceKeys.has(presenceKey)) {
        typingStateByUserId.delete(presenceKey);
      }
    });

    closeOnlineMenu();
  }

  function submitMainChatMessage() {
    const content = input.value.trim();
    if (!content) return;

    stopTypingIndicator();
    registerChatActivity({ typing: true });
    rememberSentChatMessage(content);
    socket.emit("chat:message", content);
    input.value = "";
    resizeChatInput();
    input.focus();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitMainChatMessage();
  });

  input.addEventListener("input", () => {
    resizeChatInput();
    if (chatInputHistoryIndex !== -1) {
      chatInputHistoryIndex = -1;
      chatInputDraftBuffer = "";
    }
    rememberChatDraft(input.value);
    registerChatActivity({ typing: true });
    handleTypingInput();
  });
  input.addEventListener("keydown", (event) => {
    if (handleChatHistoryNavigation(event)) {
      registerChatActivity({ typing: true });
      return;
    }
    registerChatActivity({ typing: true });
    handleTypingInput();
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.isComposing || event.keyCode === 229) {
      return;
    }

    event.preventDefault();
    submitMainChatMessage();
  });
  input.addEventListener("blur", stopTypingIndicator);
  resizeChatInput();
  window.addEventListener("beforeunload", () => {
    window.__chatImmediateLeave?.notifyImmediateChatLeave();
    stopTypingIndicator();
    saveChatReloadSnapshot("page-reload");
    disconnectChatSocketForUnload();
  });
  window.addEventListener("pagehide", () => {
    window.__chatImmediateLeave?.notifyImmediateChatLeave();
    saveChatReloadSnapshot("page-reload");
    disconnectChatSocketForUnload();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      stopTypingIndicator();
      return;
    }

    clearUnreadChatTab();
    scheduleAfkTimer();
  });
  window.addEventListener("focus", clearUnreadChatTab);

  if (onlineCharList) {
    onlineCharList.addEventListener("click", (event) => {
      const trigger = event.target.closest(".chat-online-trigger");
      if (!trigger) return;

      event.preventDefault();
      event.stopPropagation();

      if (
        !onlineActionsMenu?.hidden &&
        selectedOnlineEntry &&
        String(selectedOnlineEntry.presenceKey || "") === String(trigger.dataset.presenceKey || "")
      ) {
        closeOnlineMenu();
        return;
      }

      openOnlineMenu(trigger);
    });
  }

  if (chatRoomListLink) {
    const syncRoomListHref = () => {
      chatRoomListLink.href = buildCurrentChatRoomListUrl();
    };
    chatRoomListLink.addEventListener("click", syncRoomListHref);
    chatRoomListLink.addEventListener("auxclick", syncRoomListHref);
    chatRoomListLink.addEventListener("pointerdown", syncRoomListHref);
  }

  if (chatRpBoardLinks.length) {
    const syncRpBoardHref = () => {
      const nextHref = buildCurrentRpBoardUrl();
      chatRpBoardLinks.forEach((node) => {
        node.href = nextHref;
      });
    };
    syncRpBoardHref();
    chatRpBoardLinks.forEach((node) => {
      node.addEventListener("click", syncRpBoardHref);
      node.addEventListener("auxclick", syncRpBoardHref);
      node.addEventListener("pointerdown", syncRpBoardHref);
    });
  }

  if (onlineActionGuestbook) {
    onlineActionGuestbook.addEventListener("click", (event) => {
      if (onlineActionGuestbook.classList.contains("is-disabled")) {
        event.preventDefault();
      }
      closeOnlineMenu();
    });
  }

  if (onlineActionWhisper) {
    onlineActionWhisper.addEventListener("click", () => {
      if (!selectedOnlineEntry) return;
      activateWhisperThread(selectedOnlineEntry, {
        focusInput: true,
        openPanel: true
      });
      closeOnlineMenu();
    });
  }

  if (onlineActionFriend) {
    onlineActionFriend.addEventListener("click", async () => {
      if (!selectedOnlineEntry || !window.appSocialApi) return;
      try {
        const hasCharacter =
          Number.isInteger(selectedOnlineEntry?.characterId) &&
          selectedOnlineEntry.characterId > 0;
        const isOwnEntry =
          Number.isInteger(selectedOnlineEntry?.userId) &&
          selectedOnlineEntry.userId === currentUserId;
        const canManageOwnCharacterFriend =
          currentUserIsAdmin &&
          hasCharacter &&
          isOwnEntry;
        const usesCharacterFriend = hasCharacter && (!isOwnEntry || canManageOwnCharacterFriend);

        if (usesCharacterFriend) {
          if (isFriendCharacterId(selectedOnlineEntry.characterId)) {
            await window.appSocialApi.removeFriendCharacter(selectedOnlineEntry.characterId);
          } else {
            await window.appSocialApi.addFriendByCharacterId(selectedOnlineEntry.characterId);
          }
        } else if (isFriendUserId(selectedOnlineEntry.userId)) {
          await window.appSocialApi.removeFriend(selectedOnlineEntry.userId);
        } else {
          await window.appSocialApi.addFriendByUserId(selectedOnlineEntry.userId);
        }
      } catch (_error) {
        // Ignore panel action errors here. The panel handles user-facing feedback.
      } finally {
        closeOnlineMenu();
      }
    });
  }

  if (onlineActionIgnoreCharacter) {
    onlineActionIgnoreCharacter.addEventListener("click", async () => {
      if (!selectedOnlineEntry || !window.appSocialApi) return;
      try {
        if (isIgnoredCharacterId(selectedOnlineEntry.characterId)) {
          await window.appSocialApi.unignoreCharacter(selectedOnlineEntry.characterId);
        } else {
          await window.appSocialApi.ignoreCharacter(selectedOnlineEntry.characterId);
        }
      } catch (_error) {
        // Ignore panel action errors here. The panel handles user-facing feedback.
      } finally {
        closeOnlineMenu();
      }
    });
  }

  if (onlineActionIgnoreAccount) {
    onlineActionIgnoreAccount.addEventListener("click", async () => {
      if (!selectedOnlineEntry || !window.appSocialApi) return;
      try {
        if (isIgnoredAccountUserId(selectedOnlineEntry.userId)) {
          await window.appSocialApi.unignoreAccount(selectedOnlineEntry.userId);
        } else {
          await window.appSocialApi.ignoreAccount(selectedOnlineEntry.userId, selectedOnlineEntry.name);
        }
      } catch (_error) {
        // Ignore panel action errors here. The panel handles user-facing feedback.
      } finally {
        closeOnlineMenu();
      }
    });
  }

  if (whisperToggle) {
    whisperToggle.addEventListener("click", () => {
      toggleWhisperPanel();
    });
  }

  if (whisperPanelCloseBtn) {
    whisperPanelCloseBtn.addEventListener("click", closeWhisperPanel);
  }

  function submitWhisperMessage() {
    const activeThread = whisperThreadsByKey.get(String(activeWhisperThreadKey || "").trim());
    const targetUserId = Number(activeThread?.userId || whisperTargetUserIdInput?.value);
    const targetCharacterId = normalizePositiveNumber(activeThread?.characterId);
    const content = String(whisperInput?.value || "").trim();
    if (!Number.isInteger(targetUserId) || targetUserId < 1 || !content) {
      return false;
    }

    registerChatActivity({ typing: true });
    socket.emit("chat:whisper", {
      targetUserId,
      targetCharacterId,
      content
    });

    whisperInput.value = "";
    activateWhisperThread({
      userId: targetUserId,
      characterId: targetCharacterId,
      name:
        activeThread?.name ||
        getOnlineEntryByThreadKey(getWhisperThreadKey(targetCharacterId, targetUserId))?.name ||
        getOnlineEntryByUserId(targetUserId)?.name ||
        whisperThreadsByKey.get(getWhisperThreadKey(targetCharacterId, targetUserId))?.name ||
        "Unbekannt"
    }, {
      focusInput: true,
      openPanel: false
    });
    return true;
  }

  if (whisperForm) {
    whisperForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitWhisperMessage();
    });
  }

  if (whisperInput) {
    whisperInput.addEventListener("input", () => {
      registerChatActivity({ typing: true });
    });
    whisperInput.addEventListener("keydown", (event) => {
      registerChatActivity({ typing: true });
      if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.isComposing || event.keyCode === 229) {
        return;
      }

      event.preventDefault();
      submitWhisperMessage();
    });
  }

  if (roomInviteAcceptBtn) {
    roomInviteAcceptBtn.addEventListener("click", () => {
      respondToRoomInvite(true);
    });
  }

  if (roomInviteDeclineBtn) {
    roomInviteDeclineBtn.addEventListener("click", () => {
      respondToRoomInvite(false);
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const clickedInsideMenu = onlineActionsMenu && onlineActionsMenu.contains(target);
    const clickedOnTrigger = Boolean(target.closest(".chat-online-trigger"));
    if (!clickedInsideMenu && !clickedOnTrigger) {
      closeOnlineMenu();
    }

    if (!target.closest(".chat-sound-menu")) {
      closeSoundPanel();
    }

    if (!target.closest(".rp-user-menu")) {
      closeChatUserMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeOnlineMenu();
      closeSoundPanel();
      closeChatUserMenus();
      closeWhisperPanel();
    }
  });

  window.addEventListener("app:social-state", (event) => {
    socialState = normalizeSocialState(event?.detail || {});
    renderOnlineCharacters(lastRenderedOnlineEntries.length ? lastRenderedOnlineEntries : captureRenderedOnlineEntriesFromDom());
    renderWhisperThreadList();
    renderWhisperThread();
    applyOnlineMenuState();
  });

  window.addEventListener("app:active-character-change", () => {
    renderOnlineCharacters(lastRenderedOnlineEntries.length ? lastRenderedOnlineEntries : captureRenderedOnlineEntriesFromDom());
    renderWhisperThreadList();
    renderWhisperThread();
    applyOnlineMenuState();
  });

  const chatBrandLink = document.querySelector(".rp-topline .rp-logo");
  if (chatBrandLink instanceof HTMLAnchorElement) {
    chatBrandLink.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = String(chatBrandLink.getAttribute("target") || "").trim().toLowerCase();
      if (target && target !== "_self") {
        return;
      }

      prepareForIntentionalChatLeave();
    });
  }

  const handleChatViewportResize = () => {
    const shouldKeepBottom = isChatNearBottom();
    closeOnlineMenu();
    closeSoundPanel();
    if (shouldKeepBottom) {
      window.requestAnimationFrame(() => {
        scrollChatToBottom();
      });
    }
  };

  window.addEventListener("resize", handleChatViewportResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleChatViewportResize);
  }
  window.addEventListener("scroll", () => {
    closeOnlineMenu();
    closeSoundPanel();
  }, true);

  function handleWhisperMessage(payload) {
    const partnerUserId = getWhisperPartnerUserId(payload);
    const partnerCharacterId = getWhisperPartnerCharacterId(payload);
    const partnerThreadKey = getWhisperPartnerThreadKey(payload);
    if (!payload?.outgoing && isIgnoredWhisperTarget(partnerUserId, partnerCharacterId)) {
      return;
    }

    appendWhisper(payload);

    const thread = rememberWhisperMessage(payload);
    if (!thread) {
      return;
    }

    if (!payload?.outgoing) {
      markUnreadChatTab();
      playChatTone();
    }

    if (!payload?.outgoing && (!isWhisperPanelOpen() || activeWhisperThreadKey !== partnerThreadKey)) {
      whisperUnreadThreadKeys.add(thread.threadKey);
    } else {
      whisperUnreadThreadKeys.delete(thread.threadKey);
    }

    if (!activeWhisperThreadKey && payload?.outgoing) {
      setActiveWhisperThreadKey(thread.threadKey);
    }

    renderWhisperThreadList();
    if (activeWhisperThreadKey === thread.threadKey) {
      renderWhisperThread();
    }
    updateWhisperToggleBadge();
  }

  lastRenderedOnlineEntries = captureRenderedOnlineEntriesFromDom();
  renderOnlineCharacters(lastRenderedOnlineEntries);
  refreshExistingChatTextAppearance();
  updateWhisperToggleState();
  updateWhisperToggleBadge();
  scrollChatToBottom();
})();
