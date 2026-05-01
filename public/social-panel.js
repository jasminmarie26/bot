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
  const friendsPager = panel.querySelector("[data-social-friends-pager]");
  const ignoredAccountsList = panel.querySelector("[data-social-ignored-accounts-list]");
  const ignoredAccountsPager = panel.querySelector("[data-social-ignored-accounts-pager]");
  const ignoredCharactersList = panel.querySelector("[data-social-ignored-characters-list]");
  const ignoredCharactersPager = panel.querySelector("[data-social-ignored-characters-pager]");
  const tabButtons = Array.from(panel.querySelectorAll("[data-social-tab-button]"));
  const tabPanels = Array.from(panel.querySelectorAll("[data-social-tab-panel]"));
  const badge = document.querySelector("[data-social-panel-badge]");
  const canUseRealtime = typeof io === "function";
  const friendOnlineToastDurationMs = 4200;
  const socialPageSize = 5;
  const socialPageState = {
    friends: 0,
    "ignored-accounts": 0,
    "ignored-characters": 0
  };
  let feedbackTimer = 0;
  let socialState = normalizeSocialState(window.__appSocialState || {});
  let hasReceivedInitialState = false;
  let activeTabName =
    tabButtons.find((button) => button.classList.contains("is-active"))?.dataset?.socialTabButton ||
    tabButtons[0]?.dataset?.socialTabButton ||
    "";

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
            friend_type: normalizeText(entry?.friend_type) || "user",
            source_character_id: normalizeNumber(entry?.source_character_id),
            user_id: normalizeNumber(entry?.user_id),
            friend_character_id: normalizeNumber(entry?.friend_character_id),
            is_online: entry?.is_online === true,
            online_name: normalizeText(entry?.online_name),
            character_id: normalizeNumber(entry?.character_id),
            role_style: normalizeText(entry?.role_style),
            chat_text_color: normalizeText(entry?.chat_text_color),
            server_id: normalizeText(entry?.server_id),
            server_label: normalizeText(entry?.server_label),
            room_id: normalizeNumber(entry?.room_id),
            room_name: normalizeText(entry?.room_name)
          }))
          .filter((entry) => entry.user_id)
      : [];
    const ignoredAccounts = Array.isArray(payload?.ignored_accounts)
      ? payload.ignored_accounts
          .map((entry) => ({
            user_id: normalizeNumber(entry?.user_id),
            username: normalizeText(entry?.username),
            label: normalizeText(entry?.label)
          }))
          .filter((entry) => entry.user_id)
      : [];
    const ignoredCharacters = Array.isArray(payload?.ignored_characters)
      ? payload.ignored_characters
          .map((entry) => ({
            character_id: normalizeNumber(entry?.character_id),
            name: normalizeText(entry?.name),
            owner_user_id: normalizeNumber(entry?.owner_user_id)
          }))
          .filter((entry) => entry.character_id && entry.name)
      : [];
    const friendUserIds = Array.isArray(payload?.friend_user_ids)
      ? payload.friend_user_ids.map((value) => normalizeNumber(value)).filter(Boolean)
      : friends.map((entry) => entry.user_id).filter(Boolean);
    const friendCharacterIds = Array.isArray(payload?.friend_character_ids)
      ? payload.friend_character_ids.map((value) => normalizeNumber(value)).filter(Boolean)
      : [];

    return {
      friends,
      ignored_accounts: ignoredAccounts,
      ignored_characters: ignoredCharacters,
      friend_user_ids: friendUserIds,
      friend_character_ids: friendCharacterIds,
      ignored_account_user_ids: ignoredAccounts.map((entry) => entry.user_id),
      ignored_character_ids: ignoredCharacters.map((entry) => entry.character_id)
    };
  }

  function getCurrentSocialCharacterId() {
    const globalCharacterId = normalizeNumber(window.__appActiveCharacterId);
    if (globalCharacterId) {
      return globalCharacterId;
    }
    return normalizeNumber(panel?.dataset?.socialSourceCharacterId);
  }

  function syncCurrentSocialCharacterId(nextCharacterId) {
    const parsedCharacterId = normalizeNumber(nextCharacterId);
    if (panel) {
      panel.dataset.socialSourceCharacterId = parsedCharacterId ? String(parsedCharacterId) : "";
    }
    window.__appActiveCharacterId = parsedCharacterId;
  }

  function friendMatchesCurrentCharacter(entry, sourceCharacterId = getCurrentSocialCharacterId()) {
    const entrySourceCharacterId = normalizeNumber(entry?.source_character_id);
    if (!sourceCharacterId || !entrySourceCharacterId) {
      return true;
    }
    return entrySourceCharacterId === sourceCharacterId;
  }

  function getCurrentCharacterFriends(state = socialState, sourceCharacterId = getCurrentSocialCharacterId()) {
    const friends = Array.isArray(state?.friends) ? state.friends : [];
    return friends.filter((entry) => friendMatchesCurrentCharacter(entry, sourceCharacterId));
  }

  function getFriendStateKey(entry) {
    const sourceCharacterId = normalizeNumber(entry?.source_character_id) || 0;
    if (entry?.friend_type === "character" && normalizeNumber(entry?.friend_character_id)) {
      return `character:${sourceCharacterId}:${normalizeNumber(entry.friend_character_id)}`;
    }
    return `user:${sourceCharacterId}:${normalizeNumber(entry?.user_id) || 0}`;
  }

  function publishSocialState(nextState, { allowNotifications = false } = {}) {
    const currentSourceCharacterId = getCurrentSocialCharacterId();
    const previousFriendsByUserId = new Map(
      getCurrentCharacterFriends(socialState, currentSourceCharacterId)
        .filter((entry) => entry && (entry.user_id || entry.friend_character_id))
        .map((entry) => [
          getFriendStateKey(entry),
          entry
        ])
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
      getCurrentCharacterFriends(normalizedState, currentSourceCharacterId).forEach((friend) => {
        const previousEntry = previousFriendsByUserId.get(getFriendStateKey(friend));
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

  function buildActionButton(label, handler, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "social-panel-action-btn";
    button.textContent = label;
    const title = normalizeText(options?.title);
    if (title) {
      button.title = title;
      button.setAttribute("aria-label", title);
    }
    if (options?.compact) {
      button.classList.add("is-compact");
    }
    if (options?.active) {
      button.classList.add("is-active");
    }
    button.addEventListener("click", handler);
    return button;
  }

  function createEmptyState(text) {
    const emptyState = document.createElement("p");
    emptyState.className = "muted";
    emptyState.textContent = text;
    return emptyState;
  }

  function getFriendDisplayName(friend) {
    return normalizeText(friend?.online_name) || "Freund";
  }

  function getVisibleFriends() {
    return getCurrentCharacterFriends()
      .filter((entry) => entry?.is_online)
      .slice()
      .sort((leftFriend, rightFriend) =>
        getFriendDisplayName(leftFriend).localeCompare(getFriendDisplayName(rightFriend), "de", {
          sensitivity: "base"
        })
      );
  }

  function getVisibleCharacterFriends() {
    return getVisibleFriends().filter((entry) => entry?.friend_type === "character");
  }

  function createEntryCell(className, content) {
    const cell = document.createElement("div");
    cell.className = `social-panel-cell ${className}`;
    if (content instanceof Node) {
      cell.appendChild(content);
    } else {
      cell.textContent = normalizeText(content);
    }
    return cell;
  }

  function createEntryShell(extraClass = "") {
    const entry = document.createElement("article");
    entry.className = `social-panel-entry${extraClass ? ` ${extraClass}` : ""}`;

    const row = document.createElement("div");
    row.className = "social-panel-entry-row";
    entry.appendChild(row);

    return { entry, row };
  }

  function getPageWindow(listName, totalCount) {
    const normalizedListName = normalizeText(listName);
    const pageCount = Math.max(1, Math.ceil(Math.max(0, totalCount) / socialPageSize));
    const rawPageIndex = Number(socialPageState[normalizedListName] || 0);
    const pageIndex = Math.min(Math.max(0, rawPageIndex), pageCount - 1);

    socialPageState[normalizedListName] = pageIndex;

    return {
      pageIndex,
      pageCount,
      startIndex: pageIndex * socialPageSize,
      endIndex: pageIndex * socialPageSize + socialPageSize
    };
  }

  function buildPagerButton(label, title, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "social-panel-pager-btn";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", handler);
    return button;
  }

  function renderPager(pagerNode, listName, totalCount) {
    if (!pagerNode) {
      return;
    }

    pagerNode.replaceChildren();
    if (totalCount <= socialPageSize) {
      pagerNode.hidden = true;
      return;
    }

    const { pageIndex, pageCount } = getPageWindow(listName, totalCount);
    const previousButton = buildPagerButton("←", "Vorherige Seite", () => {
      socialPageState[listName] = Math.max(0, pageIndex - 1);
      renderSocialState();
    });
    const nextButton = buildPagerButton("→", "Nächste Seite", () => {
      socialPageState[listName] = Math.min(pageCount - 1, pageIndex + 1);
      renderSocialState();
    });
    previousButton.disabled = pageIndex === 0;
    nextButton.disabled = pageIndex >= pageCount - 1;

    const label = document.createElement("span");
    label.className = "social-panel-pager-label";
    label.textContent = `${pageIndex + 1} / ${pageCount}`;

    pagerNode.appendChild(previousButton);
    pagerNode.appendChild(label);
    pagerNode.appendChild(nextButton);
    pagerNode.hidden = false;
  }

  function renderListEntries({
    listNode,
    pagerNode,
    listName,
    items,
    emptyText,
    renderEntry
  }) {
    if (!listNode) {
      return;
    }

    listNode.replaceChildren();
    if (!Array.isArray(items) || !items.length) {
      listNode.appendChild(createEmptyState(emptyText));
      renderPager(pagerNode, listName, 0);
      return;
    }

    const pageWindow = pagerNode ? getPageWindow(listName, items.length) : null;
    const visibleItems = pageWindow ? items.slice(pageWindow.startIndex, pageWindow.endIndex) : items;
    visibleItems.forEach((entryData) => {
      listNode.appendChild(renderEntry(entryData));
    });
    renderPager(pagerNode, listName, items.length);
  }

  function setActiveTab(tabName) {
    const normalizedTabName = normalizeText(tabName);
    if (!normalizedTabName || !tabButtons.length || !tabPanels.length) {
      return;
    }

    activeTabName = normalizedTabName;
    tabButtons.forEach((button) => {
      const isActive = button.dataset.socialTabButton === normalizedTabName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    tabPanels.forEach((panelNode) => {
      panelNode.hidden = panelNode.dataset.socialTabPanel !== normalizedTabName;
    });
  }

  function renderFriendEntry(friend) {
    const { entry, row } = createEntryShell("social-panel-friend-entry");

    const titleRow = document.createElement("div");
    titleRow.className = "social-panel-friend-title";
    titleRow.appendChild(buildStatusDot(friend.is_online));

    const title = document.createElement("strong");
    title.textContent = getFriendDisplayName(friend);
    titleRow.appendChild(title);
    row.appendChild(createEntryCell("social-panel-cell-name", titleRow));

    const locationParts = [];
    if (friend.server_label) {
      locationParts.push(friend.server_label);
    }
    if (friend.room_name) {
      locationParts.push(friend.room_name);
    }
    row.appendChild(
      createEntryCell("social-panel-cell-meta", locationParts.join(" · ") || "Gerade online")
    );

    const actions = document.createElement("div");
    actions.className = "social-panel-entry-actions";
    if (friend.character_id) {
      const characterIsIgnored = socialState.ignored_character_ids.includes(friend.character_id);
      actions.appendChild(
        buildActionButton(
          characterIsIgnored ? "Char frei" : "Char",
          () => {
            const action = characterIsIgnored
              ? unignoreCharacter(friend.character_id)
              : ignoreCharacter(friend.character_id);
            action.catch(() => {});
          },
          {
            title: characterIsIgnored ? "Charakter wieder anzeigen" : "Charakter ignorieren",
            compact: true,
            active: characterIsIgnored
          }
        )
      );
    }

    const accountIsIgnored = socialState.ignored_account_user_ids.includes(friend.user_id);
    actions.appendChild(
      buildActionButton(
        accountIsIgnored ? "Acc frei" : "Acc",
        () => {
          const action = accountIsIgnored
            ? unignoreAccount(friend.user_id)
            : ignoreAccount(friend.user_id, getFriendDisplayName(friend));
          action.catch(() => {});
        },
        {
          title: accountIsIgnored ? "Account wieder anzeigen" : "Account ignorieren",
          compact: true,
          active: accountIsIgnored
        }
      )
    );
    actions.appendChild(
      buildActionButton(
        "Entf.",
        () => {
          const removeAction =
            friend.friend_type === "character" && friend.friend_character_id
              ? removeFriendCharacter(friend.friend_character_id, friend.source_character_id)
              : removeFriend(friend.user_id, friend.source_character_id);
          removeAction.catch(() => {});
        },
        {
          title: "Freund entfernen",
          compact: true
        }
      )
    );
    row.appendChild(actions);

    return entry;
  }

  function renderIgnoredAccountEntry(entryData) {
    const { entry, row } = createEntryShell();
    const accountLabel = normalizeText(entryData?.label)
      || normalizeText(entryData?.username)
      || "Blockierter Account";

    const title = document.createElement("strong");
    title.textContent = accountLabel;
    row.appendChild(createEntryCell("social-panel-cell-name", title));
    row.appendChild(createEntryCell("social-panel-cell-meta", "Nur für dich ausgeblendet."));

    const actions = document.createElement("div");
    actions.className = "social-panel-entry-actions";
    actions.appendChild(
      buildActionButton(
        "Freigeben",
        () => {
          unignoreAccount(entryData.user_id).catch(() => {});
        },
        {
          title: "Account wieder anzeigen",
          compact: true
        }
      )
    );
    row.appendChild(actions);

    return entry;
  }

  function renderIgnoredCharacterEntry(entryData) {
    const { entry, row } = createEntryShell();

    const title = document.createElement("strong");
    title.textContent = entryData.name;
    row.appendChild(createEntryCell("social-panel-cell-name", title));
    row.appendChild(createEntryCell("social-panel-cell-meta", "Nur für dich ausgeblendet."));

    const actions = document.createElement("div");
    actions.className = "social-panel-entry-actions";
    actions.appendChild(
      buildActionButton(
        "Freigeben",
        () => {
          unignoreCharacter(entryData.character_id).catch(() => {});
        },
        {
          title: "Charakter wieder anzeigen",
          compact: true
        }
      )
    );
    row.appendChild(actions);

    return entry;
  }

  function renderSocialState() {
    if (friendsList) {
      const currentCharacterFriends = getCurrentCharacterFriends();
      const visibleFriends = getVisibleFriends();
      if (!currentCharacterFriends.length) {
        renderListEntries({
          listNode: friendsList,
          pagerNode: friendsPager,
          listName: "friends",
          items: [],
          emptyText: "Für diesen Charakter sind noch keine Freunde gespeichert.",
          renderEntry: renderFriendEntry
        });
      } else if (!visibleFriends.length) {
        renderListEntries({
          listNode: friendsList,
          pagerNode: friendsPager,
          listName: "friends",
          items: [],
          emptyText: "Gerade ist keiner deiner Freunde online.",
          renderEntry: renderFriendEntry
        });
      } else {
        renderListEntries({
          listNode: friendsList,
          pagerNode: friendsPager,
          listName: "friends",
          items: visibleFriends,
          emptyText: "Gerade ist keiner deiner Freunde online.",
          renderEntry: renderFriendEntry
        });
      }
    }

    if (ignoredAccountsList) {
      renderListEntries({
        listNode: ignoredAccountsList,
        pagerNode: ignoredAccountsPager,
        listName: "ignored-accounts",
        items: socialState.ignored_accounts
          .slice()
          .sort((leftEntry, rightEntry) =>
            (normalizeText(leftEntry?.label) || normalizeText(leftEntry?.username)).localeCompare(
              normalizeText(rightEntry?.label) || normalizeText(rightEntry?.username),
              "de",
              {
                sensitivity: "base"
              }
            )
          ),
        emptyText: "Keine ignorierten Accounts.",
        renderEntry: renderIgnoredAccountEntry
      });
    }

    if (ignoredCharactersList) {
      renderListEntries({
        listNode: ignoredCharactersList,
        pagerNode: ignoredCharactersPager,
        listName: "ignored-characters",
        items: socialState.ignored_characters
          .slice()
          .sort((leftEntry, rightEntry) =>
            normalizeText(leftEntry?.name).localeCompare(normalizeText(rightEntry?.name), "de", {
              sensitivity: "base"
            })
          ),
        emptyText: "Keine ignorierten Charaktere.",
        renderEntry: renderIgnoredCharacterEntry
      });
    }

    if (badge) {
      const onlineCount = getVisibleCharacterFriends().length;
      badge.hidden = onlineCount < 1;
      badge.textContent = "";
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
    setActiveTab(activeTabName || "friends");
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
    const payload = buildSocialParams({
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
      body: buildSocialParams({
        user_id: String(parsedUserId)
      }).toString()
    });
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    setFeedback(result?.message || "Freund hinzugefügt.", "success");
    return result;
  }

  async function addFriendByCharacterId(characterId) {
    const parsedCharacterId = normalizeNumber(characterId);
    if (!parsedCharacterId) {
      throw new Error("Freund konnte nicht zugeordnet werden.");
    }

    const result = await requestJson("/api/social/friends", {
      method: "POST",
      body: buildSocialParams({
        character_id: String(parsedCharacterId)
      }).toString()
    });
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    setFeedback(result?.message || "Freund hinzugefügt.", "success");
    return result;
  }

  async function removeFriend(friendUserId, sourceCharacterId = null) {
    const parsedFriendUserId = normalizeNumber(friendUserId);
    if (!parsedFriendUserId) {
      return null;
    }

    const result = await requestJson(`/api/social/friends/${parsedFriendUserId}/delete`, {
      method: "POST",
      body: buildSocialParams({}, sourceCharacterId).toString()
    });
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    setFeedback(result?.message || "Freund entfernt.", "success");
    return result;
  }

  async function removeFriendCharacter(friendCharacterId, sourceCharacterId = null) {
    const parsedFriendCharacterId = normalizeNumber(friendCharacterId);
    if (!parsedFriendCharacterId) {
      return null;
    }

    const result = await requestJson(`/api/social/friends/character/${parsedFriendCharacterId}/delete`, {
      method: "POST",
      body: buildSocialParams({}, sourceCharacterId).toString()
    });
    publishSocialState(result?.state || {}, {
      allowNotifications: false
    });
    setFeedback(result?.message || "Freund entfernt.", "success");
    return result;
  }

  async function ignoreAccount(userId, label = "") {
    const parsedUserId = normalizeNumber(userId);
    if (!parsedUserId) {
      throw new Error("Account konnte nicht zugeordnet werden.");
    }

    const result = await requestJson("/api/social/ignored-accounts", {
      method: "POST",
      body: new URLSearchParams({
        user_id: String(parsedUserId),
        label: String(label || "").trim()
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

  function buildSocialParams(values = {}, sourceCharacterId = null) {
    const params = new URLSearchParams();
    Object.entries(values || {}).forEach(([key, value]) => {
      if (value == null) {
        return;
      }
      const preparedValue =
        typeof value === "number"
          ? normalizeNumber(value)
          : normalizeText(value);
      if (!preparedValue) {
        return;
      }
      params.set(key, String(preparedValue));
    });

    const resolvedSourceCharacterId = normalizeNumber(sourceCharacterId) || getCurrentSocialCharacterId();
    if (resolvedSourceCharacterId) {
      params.set("source_character_id", String(resolvedSourceCharacterId));
    }
    return params;
  }

  function isFriendUserId(userId) {
    const parsedUserId = normalizeNumber(userId);
    if (!parsedUserId) {
      return false;
    }
    if (Array.isArray(socialState.friends) && socialState.friends.length) {
      return getCurrentCharacterFriends().some(
        (entry) => entry?.friend_type !== "character" && entry?.user_id === parsedUserId
      );
    }
    return socialState.friend_user_ids.includes(parsedUserId);
  }

  function isFriendCharacterId(characterId) {
    const parsedCharacterId = normalizeNumber(characterId);
    if (!parsedCharacterId) {
      return false;
    }
    if (Array.isArray(socialState.friends) && socialState.friends.length) {
      return getCurrentCharacterFriends().some(
        (entry) => entry?.friend_type === "character" && entry?.friend_character_id === parsedCharacterId
      );
    }
    return socialState.friend_character_ids.includes(parsedCharacterId);
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
      const dedupeKey = `social-friend-online:${getFriendStateKey(friend)}`;
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

    const name = normalizeText(friend.online_name) || "Ein Freund";
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

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.socialTabButton);
    });
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
      setFeedback("Bitte einen Charakternamen eingeben.", "error");
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

  window.addEventListener("app:active-character-change", (event) => {
    syncCurrentSocialCharacterId(event?.detail?.characterId);
    renderSocialState();
  });

  window.appSocialApi = {
    openPanel,
    closePanel,
    refreshState,
    addFriendByLookup,
    addFriendByUserId,
    addFriendByCharacterId,
    removeFriend,
    removeFriendCharacter,
    ignoreAccount,
    unignoreAccount,
    ignoreCharacter,
    unignoreCharacter,
    isFriendUserId,
    isFriendCharacterId,
    isIgnoredUserId,
    isIgnoredCharacterId
  };

  syncCurrentSocialCharacterId(getCurrentSocialCharacterId());
  publishSocialState(socialState, {
    allowNotifications: false
  });
  setActiveTab(activeTabName || "friends");
  refreshState().catch(() => {});
})();
