(() => {
  const roomLockIconMarkup = [
    '<svg class="room-lock-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
    '<path class="room-lock-fill" d="M12 3.7a4.45 4.45 0 0 0-4.45 4.45v1.92c0 .18-.06.35-.16.5l-1.31 2a1.08 1.08 0 0 0 .91 1.67h10.02a1.08 1.08 0 0 0 .91-1.67l-1.31-2c-.1-.15-.16-.32-.16-.5V8.15A4.45 4.45 0 0 0 12 3.7Z"/>',
    '<path d="M8.1 10.02V8.35a3.9 3.9 0 1 1 7.8 0v1.67"/>',
    '<rect x="6.35" y="10.02" width="11.3" height="9.28" rx="2.15" ry="2.15"/>',
    '<path d="M12 13.15v2.8"/>',
    '</svg>'
  ].join("");

  const chatBox = document.getElementById("chat-box");
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
  const roomIdRaw = chatBox?.dataset?.roomId || "";
  const serverId = (chatBox?.dataset?.serverId || "free-rp").trim().toLowerCase();
  const currentCharacterName = String(chatBox?.dataset?.currentCharacterName || "").trim();
  let currentDisplayName = String(chatBox?.dataset?.currentDisplayName || currentCharacterName || "").trim();
  const currentUserId = Number(chatBox?.dataset?.currentUserId || "");
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
  const chatInputHistoryKey = [
    "chat-input-history",
    Number.isInteger(currentUserId) && currentUserId > 0 ? currentUserId : "guest",
    serverId,
    hasRoom ? `room-${roomId}` : "room-none"
  ].join(":");
  const chatInputDraftKey = [
    "chat-input-draft",
    Number.isInteger(currentUserId) && currentUserId > 0 ? currentUserId : "guest",
    serverId,
    hasRoom ? `room-${roomId}` : "room-none"
  ].join(":");
  const chatReloadSnapshotKey = [
    "chat-reload-snapshot",
    Number.isInteger(currentUserId) && currentUserId > 0 ? currentUserId : "guest",
    serverId,
    hasRoom ? `room-${roomId}` : "room-none"
  ].join(":");
  let selectedOnlineEntry = null;
  let typingEmitActive = false;
  let typingStopTimer = null;
  let afkTimer = null;
  let isCurrentChannelAfk = false;
  let currentAfkMode = "";
  const typingStateByUserId = new Map();
  const onlineEntriesByUserId = new Map();
  const whisperThreadsByUserId = new Map();
  const whisperUnreadUserIds = new Set();
  const pendingRoomInvites = [];
  let activeRoomInvite = null;
  let activeWhisperThreadUserId = null;
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
  if (!chatBox || !form || !input) return;

  function formatRoleDisplayName(rawName, roleStyle = "") {
    const label = String(rawName || "").trim();
    return label.replace(/\s*\(M\)\s*$/i, "").trim();
  }

  function applySpecialNameDecor(node, rawName) {
    if (!node) return;
    const label = String(rawName || node.textContent || "").trim();
    node.classList.toggle("has-noctra-wings", /^noctra(?:\b|\s|\[|\()/i.test(label));
    node.classList.toggle("has-crescentia-moons", /^(?:crescentia|cresentia)(?:\b|\s|\[|\()/i.test(label));
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
      hasRoom ? `room-${roomId}` : "room-none"
    ].join(":");
  }

  function updateCurrentPresenceIdentity(payload) {
    if (!payload || !Object.prototype.hasOwnProperty.call(payload, "character_id")) {
      return;
    }

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

    if (previousPresenceKey !== currentPresenceKey) {
      setTypingStateForUser(previousPresenceKey, false);
      removeSessionStorage(previousAfkStateKey);
      isCurrentChannelAfk = false;
      currentAfkMode = "";
      clearStoredAfkState();
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

    const maxHeight = 220;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
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
    return /^#[0-9a-f]{6}$/i.test(value) ? value : "";
  }

  function normalizePositiveNumber(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeSocialState(payload) {
    const friendUserIds = Array.isArray(payload?.friend_user_ids)
      ? payload.friend_user_ids.map((value) => normalizePositiveNumber(value)).filter(Boolean)
      : [];
    const ignoredAccountUserIds = Array.isArray(payload?.ignored_account_user_ids)
      ? payload.ignored_account_user_ids.map((value) => normalizePositiveNumber(value)).filter(Boolean)
      : [];
    const ignoredCharacterIds = Array.isArray(payload?.ignored_character_ids)
      ? payload.ignored_character_ids.map((value) => normalizePositiveNumber(value)).filter(Boolean)
      : [];

    return {
      friendUserIds: new Set(friendUserIds),
      ignoredAccountUserIds: new Set(ignoredAccountUserIds),
      ignoredCharacterIds: new Set(ignoredCharacterIds)
    };
  }

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
    return Boolean(parsedUserId && socialState.friendUserIds.has(parsedUserId));
  }

  function isIgnoredAccountUserId(userId) {
    const parsedUserId = normalizePositiveNumber(userId);
    return Boolean(parsedUserId && socialState.ignoredAccountUserIds.has(parsedUserId));
  }

  function isIgnoredCharacterId(characterId) {
    const parsedCharacterId = normalizePositiveNumber(characterId);
    return Boolean(parsedCharacterId && socialState.ignoredCharacterIds.has(parsedCharacterId));
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
      role_style: String(node.dataset.roleStyle || "").trim(),
      chat_text_color: String(node.dataset.chatTextColor || "").trim(),
      is_afk: node.querySelector(".chat-afk-clock") != null,
      is_npc: node.classList.contains("is-npc")
    }));
  }

  function applyChatTextColor(node, rawColor) {
    if (!node) return;
    node.style.color = normalizeChatTextColor(rawColor);
  }

  function updateHeaderIdentity(payload) {
    updateCurrentPresenceIdentity(payload);
    applyAfkPreferences(payload);
    if (!headerIdentity) return;
    const nextName = String(payload?.name || "").trim();
    const nextColor = normalizeChatTextColor(payload?.chat_text_color);
    if (!nextName) return;

    currentDisplayName = nextName;
    headerIdentity.textContent = nextName;
    headerIdentity.title = nextName;
    headerIdentity.style.color = nextColor;
    if (chatBox) {
      chatBox.dataset.currentDisplayName = nextName;
    }
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
    writeSessionStorage(
      chatReloadSnapshotKey,
      JSON.stringify({
        reason: String(reason || "").trim() || "page-reload",
        disconnectAt: lastDisconnectAt > 0 ? lastDisconnectAt : Date.now(),
        scrollTop: chatBox.scrollTop,
        messages: renderedChatMessages.slice(-chatMessageRestoreLimit)
      })
    );
  }

  function reloadChatAfterServerRestart() {
    if (serverRestartReloadInProgress) {
      return;
    }

    serverRestartReloadInProgress = true;
    saveChatReloadSnapshot("server-instance-reload");
    window.location.reload();
  }

  const socket = io({
    transports: ["websocket"]
  });

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
    if (Number.isFinite(delayMs) && delayMs > 0) {
      window.setTimeout(() => {
        window.location.assign(nextUrl);
      }, delayMs);
      return;
    }
    window.location.assign(nextUrl);
  });
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
  let immediateChatLeaveSent = false;

  window.addEventListener("app:server-instance-reload", reloadChatAfterServerRestart);

  function notifyImmediateChatLeave() {
    if (immediateChatLeaveSent || !socket?.id) {
      return;
    }

    immediateChatLeaveSent = true;
    const payload = new URLSearchParams();
    payload.set("socketId", socket.id);

    if (typeof window.navigator.sendBeacon === "function") {
      try {
        window.navigator.sendBeacon("/chat/disconnect-now", payload);
        return;
      } catch (_error) {
        // Fall back to keepalive fetch below.
      }
    }

    try {
      window.fetch("/chat/disconnect-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: payload.toString(),
        credentials: "same-origin",
        keepalive: true
      }).catch(() => {});
    } catch (_error) {
      // Ignore unload transport failures.
    }
  }

  socket.on("connect", () => {
    immediateChatLeaveSent = false;
    const isRecoveredServerRestart =
      pendingChatReloadRecovery?.reason === "server-instance-reload";
    const isRecoveredPageReload =
      pendingChatReloadRecovery?.reason === "page-reload";
    socket.emit("chat:join", {
      roomId: hasRoom ? roomId : null,
      serverId,
      characterId:
        Number.isInteger(currentActiveCharacterId) && currentActiveCharacterId > 0
          ? currentActiveCharacterId
          : null,
      isReconnect: hasJoinedCurrentChatSession || isRecoveredServerRestart || isRecoveredPageReload,
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
    const shouldShowMessageTime = showChatMessageTimestamps
      && (!isSystemMessage || systemKind === "presence");
    const messageTimeLabel = shouldShowMessageTime
      ? getMessageTimeLabel(msg)
      : "";
    if (messageTimeLabel) {
      const timePrefix = document.createElement("span");
      timePrefix.className = "chat-own-message-time";
      timePrefix.textContent = `[${messageTimeLabel}] `;
      line.appendChild(timePrefix);
    }
    if (isSystemMessage) {
      const content = String(msg?.content || "");
      const presenceKind = String(msg?.presence_kind || "").trim().toLowerCase();
      const presenceActorName = String(msg?.presence_actor_name || "").trim();
      const presenceActorRoleStyle = String(msg?.presence_actor_role_style || "").trim().toLowerCase();
      const presenceActorChatTextColor = normalizeChatTextColor(msg?.presence_actor_chat_text_color);
      const presenceSuffix = String(msg?.presence_suffix || "").trim();
      const roomSwitchTargetName = String(msg?.room_switch_target_name || "").trim();
      if (systemKind === "presence" && presenceActorName && presenceSuffix) {
        const strong = document.createElement("strong");
        const displayActorName = formatRoleDisplayName(presenceActorName, presenceActorRoleStyle);
        strong.textContent = displayActorName;
        if (presenceActorRoleStyle === "admin" || presenceActorRoleStyle === "moderator") {
          strong.classList.add(`role-name-${presenceActorRoleStyle}`);
        }
        applySpecialNameDecor(strong, displayActorName);
        body.textContent = ` ${presenceSuffix}`;
        applyChatTextColor(strong, presenceActorChatTextColor);
        body.style.color = "#000000";
        line.appendChild(strong);
        if (
          presenceKind === "enter" &&
          options?.skipNotifications !== true
        ) {
          playEntryTone();
        }
      } else if (systemKind === "dice-roll" && presenceActorName && content) {
        const strong = document.createElement("strong");
        const displayActorName = formatRoleDisplayName(presenceActorName, presenceActorRoleStyle);
        strong.textContent = displayActorName;
        if (presenceActorRoleStyle === "admin" || presenceActorRoleStyle === "moderator") {
          strong.classList.add(`role-name-${presenceActorRoleStyle}`);
        }
        applySpecialNameDecor(strong, displayActorName);
        body.textContent = ` ${content}`;
        applyChatTextColor(strong, presenceActorChatTextColor);
        body.style.color = "#000000";
        line.appendChild(strong);
      } else if (systemKind === "room-switch" && presenceActorName && roomSwitchTargetName) {
        const strong = document.createElement("strong");
        const displayActorName = formatRoleDisplayName(presenceActorName, presenceActorRoleStyle);
        strong.textContent = displayActorName;
        if (presenceActorRoleStyle === "admin" || presenceActorRoleStyle === "moderator") {
          strong.classList.add(`role-name-${presenceActorRoleStyle}`);
        }
        applySpecialNameDecor(strong, displayActorName);
        applyChatTextColor(strong, presenceActorChatTextColor);
        body.textContent = ` hat in den Raum ${roomSwitchTargetName} gewechselt.`;
        body.style.color = "#000000";
        line.appendChild(strong);
      } else if (systemKind === "actor-message" && presenceActorName && content) {
        const strong = document.createElement("strong");
        const displayActorName = formatRoleDisplayName(presenceActorName, presenceActorRoleStyle);
        strong.textContent = displayActorName;
        if (presenceActorRoleStyle === "admin" || presenceActorRoleStyle === "moderator") {
          strong.classList.add(`role-name-${presenceActorRoleStyle}`);
        }
        applySpecialNameDecor(strong, displayActorName);
        applyChatTextColor(strong, presenceActorChatTextColor);
        body.style.color = "#000000";
        line.appendChild(strong);
        appendFormattedChatText(body, content, { leadingSpace: true });
      } else {
        body.textContent = content;
      }
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
      applyChatTextColor(actor, chatTextColor);
      applyChatTextColor(emote, chatTextColor);
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
      applyChatTextColor(strong, chatTextColor);
      applyChatTextColor(body, chatTextColor);
      line.appendChild(strong);
      appendFormattedChatText(body, msg.content, { leadingSpace: true });
    }
    line.appendChild(body);

    article.appendChild(line);
    chatBox.appendChild(article);

    if (
      !isSystemMessage &&
      Number(msg?.user_id) > 0 &&
      Number(msg.user_id) !== currentUserId &&
      options?.skipNotifications !== true
    ) {
      playChatTone();
    }

    while (chatBox.children.length > chatMessageRestoreLimit) {
      chatBox.removeChild(chatBox.firstChild);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  if (pendingChatReloadRecovery?.messages?.length) {
    pendingChatReloadRecovery.messages.forEach((message) => {
      appendMessage(message, { skipNotifications: true });
    });
    if (pendingChatReloadRecovery.scrollTop != null) {
      chatBox.scrollTop = pendingChatReloadRecovery.scrollTop;
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

  function getWhisperPartnerName(msg, partnerUserId = getWhisperPartnerUserId(msg)) {
    const explicitName = Boolean(msg?.outgoing) ? msg?.to_name : msg?.from_name;
    const rememberedName = whisperThreadsByUserId.get(partnerUserId)?.name;
    const onlineName = getOnlineEntryByUserId(partnerUserId)?.name;
    const resolvedName = String(explicitName || rememberedName || onlineName || "").trim();
    return resolvedName || "Unbekannt";
  }

  function ensureWhisperThread(userId, name = "") {
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
      return null;
    }

    const existing = whisperThreadsByUserId.get(parsedUserId);
    if (existing) {
      if (String(name || "").trim()) {
        existing.name = String(name).trim();
      }
      return existing;
    }

    const created = {
      userId: parsedUserId,
      name: String(name || "").trim() || "Unbekannt",
      messages: [],
      lastSequence: 0
    };
    whisperThreadsByUserId.set(parsedUserId, created);
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
    const unreadCount = whisperUnreadUserIds.size;
    whisperToggleBadge.hidden = unreadCount < 1;
    whisperToggleBadge.textContent = String(unreadCount);
  }

  function sortWhisperThreads() {
    return Array.from(whisperThreadsByUserId.values())
      .filter((thread) => !isIgnoredAccountUserId(thread?.userId))
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
      button.className = `chat-whisper-list-item${thread.userId === activeWhisperThreadUserId ? " is-active" : ""}`;
      name.className = "chat-whisper-list-name";
      name.textContent = thread.name;

      preview.className = "chat-whisper-list-preview";
      preview.textContent = lastEntry
        ? String(lastEntry.content || "").trim().slice(0, 90) || "Neue Nachricht"
        : "Noch keine Nachrichten";

      meta.className = "chat-whisper-list-meta";
      meta.textContent = lastEntry?.created_at ? String(lastEntry.created_at) : "";

      if (whisperUnreadUserIds.has(thread.userId)) {
        unreadDot.className = "chat-whisper-list-unread";
        unreadDot.setAttribute("aria-hidden", "true");
        button.appendChild(unreadDot);
      }

      button.appendChild(name);
      button.appendChild(preview);
      button.appendChild(meta);
      button.addEventListener("click", () => {
        activeWhisperThreadUserId = thread.userId;
        whisperUnreadUserIds.delete(thread.userId);
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

    const thread = whisperThreadsByUserId.get(Number(activeWhisperThreadUserId));
    whisperThread.innerHTML = "";

    if (!thread || isIgnoredAccountUserId(thread.userId)) {
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

      article.appendChild(meta);
      article.appendChild(body);

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
    if (!Number.isInteger(partnerUserId) || partnerUserId < 1) {
      return null;
    }

    const partnerName = getWhisperPartnerName(msg, partnerUserId);
    const thread = ensureWhisperThread(partnerUserId, partnerName);
    if (!thread) {
      return null;
    }

    thread.name = partnerName;
    thread.messages.push({
      outgoing: Boolean(msg?.outgoing),
      content: String(msg?.content || ""),
      created_at: String(msg?.created_at || "").trim(),
      from_name: String(msg?.from_name || "").trim(),
      to_name: String(msg?.to_name || "").trim()
    });
    thread.lastSequence = ++whisperSequence;

    while (thread.messages.length > 80) {
      thread.messages.shift();
    }

    return thread;
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

    article.appendChild(line);
    chatBox.appendChild(article);

    while (chatBox.children.length > 150) {
      chatBox.removeChild(chatBox.firstChild);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function closeOnlineMenu() {
    if (!onlineActionsMenu) return;
    onlineActionsMenu.hidden = true;
    selectedOnlineEntry = null;
  }

  function openWhisperPanel({ focusInput = false } = {}) {
    if (!whisperPanel) return;
    if (!activeWhisperThreadUserId) {
      const firstThread = sortWhisperThreads()[0];
      if (firstThread) {
        activeWhisperThreadUserId = firstThread.userId;
      }
    }
    whisperUnreadUserIds.clear();
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
    if (!Number.isInteger(userId) || userId < 1) return;

    const name = String(
      entry?.name ||
      getOnlineEntryByUserId(userId)?.name ||
      whisperThreadsByUserId.get(userId)?.name ||
      "Unbekannt"
    ).trim() || "Unbekannt";
    ensureWhisperThread(userId, name);
    activeWhisperThreadUserId = userId;
    whisperUnreadUserIds.delete(userId);
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
    const isFriend = hasUser && isFriendUserId(selectedOnlineEntry.userId);
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
      onlineActionFriend.disabled = !hasUser || isOwnEntry || !hasSocialApi;
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
      isFriend: isFriendUserId(userId),
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
      const roleStyle = String(entry?.role_style || "").trim().toLowerCase();
      const chatTextColor = normalizeChatTextColor(entry?.chat_text_color);
      const isAfk = entry?.is_afk === true;
      const isNpc = entry?.is_npc === true;
      const displayName = formatRoleDisplayName(label || "Unbekannt", roleStyle);
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
        node.setAttribute("aria-label", `${displayName} (Raumfigur)`);
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
            isAfk
          });
        }
      }
      node.dataset.userId = Number.isInteger(userId) && userId > 0 ? String(userId) : "";
      node.dataset.characterId = Number.isInteger(characterId) && characterId > 0 ? String(characterId) : "";
      node.dataset.presenceKey = presenceKey;
      node.dataset.name = displayName;
      node.dataset.roleStyle = roleStyle;
      node.dataset.chatTextColor = chatTextColor;
      afkClockNode.className = "chat-afk-clock";
      afkClockNode.setAttribute("aria-hidden", "true");
      afkClockNode.textContent = "\u25F7";
      applyChatTextColor(textNode, chatTextColor);
      textNode.textContent = displayName;
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
    stopTypingIndicator();
    saveChatReloadSnapshot("page-reload");
    notifyImmediateChatLeave();
  });
  window.addEventListener("pagehide", () => {
    saveChatReloadSnapshot("page-reload");
    notifyImmediateChatLeave();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      stopTypingIndicator();
      return;
    }

    scheduleAfkTimer();
  });

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
        if (isFriendUserId(selectedOnlineEntry.userId)) {
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
          await window.appSocialApi.ignoreAccount(selectedOnlineEntry.userId);
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
    const targetUserId = Number(whisperTargetUserIdInput?.value);
    const content = String(whisperInput?.value || "").trim();
    if (!Number.isInteger(targetUserId) || targetUserId < 1 || !content) {
      return false;
    }

    registerChatActivity({ typing: true });
    socket.emit("chat:whisper", {
      targetUserId,
      content
    });

    whisperInput.value = "";
    activateWhisperThread({
      userId: targetUserId,
      name:
        getOnlineEntryByUserId(targetUserId)?.name ||
        whisperThreadsByUserId.get(targetUserId)?.name ||
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
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeOnlineMenu();
      closeSoundPanel();
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

  window.addEventListener("resize", () => {
    closeOnlineMenu();
    closeSoundPanel();
  });
  window.addEventListener("scroll", () => {
    closeOnlineMenu();
    closeSoundPanel();
  }, true);

  function handleWhisperMessage(payload) {
    const partnerUserId = getWhisperPartnerUserId(payload);
    if (!payload?.outgoing && isIgnoredAccountUserId(partnerUserId)) {
      return;
    }

    appendWhisper(payload);

    const thread = rememberWhisperMessage(payload);
    if (!thread) {
      return;
    }

    if (!payload?.outgoing) {
      playChatTone();
    }

    if (!payload?.outgoing && (!isWhisperPanelOpen() || Number(activeWhisperThreadUserId) !== Number(thread.userId))) {
      whisperUnreadUserIds.add(thread.userId);
    } else {
      whisperUnreadUserIds.delete(thread.userId);
    }

    if (!activeWhisperThreadUserId && payload?.outgoing) {
      activeWhisperThreadUserId = thread.userId;
    }

    renderWhisperThreadList();
    if (Number(activeWhisperThreadUserId) === Number(thread.userId)) {
      renderWhisperThread();
    }
    updateWhisperToggleBadge();
  }

  lastRenderedOnlineEntries = captureRenderedOnlineEntriesFromDom();
  renderOnlineCharacters(lastRenderedOnlineEntries);
  updateWhisperToggleState();
  updateWhisperToggleBadge();
  chatBox.scrollTop = chatBox.scrollHeight;
})();
