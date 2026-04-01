(() => {
  const toggleButton = document.querySelector("[data-social-panel-toggle]");
  const panel = document.querySelector("[data-social-panel]");
  if (!toggleButton || !panel) {
    return;
  }

  const closeButton = panel.querySelector("[data-social-panel-close]");
  const friendForm = panel.querySelector("[data-social-friend-form]");
  const friendInput = panel.querySelector("[data-social-friend-input]");
  const feedback = panel.querySelector("[data-social-panel-feedback]");
  const friendsList = panel.querySelector("[data-social-friends-list]");
  const ignoredAccountsList = panel.querySelector("[data-social-ignored-accounts-list]");
  const ignoredCharactersList = panel.querySelector("[data-social-ignored-characters-list]");
  const badge = document.querySelector("[data-social-panel-badge]");
  const canUseRealtime = typeof io === "function";
  const friendOnlineToastDurationMs = 4200;
  let feedbackTimer = 0;
  let socialState = normalizeSocialState(window.__appSocialState || {});
  let hasReceivedInitialState = false;

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeNumber(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeSocialState(payload) {
    const friends = Array.isArray(payload?.friends)
      ? payload.friends
          .map((entry) => ({
            user_id: normalizeNumber(entry?.user_id),
            username: normalizeText(entry?.username),
            account_number: normalizeText(entry?.account_number),
            is_online: entry?.is_online === true,
            online_name: normalizeText(entry?.online_name),
            role_style: normalizeText(entry?.role_style),
            chat_text_color: normalizeText(entry?.chat_text_color),
            server_id: normalizeText(entry?.server_id),
            server_label: normalizeText(entry?.server_label),
            room_id: normalizeNumber(entry?.room_id),
            room_name: normalizeText(entry?.room_name)
          }))
          .filter((entry) => entry.user_id && entry.username)
      : [];
    const ignoredAccounts = Array.isArray(payload?.ignored_accounts)
      ? payload.ignored_accounts
          .map((entry) => ({
            user_id: normalizeNumber(entry?.user_id),
            username: normalizeText(entry?.username),
            account_number: normalizeText(entry?.account_number)
          }))
          .filter((entry) => entry.user_id && entry.username)
      : [];
    const ignoredCharacters = Array.isArray(payload?.ignored_characters)
      ? payload.ignored_characters
          .map((entry) => ({
            character_id: normalizeNumber(entry?.character_id),
            name: normalizeText(entry?.name),
            owner_user_id: normalizeNumber(entry?.owner_user_id),
            owner_username: normalizeText(entry?.owner_username),
            owner_account_number: normalizeText(entry?.owner_account_number)
          }))
          .filter((entry) => entry.character_id && entry.name)
      : [];

    return {
      friends,
      ignored_accounts: ignoredAccounts,
      ignored_characters: ignoredCharacters,
      friend_user_ids: friends.map((entry) => entry.user_id),
      ignored_account_user_ids: ignoredAccounts.map((entry) => entry.user_id),
      ignored_character_ids: ignoredCharacters.map((entry) => entry.character_id)
    };
  }

  function publishSocialState(nextState, { allowNotifications = false } = {}) {
    const previousFriendsByUserId = new Map(
      (socialState.friends || [])
        .filter((entry) => entry && entry.user_id)
        .map((entry) => [entry.user_id, entry])
    );
    const normalizedState = normalizeSocialState(nextState);

    socialState = normalizedState;
    window.__appSocialState = normalizedState;
    window.dispatchEvent(
      new CustomEvent("app:social-state", {
        detail: normalizedState
      })
    );

    if (allowNotifications && hasReceivedInitialState) {
      normalizedState.friends.forEach((friend) => {
        const previousEntry = previousFriendsByUserId.get(friend.user_id);
        if (!friend.is_online || previousEntry?.is_online === true) {
          return;
        }
        if (normalizedState.ignored_account_user_ids.includes(friend.user_id)) {
          return;
        }
        showFriendOnlineToast(friend);
      });
    }

    hasReceivedInitialState = true;
    renderSocialState();
  }

  function setFeedback(message, type = "info") {
    if (!feedback) {
      return;
    }

    const preparedMessage = normalizeText(message);
    if (feedbackTimer) {
      window.clearTimeout(feedbackTimer);
      feedbackTimer = 0;
    }

    if (!preparedMessage) {
      feedback.hidden = true;
      feedback.textContent = "";
      feedback.dataset.state = "";
      return;
    }

    feedback.hidden = false;
    feedback.textContent = preparedMessage;
    feedback.dataset.state = normalizeText(type) || "info";
    feedbackTimer = window.setTimeout(() => {
      feedback.hidden = true;
      feedback.textContent = "";
      feedback.dataset.state = "";
      feedbackTimer = 0;
    }, 3600);
  }

  function buildStatusDot(isOnline) {
    const dot = document.createElement("span");
    dot.className = `social-panel-status-dot${isOnline ? " is-online" : ""}`;
    dot.setAttribute("aria-hidden", "true");
    return dot;
  }

  function buildActionButton(label, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "social-panel-action-btn";
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function createEmptyState(text) {
    const emptyState = document.createElement("p");
    emptyState.className = "muted";
    emptyState.textContent = text;
    return emptyState;
  }

  function formatAccountLine(username, accountNumber) {
    const safeUsername = normalizeText(username) || "Unbekannt";
    const safeAccountNumber = normalizeText(accountNumber);
    return safeAccountNumber ? `${safeUsername} · Account-Nr. ${safeAccountNumber}` : safeUsername;
  }

  function renderFriendEntry(friend) {
    const entry = document.createElement("article");
    entry.className = "social-panel-entry";

    const head = document.createElement("div");
    head.className = "social-panel-entry-head";
    head.appendChild(buildStatusDot(friend.is_online));

    const copy = document.createElement("div");
    copy.className = "social-panel-entry-copy";

    const title = document.createElement("strong");
    title.textContent = formatAccountLine(friend.username, friend.account_number);
    copy.appendChild(title);

    const meta = document.createElement("small");
    if (friend.is_online) {
      const onlineName = normalizeText(friend.online_name) || friend.username;
      const locationParts = [`Online als ${onlineName}`];
      if (friend.server_label) {
        locationParts.push(friend.server_label);
      }
      if (friend.room_name) {
        locationParts.push(friend.room_name);
      }
      meta.textContent = locationParts.join(" · ");
    } else {
      meta.textContent = "Gerade offline";
    }
    copy.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "social-panel-entry-actions";
    actions.appendChild(
      buildActionButton("Entfernen", () => {
        removeFriend(friend.user_id).catch(() => {});
      })
    );

    head.appendChild(copy);
    head.appendChild(actions);
    entry.appendChild(head);
    return entry;
  }

  function renderIgnoredAccountEntry(entryData) {
    const entry = document.createElement("article");
    entry.className = "social-panel-entry";

    const head = document.createElement("div");
    head.className = "social-panel-entry-head";

    const copy = document.createElement("div");
    copy.className = "social-panel-entry-copy";

    const title = document.createElement("strong");
    title.textContent = formatAccountLine(entryData.username, entryData.account_number);
    copy.appendChild(title);

    const meta = document.createElement("small");
    meta.textContent = "Account wird ausgeblendet";
    copy.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "social-panel-entry-actions";
    actions.appendChild(
      buildActionButton("Wieder anzeigen", () => {
        unignoreAccount(entryData.user_id).catch(() => {});
      })
    );

    head.appendChild(copy);
    head.appendChild(actions);
    entry.appendChild(head);
    return entry;
  }

  function renderIgnoredCharacterEntry(entryData) {
    const entry = document.createElement("article");
    entry.className = "social-panel-entry";

    const head = document.createElement("div");
    head.className = "social-panel-entry-head";

    const copy = document.createElement("div");
    copy.className = "social-panel-entry-copy";

    const title = document.createElement("strong");
    title.textContent = entryData.name;
    copy.appendChild(title);

    const meta = document.createElement("small");
    meta.textContent = `Von ${formatAccountLine(entryData.owner_username, entryData.owner_account_number)}`;
    copy.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "social-panel-entry-actions";
    actions.appendChild(
      buildActionButton("Wieder anzeigen", () => {
        unignoreCharacter(entryData.character_id).catch(() => {});
      })
    );

    head.appendChild(copy);
    head.appendChild(actions);
    entry.appendChild(head);
    return entry;
  }

  function renderSocialState() {
    if (friendsList) {
      friendsList.replaceChildren();
      if (!socialState.friends.length) {
        friendsList.appendChild(createEmptyState("Noch keine Freunde gespeichert."));
      } else {
        socialState.friends.forEach((friend) => {
          friendsList.appendChild(renderFriendEntry(friend));
        });
      }
    }

    if (ignoredAccountsList) {
      ignoredAccountsList.replaceChildren();
      if (!socialState.ignored_accounts.length) {
        ignoredAccountsList.appendChild(createEmptyState("Keine ignorierten Accounts."));
      } else {
        socialState.ignored_accounts.forEach((entryData) => {
          ignoredAccountsList.appendChild(renderIgnoredAccountEntry(entryData));
        });
      }
    }

    if (ignoredCharactersList) {
      ignoredCharactersList.replaceChildren();
      if (!socialState.ignored_characters.length) {
        ignoredCharactersList.appendChild(createEmptyState("Keine ignorierten Charaktere."));
      } else {
        socialState.ignored_characters.forEach((entryData) => {
          ignoredCharactersList.appendChild(renderIgnoredCharacterEntry(entryData));
        });
      }
    }

    if (badge) {
      const onlineCount = socialState.friends.filter((entry) => entry.is_online).length;
      badge.hidden = onlineCount < 1;
      badge.textContent = onlineCount > 99 ? "99+" : String(onlineCount || 0);
    }
  }

  function closePanel() {
    panel.hidden = true;
    toggleButton.classList.remove("is-open");
    toggleButton.setAttribute("aria-expanded", "false");
  }

  function openPanel() {
    panel.hidden = false;
    toggleButton.classList.add("is-open");
    toggleButton.setAttribute("aria-expanded", "true");
    refreshState().catch(() => {});
  }

  function togglePanel() {
    if (panel.hidden) {
      openPanel();
      return;
    }

    closePanel();
  }

  async function requestJson(url, options = {}) {
    const response = await window.fetch(url, {
      method: options.method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "x-requested-with": "XMLHttpRequest",
        ...(options.body ? { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" } : {})
      },
      body: options.body || undefined
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }

    if (!response.ok || payload?.ok === false) {
      const errorMessage = normalizeText(payload?.error || payload?.message) || "Aktion konnte nicht ausgeführt werden.";
      throw new Error(errorMessage);
    }

    return payload;
  }

  async function refreshState() {
    const result = await requestJson("/api/social/state");
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    return socialState;
  }

  async function addFriendByLookup(lookup) {
    const payload = new URLSearchParams({
      lookup: normalizeText(lookup)
    }).toString();
    const result = await requestJson("/api/social/friends", {
      method: "POST",
      body: payload
    });
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    setFeedback(result?.message || "Freund hinzugefügt.", "success");
    return result;
  }

  async function addFriendByUserId(userId) {
    const parsedUserId = normalizeNumber(userId);
    if (!parsedUserId) {
      throw new Error("Freund konnte nicht zugeordnet werden.");
    }

    const result = await requestJson("/api/social/friends", {
      method: "POST",
      body: new URLSearchParams({
        user_id: String(parsedUserId)
      }).toString()
    });
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    setFeedback(result?.message || "Freund hinzugefügt.", "success");
    return result;
  }

  async function removeFriend(friendUserId) {
    const parsedFriendUserId = normalizeNumber(friendUserId);
    if (!parsedFriendUserId) {
      return null;
    }

    const result = await requestJson(`/api/social/friends/${parsedFriendUserId}/delete`, {
      method: "POST"
    });
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    setFeedback(result?.message || "Freund entfernt.", "success");
    return result;
  }

  async function ignoreAccount(userId) {
    const parsedUserId = normalizeNumber(userId);
    if (!parsedUserId) {
      throw new Error("Account konnte nicht zugeordnet werden.");
    }

    const result = await requestJson("/api/social/ignored-accounts", {
      method: "POST",
      body: new URLSearchParams({
        user_id: String(parsedUserId)
      }).toString()
    });
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    setFeedback(result?.message || "Account wird jetzt ignoriert.", "success");
    return result;
  }

  async function unignoreAccount(userId) {
    const parsedUserId = normalizeNumber(userId);
    if (!parsedUserId) {
      return null;
    }

    const result = await requestJson(`/api/social/ignored-accounts/${parsedUserId}/delete`, {
      method: "POST"
    });
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    setFeedback(result?.message || "Account-Ignorieren entfernt.", "success");
    return result;
  }

  async function ignoreCharacter(characterId) {
    const parsedCharacterId = normalizeNumber(characterId);
    if (!parsedCharacterId) {
      throw new Error("Charakter konnte nicht zugeordnet werden.");
    }

    const result = await requestJson("/api/social/ignored-characters", {
      method: "POST",
      body: new URLSearchParams({
        character_id: String(parsedCharacterId)
      }).toString()
    });
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    setFeedback(result?.message || "Charakter wird jetzt ignoriert.", "success");
    return result;
  }

  async function unignoreCharacter(characterId) {
    const parsedCharacterId = normalizeNumber(characterId);
    if (!parsedCharacterId) {
      return null;
    }

    const result = await requestJson(`/api/social/ignored-characters/${parsedCharacterId}/delete`, {
      method: "POST"
    });
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    setFeedback(result?.message || "Charakter-Ignorieren entfernt.", "success");
    return result;
  }

  function isFriendUserId(userId) {
    const parsedUserId = normalizeNumber(userId);
    return Boolean(parsedUserId && socialState.friend_user_ids.includes(parsedUserId));
  }

  function isIgnoredUserId(userId) {
    const parsedUserId = normalizeNumber(userId);
    return Boolean(parsedUserId && socialState.ignored_account_user_ids.includes(parsedUserId));
  }

  function isIgnoredCharacterId(characterId) {
    const parsedCharacterId = normalizeNumber(characterId);
    return Boolean(parsedCharacterId && socialState.ignored_character_ids.includes(parsedCharacterId));
  }

  function showFriendOnlineToast(friend) {
    if (document.visibilityState === "hidden") {
      return;
    }

    try {
      const dedupeKey = `social-friend-online:${friend.user_id}`;
      const previousValue = Number(window.localStorage.getItem(dedupeKey) || "0");
      const now = Date.now();
      if (previousValue && now - previousValue < friendOnlineToastDurationMs) {
        return;
      }
      window.localStorage.setItem(dedupeKey, String(now));
    } catch (_error) {
      // Ignore unavailable storage.
    }

    const toast = document.createElement("div");
    toast.className = "social-friend-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const name = normalizeText(friend.online_name) || normalizeText(friend.username) || "Ein Freund";
    toast.textContent = `${name} ist jetzt online.`;
    document.body.appendChild(toast);

    window.requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => {
        toast.remove();
      }, 180);
    }, friendOnlineToastDurationMs);
  }

  toggleButton.addEventListener("click", () => {
    togglePanel();
  });

  closeButton?.addEventListener("click", () => {
    closePanel();
  });

  panel.addEventListener("click", (event) => {
    if (event.target === panel) {
      closePanel();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      closePanel();
    }
  });

  friendForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const lookup = normalizeText(friendInput?.value);
    if (!lookup) {
      setFeedback("Bitte einen Account-Namen oder Charakternamen eingeben.", "error");
      friendInput?.focus();
      return;
    }

    try {
      await addFriendByLookup(lookup);
      if (friendInput) {
        friendInput.value = "";
      }
    } catch (error) {
      setFeedback(error?.message || "Freund konnte nicht hinzugefügt werden.", "error");
    }
  });

  const socket = canUseRealtime
    ? io({
        transports: ["websocket"]
      })
    : null;

  socket?.on("social:update", (payload) => {
    publishSocialState(payload || {}, {
      allowNotifications: true
    });
  });

  socket?.on("connect", () => {
    refreshState().catch(() => {});
  });

  window.appSocialApi = {
    openPanel,
    closePanel,
    refreshState,
    addFriendByLookup,
    addFriendByUserId,
    removeFriend,
    ignoreAccount,
    unignoreAccount,
    ignoreCharacter,
    unignoreCharacter,
    isFriendUserId,
    isIgnoredUserId,
    isIgnoredCharacterId
  };

  publishSocialState(socialState, {
    allowNotifications: false
  });
  refreshState().catch(() => {});
})();
