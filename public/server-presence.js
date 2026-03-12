(() => {
  const presenceSource = document.querySelector("[data-server-presence]");
  const roomWatchTargets = Array.from(document.querySelectorAll("[data-room-watch-target]"));
  if ((!presenceSource && roomWatchTargets.length === 0) || typeof io !== "function") return;

  const serverId = String(presenceSource?.dataset?.serverPresence || "")
    .trim()
    .toLowerCase();

  const socket = io();

  function createOccupantNode(entry) {
    const displayName = String(entry?.name || "").trim() || "Unbekannt";
    const characterId = Number(entry?.character_id);
    if (Number.isInteger(characterId) && characterId > 0) {
      const link = document.createElement("a");
      link.className = "rp-room-occupant";
      link.href = `/characters/${characterId}/guestbook`;
      link.textContent = displayName;
      return link;
    }

    const text = document.createElement("span");
    text.className = "rp-room-occupant";
    text.textContent = displayName;
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

  socket.on("connect", () => {
    if (serverId) {
      socket.emit("presence:set", { serverId });
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
})();
