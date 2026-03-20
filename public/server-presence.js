(() => {
  const presenceSource = document.querySelector("[data-server-presence]");
  const headerIdentity = document.querySelector("[data-header-identity]");
  const roomWatchTargets = Array.from(document.querySelectorAll("[data-room-watch-target]"));
  const roomLockTargets = Array.from(document.querySelectorAll("[data-room-lock-target]"));
  const roomLinkTargets = Array.from(document.querySelectorAll("[data-room-link-target]"));
  if ((!presenceSource && roomWatchTargets.length === 0) || typeof io !== "function") return;

  const serverId = String(presenceSource?.dataset?.serverPresence || "")
    .trim()
    .toLowerCase();

  const socket = io({
    transports: ["websocket"]
  });

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
    if (Number.isInteger(characterId) && characterId > 0) {
      const link = document.createElement("a");
      link.className = "rp-room-occupant";
      link.href = `/characters/${characterId}/guestbook`;
      link.textContent = displayName;
      if (chatTextColor) {
        link.style.color = chatTextColor;
      }
      return link;
    }

    const text = document.createElement("span");
    text.className = "rp-room-occupant";
    text.textContent = displayName;
    if (chatTextColor) {
      text.style.color = chatTextColor;
    }
    return text;
  }

  function renderRoomWatchTarget(target, entries) {
    target.replaceChildren();
    if (!Array.isArray(entries) || entries.length === 0) {
      const emptyState = document.createElement("span");
      emptyState.className = "muted";
      emptyState.textContent = "Gerade niemand dort.";
      target.appendChild(emptyState);
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
})();
