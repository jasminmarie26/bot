(() => {
  const presenceSource = document.querySelector("[data-server-presence]");
  const headerIdentity = document.querySelector("[data-header-identity]");
  const isRoomListPage = document.body?.classList?.contains("page-roomlist") === true;
  const userMenuIdentityTargets = Array.from(
    document.querySelectorAll(".topbar-user-menu-meta > strong, .rp-user-menu-meta > strong")
  );
  const liveCharacterLinkTargets = Array.from(document.querySelectorAll("[data-live-character-href-template]"));
  const liveCharacterNameTargets = Array.from(document.querySelectorAll("[data-live-character-name]"));
  const liveCharacterServerLabelTargets = Array.from(
    document.querySelectorAll("[data-live-character-server-label]")
  );
  let roomWatchTargets = [];
  let roomLockTargets = [];
  let roomLinkTargets = [];
  let ownedRoomLists = [];
  let roomListRefreshPromise = null;
  let roomListRefreshQueued = false;
  let socialState = normalizeSocialState(window.__appSocialState || {});
  const roomWatchPayloads = new Map();
  function collectRoomTargets() {
    roomWatchTargets = Array.from(document.querySelectorAll("[data-room-watch-target]"));
    roomLockTargets = Array.from(document.querySelectorAll("[data-room-lock-target]"));
    roomLinkTargets = Array.from(document.querySelectorAll("[data-room-link-target]"));
    ownedRoomLists = Array.from(document.querySelectorAll(".rp-room-list-owned"));
  }
  collectRoomTargets();
  if ((!presenceSource && roomWatchTargets.length === 0) || typeof io !== "function") return;

  const serverId = String(presenceSource?.dataset?.serverPresence || "")
    .trim()
    .toLowerCase();

  const socket = io({
    transports: ["websocket"]
  });

  function syncPresenceSubscriptions() {
    if (serverId) {
      socket.emit("presence:set", {
        serverId,
        characterId: presenceSource?.dataset?.activeCharacterId || ""
      });
    }

    roomWatchTargets.forEach((target) => {
      socket.emit("room:watch", {
        roomId: target.dataset.roomWatchRoom || "",
        standardRoomId: target.dataset.roomWatchStandardRoom || "",
        serverId: String(target.dataset.roomWatchServer || serverId || "")
          .trim()
          .toLowerCase()
      });
    });

    scheduleOwnedRoomRowSeparators();
  }

  function normalizeChatTextColor(rawColor) {
    const value = String(rawColor || "").trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : "";
  }

  function normalizePositiveNumber(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeServerLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "larp") {
      return "LARP";
    }
    if (normalized === "erp") {
      return "ERP";
    }
    if (normalized === "free-rp") {
      return "FREE-RP";
    }
    return normalized ? normalized.toUpperCase() : "FREE-RP";
  }

  function applySpecialNameDecor(node, rawName) {
    if (!node) return;
    const label = String(rawName || node.textContent || "").trim();
    node.classList.toggle("has-noctra-wings", /^noctra(?:\b|\s|\[|\()/i.test(label));
    node.classList.toggle("has-crescentia-moons", /^(?:crescentia|cresentia)(?:\b|\s|\[|\()/i.test(label));
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
    const nextChatTextColor = normalizeChatTextColor(chatTextColor);

    if (!nextName) {
      return;
    }

    node.textContent = getBirthdayCakeLabel(nextName, showBirthdayCake);
    node.title = getBirthdayCakeLabel(nextName, showBirthdayCake);
    node.classList.toggle("role-name-admin", nextRoleStyle === "admin");
    node.classList.toggle("role-name-moderator", nextRoleStyle === "moderator");
    applySpecialNameDecor(node, nextName);

    if (nextRoleStyle) {
      node.style.removeProperty("color");
      return;
    }

    if (nextChatTextColor) {
      node.style.color = nextChatTextColor;
      return;
    }

    node.style.removeProperty("color");
  }

  function syncLiveCharacterLinks(characterId, serverIdValue = "") {
    const nextCharacterId = normalizePositiveNumber(characterId);
    if (!nextCharacterId) {
      return;
    }

    const nextServerId = String(serverIdValue || serverId || "").trim().toLowerCase();
    liveCharacterLinkTargets.forEach((node) => {
      const hrefTemplate = String(node?.dataset?.liveCharacterHrefTemplate || "").trim();
      if (!hrefTemplate) {
        return;
      }

      let nextHref = hrefTemplate.replace(/__CHARACTER_ID__/g, String(nextCharacterId));
      if (nextServerId) {
        nextHref = nextHref.replace(/__SERVER_ID__/g, nextServerId);
      }

      node.href = nextHref;
      if (node.hasAttribute("data-rp-board-character-id")) {
        node.setAttribute("data-rp-board-character-id", String(nextCharacterId));
      }
      if (node.hasAttribute("data-rp-board-server-id") && nextServerId) {
        node.setAttribute("data-rp-board-server-id", nextServerId);
      }
    });
  }

  function normalizeSocialState(payload) {
    const ignoredAccountUserIds = Array.isArray(payload?.ignored_account_user_ids)
      ? payload.ignored_account_user_ids.map((value) => normalizePositiveNumber(value)).filter(Boolean)
      : [];
    const ignoredCharacterIds = Array.isArray(payload?.ignored_character_ids)
      ? payload.ignored_character_ids.map((value) => normalizePositiveNumber(value)).filter(Boolean)
      : [];

    return {
      ignoredAccountUserIds: new Set(ignoredAccountUserIds),
      ignoredCharacterIds: new Set(ignoredCharacterIds)
    };
  }

  function isIgnoredRoomEntry(entry) {
    if (!entry || entry.is_npc === true) {
      return false;
    }

    const userId = normalizePositiveNumber(entry?.user_id);
    const characterId = normalizePositiveNumber(entry?.character_id);
    return Boolean(
      (userId && socialState.ignoredAccountUserIds.has(userId)) ||
      (characterId && socialState.ignoredCharacterIds.has(characterId))
    );
  }

  function getRoomWatchPayloadKey(roomId, serverIdValue, standardRoomIdValue = "") {
    const roomKey = roomId == null ? "" : String(roomId);
    const normalizedServerId = String(serverIdValue || "").trim().toLowerCase();
    const normalizedStandardRoomId = String(standardRoomIdValue || "").trim().toLowerCase();
    return `${normalizedServerId}:${roomKey}:${normalizedStandardRoomId}`;
  }

  function updateHeaderIdentity(payload) {
    const nextName = String(payload?.name || "").trim();
    const nextColor = normalizeChatTextColor(payload?.chat_text_color);
    const nextRoleStyle = String(payload?.role_style || "").trim().toLowerCase();
    const nextServerId = String(payload?.server_id || serverId || "").trim().toLowerCase();
    const nextCharacterId = normalizePositiveNumber(payload?.character_id);
    const showBirthdayCake = payload?.show_birthday_cake === true;

    if (presenceSource && Object.prototype.hasOwnProperty.call(payload || {}, "character_id")) {
      presenceSource.dataset.activeCharacterId = nextCharacterId ? String(nextCharacterId) : "";
    }

    syncLiveCharacterLinks(nextCharacterId, nextServerId);

    if (nextName) {
      setIdentityNodeAppearance(headerIdentity, nextName, {
        roleStyle: nextRoleStyle,
        chatTextColor: nextColor,
        showBirthdayCake
      });
      userMenuIdentityTargets.forEach((node) => {
        setIdentityNodeAppearance(node, nextName, {
          roleStyle: nextRoleStyle,
          chatTextColor: nextColor,
          showBirthdayCake
        });
      });
      liveCharacterNameTargets.forEach((node) => {
        node.textContent = `Charakter: ${getBirthdayCakeLabel(nextName, showBirthdayCake)}`;
        node.title = getBirthdayCakeLabel(nextName, showBirthdayCake);
      });
    }

    if (nextServerId) {
      const nextServerLabel = normalizeServerLabel(nextServerId);
      liveCharacterServerLabelTargets.forEach((node) => {
        node.textContent = `Server: ${nextServerLabel}`;
      });
    }
  }

  function createOccupantNode(entry) {
    const displayName = String(entry?.name || "").replace(/\s*\(M\)\s*$/i, "").trim() || "Unbekannt";
    const displayNameWithBirthdayCake = getBirthdayCakeLabel(
      displayName,
      entry?.show_birthday_cake === true
    );
    const characterId = Number(entry?.character_id);
    const chatTextColor = normalizeChatTextColor(entry?.chat_text_color);
    const roleStyle = String(entry?.role_style || "").trim().toLowerCase();
    const hasRoomRights = Boolean(entry?.has_room_rights);
    const isAfk = entry?.is_afk === true;
    const nameNode = document.createElement("span");
    if (roleStyle) {
      nameNode.classList.add(`role-name-${roleStyle}`);
    }
    if (isAfk) {
      nameNode.classList.add("is-afk");
    }
    nameNode.textContent = displayNameWithBirthdayCake;
    function appendOccupantContent(target) {
      if (isAfk) {
        const icon = document.createElement("span");
        icon.className = "rp-room-afk-clock";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "\u25F7";
        target.appendChild(icon);
      }
      target.appendChild(nameNode);
    }

    if (Number.isInteger(characterId) && characterId > 0) {
      const link = document.createElement("a");
      link.className = "rp-room-occupant";
      if (hasRoomRights) {
        link.classList.add("has-room-rights");
      }
      if (isAfk) {
        link.classList.add("is-afk");
      }
      link.href = `/characters/${characterId}/guestbook`;
      appendOccupantContent(link);
      return link;
    }

    const text = document.createElement("span");
    text.className = "rp-room-occupant";
    if (hasRoomRights) {
      text.classList.add("has-room-rights");
    }
    if (isAfk) {
      text.classList.add("is-afk");
    }
    appendOccupantContent(text);
    return text;
  }

  let ownedRoomSeparatorFrame = 0;

  function refreshOwnedRoomRowSeparators() {
    ownedRoomSeparatorFrame = 0;
    if (!ownedRoomLists.length) return;

    ownedRoomLists.forEach((list) => {
      list.querySelectorAll(".rp-room-row-separator").forEach((separator) => separator.remove());

      const cards = Array.from(list.children).filter(
        (child) => child instanceof HTMLElement && child.classList.contains("rp-room-standard-card")
      );
      if (cards.length < 2) return;

      cards.forEach((card) => card.classList.remove("is-wrapped-row"));
      const firstRowTop = Math.round(cards[0].offsetTop);
      cards.forEach((card) => {
        const rowTop = Math.round(card.offsetTop);
        card.classList.toggle("is-wrapped-row", rowTop > firstRowTop + 4);
      });
    });
  }

  function scheduleOwnedRoomRowSeparators() {
    if (!ownedRoomLists.length || ownedRoomSeparatorFrame) return;
    ownedRoomSeparatorFrame = window.requestAnimationFrame(refreshOwnedRoomRowSeparators);
  }

  async function refreshRoomListFromServer() {
    const currentRoomListWrap = document.querySelector(".rp-room-list-wrap");
    if (!currentRoomListWrap) return;

    const response = await fetch(window.location.pathname + window.location.search, {
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });
    if (!response.ok) {
      throw new Error(`Roomlist refresh failed with status ${response.status}`);
    }

    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const nextRoomListWrap = parsed.querySelector(".rp-room-list-wrap");
    if (!(nextRoomListWrap instanceof HTMLElement)) {
      throw new Error("Updated roomlist markup missing");
    }

    currentRoomListWrap.replaceWith(nextRoomListWrap);
    collectRoomTargets();
    syncPresenceSubscriptions();
  }

  function queueRoomListRefresh() {
    if (roomListRefreshPromise) {
      roomListRefreshQueued = true;
      return;
    }

    roomListRefreshPromise = refreshRoomListFromServer()
      .catch((error) => {
        console.error("roomlist refresh failed", error);
      })
      .finally(() => {
        roomListRefreshPromise = null;
        if (roomListRefreshQueued) {
          roomListRefreshQueued = false;
          queueRoomListRefresh();
        }
      });
  }

  function renderRoomWatchTarget(target, entries) {
    target.replaceChildren();
    const visibleEntries = Array.isArray(entries)
      ? entries.filter((entry) => !isIgnoredRoomEntry(entry))
      : [];
    const namedEntries = visibleEntries.filter((entry) => entry?.is_npc !== true);
    const watchMode = String(target?.dataset?.roomWatchMode || "").trim().toLowerCase();
    if (watchMode === "count-only") {
      const countState = document.createElement("span");
      countState.className = "muted";
      countState.textContent = `User Online: ${namedEntries.length}`;
      target.appendChild(countState);
      scheduleOwnedRoomRowSeparators();
      return;
    }

    if (!namedEntries.length) {
      const emptyState = document.createElement("span");
      emptyState.className = "muted";
      emptyState.textContent = "Gerade niemand dort.";
      target.appendChild(emptyState);
      scheduleOwnedRoomRowSeparators();
      return;
    }

    namedEntries.forEach((entry, index) => {
      target.appendChild(createOccupantNode(entry));
      if (index < namedEntries.length - 1) {
        const separator = document.createElement("span");
        separator.className = "rp-room-occupant-separator";
        separator.textContent = ", ";
        target.appendChild(separator);
      }
    });
    scheduleOwnedRoomRowSeparators();
  }

  function applyRoomStateToTarget(payload) {
    const roomKey = payload?.roomId == null ? "" : String(payload.roomId);
    const watchServerId = String(payload?.serverId || "")
      .trim()
      .toLowerCase();
    const isLocked = Boolean(payload?.isLocked);
    const canEnter = Boolean(payload?.canEnter);

    roomLockTargets.forEach((target) => {
      const targetRoomKey = String(target.dataset.roomLockRoom || "");
      const targetServerId = String(target.dataset.roomLockServer || "")
        .trim()
        .toLowerCase();

      if (targetRoomKey !== roomKey || targetServerId !== watchServerId) {
        return;
      }

      target.classList.toggle("is-visible", isLocked);
      target.setAttribute("aria-hidden", isLocked ? "false" : "true");
      target.title = isLocked ? "Raum ist abgeschlossen" : "";
    });

    roomLinkTargets.forEach((target) => {
      const targetRoomKey = String(target.dataset.roomLinkRoom || "");
      const targetServerId = String(target.dataset.roomLinkServer || "")
        .trim()
        .toLowerCase();

      if (targetRoomKey !== roomKey || targetServerId !== watchServerId) {
        return;
      }

      const roomUrl = String(target.dataset.roomLinkUrl || "").trim();
      target.classList.toggle("is-disabled", !canEnter);
      target.setAttribute("aria-disabled", canEnter ? "false" : "true");
      target.title = canEnter ? "Raum betreten" : "Raum ist abgeschlossen";
      target.href = canEnter ? roomUrl : "#";
    });
  }

  socket.on("connect", () => {
    syncPresenceSubscriptions();
  });

  if (!isRoomListPage) {
    socket.on("user:display-profile", updateHeaderIdentity);
  }

  socket.on("room:watch:update", (payload) => {
    const roomKey = payload?.roomId == null ? "" : String(payload.roomId);
    const watchServerId = String(payload?.serverId || "")
      .trim()
      .toLowerCase();
    const watchStandardRoomId = String(payload?.standardRoomId || "")
      .trim()
      .toLowerCase();
    roomWatchPayloads.set(
      getRoomWatchPayloadKey(payload?.roomId, watchServerId, watchStandardRoomId),
      Array.isArray(payload?.users) ? payload.users.slice() : []
    );

    roomWatchTargets.forEach((target) => {
      const targetRoomKey = String(target.dataset.roomWatchRoom || "");
      const targetServerId = String(target.dataset.roomWatchServer || "")
        .trim()
        .toLowerCase();
      const targetStandardRoomId = String(target.dataset.roomWatchStandardRoom || "")
        .trim()
        .toLowerCase();

      if (
        targetRoomKey !== roomKey ||
        targetServerId !== watchServerId ||
        targetStandardRoomId !== watchStandardRoomId
      ) {
        return;
      }

      renderRoomWatchTarget(target, payload?.users);
    });
  });

  window.addEventListener("app:social-state", (event) => {
    socialState = normalizeSocialState(event?.detail || {});
    roomWatchTargets.forEach((target) => {
      const targetRoomKey = String(target.dataset.roomWatchRoom || "");
      const targetServerId = String(target.dataset.roomWatchServer || "")
        .trim()
        .toLowerCase();
      const targetStandardRoomId = String(target.dataset.roomWatchStandardRoom || "")
        .trim()
        .toLowerCase();
      const payloadEntries = roomWatchPayloads.get(
        getRoomWatchPayloadKey(targetRoomKey || null, targetServerId, targetStandardRoomId)
      ) || [];
      renderRoomWatchTarget(target, payloadEntries);
    });
  });

  socket.on("room:state:update", applyRoomStateToTarget);

  socket.on("roomlist:refresh", (payload) => {
    const refreshServerId = String(payload?.serverId || "")
      .trim()
      .toLowerCase();
    if (refreshServerId && refreshServerId !== serverId) {
      return;
    }

    queueRoomListRefresh();
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      window.location.reload();
      return;
    }

    if (socket.connected) {
      syncPresenceSubscriptions();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      return;
    }

    if (socket.connected) {
      syncPresenceSubscriptions();
      return;
    }

    socket.connect();
  });

  window.addEventListener("resize", scheduleOwnedRoomRowSeparators);
  scheduleOwnedRoomRowSeparators();
})();
