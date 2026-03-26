(() => {
  const presenceSource = document.querySelector("[data-server-presence]");
  const headerIdentity = document.querySelector("[data-header-identity]");
  const roomWatchTargets = Array.from(document.querySelectorAll("[data-room-watch-target]"));
  const roomLockTargets = Array.from(document.querySelectorAll("[data-room-lock-target]"));
  const roomLinkTargets = Array.from(document.querySelectorAll("[data-room-link-target]"));
  const ownedRoomLists = Array.from(document.querySelectorAll(".rp-room-list-owned"));
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

  function updateHeaderIdentity(payload) {
    if (!headerIdentity) return;
    const nextName = String(payload?.name || "").trim();
    const nextColor = normalizeChatTextColor(payload?.chat_text_color);
    if (!nextName) return;

    headerIdentity.textContent = nextName;
    headerIdentity.title = nextName;
    headerIdentity.style.color = nextColor;
  }

  function createOccupantNode(entry) {
    const displayName = String(entry?.name || "").trim() || "Unbekannt";
    const characterId = Number(entry?.character_id);
    const chatTextColor = normalizeChatTextColor(entry?.chat_text_color);
    const hasRoomRights = Boolean(entry?.has_room_rights);
    if (Number.isInteger(characterId) && characterId > 0) {
      const link = document.createElement("a");
      link.className = "rp-room-occupant";
      if (hasRoomRights) {
        link.classList.add("has-room-rights");
      }
      link.href = `/characters/${characterId}/guestbook`;
      link.textContent = displayName;
      if (chatTextColor) {
        link.style.color = chatTextColor;
      }
      return link;
    }

    const text = document.createElement("span");
    text.className = "rp-room-occupant";
    if (hasRoomRights) {
      text.classList.add("has-room-rights");
    }
    text.textContent = displayName;
    if (chatTextColor) {
      text.style.color = chatTextColor;
    }
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

  function renderRoomWatchTarget(target, entries) {
    target.replaceChildren();
    if (!Array.isArray(entries) || entries.length === 0) {
      const emptyState = document.createElement("span");
      emptyState.className = "muted";
      emptyState.textContent = "Gerade niemand dort.";
      target.appendChild(emptyState);
      scheduleOwnedRoomRowSeparators();
      return;
    }

    entries.forEach((entry, index) => {
      target.appendChild(createOccupantNode(entry));
      if (index < entries.length - 1) {
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

  socket.on("user:display-profile", updateHeaderIdentity);

  socket.on("room:watch:update", (payload) => {
    const roomKey = payload?.roomId == null ? "" : String(payload.roomId);
    const watchServerId = String(payload?.serverId || "")
      .trim()
      .toLowerCase();

    roomWatchTargets.forEach((target) => {
      const targetRoomKey = String(target.dataset.roomWatchRoom || "");
      const targetServerId = String(target.dataset.roomWatchServer || "")
        .trim()
        .toLowerCase();

      if (targetRoomKey !== roomKey || targetServerId !== watchServerId) {
        return;
      }

      renderRoomWatchTarget(target, payload?.users);
    });
  });

  socket.on("room:state:update", applyRoomStateToTarget);

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
