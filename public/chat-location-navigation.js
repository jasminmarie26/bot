(() => {
  const rememberLocationUrl = "/chat/location";

  const buildLocationPayload = (link) => {
    const characterId = String(link.dataset.chatLocationCharacter || "").trim();
    const roomId = String(link.dataset.chatLocationRoom || "").trim();
    const standardRoomId = String(link.dataset.chatLocationStandardRoom || "").trim();
    const serverId = String(link.dataset.chatLocationServer || "").trim();

    if (!characterId || (!roomId && !standardRoomId)) {
      return null;
    }

    const payload = new URLSearchParams();
    payload.set("c", characterId);
    if (roomId) {
      payload.set("room_id", roomId);
    }
    if (standardRoomId) {
      payload.set("standard_room", standardRoomId);
    }
    if (serverId) {
      payload.set("server", serverId);
    }

    return payload;
  };

  document.addEventListener("click", (event) => {
    const link = event.target?.closest?.("[data-chat-location-link]");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target ||
      link.getAttribute("aria-disabled") === "true"
    ) {
      return;
    }

    const payload = buildLocationPayload(link);
    if (!payload) {
      return;
    }

    event.preventDefault();

    fetch(rememberLocationUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Requested-With": "fetch"
      },
      body: payload
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("chat location failed"))))
      .then((data) => {
        window.location.assign(String(data?.url || link.href));
      })
      .catch(() => {
        window.location.assign(link.href);
      });
  });
})();
