(() => {
  const pageRoot = document.querySelector("[data-rp-board-page-root]");
  const linkRoots = Array.from(document.querySelectorAll("[data-rp-board-link-root]"));
  const contextRoot = pageRoot || linkRoots[0];
  if (!contextRoot) return;

  const badgeNodes = linkRoots
    .map((link) => link.querySelector("[data-rp-board-badge]"))
    .filter((node) => node instanceof HTMLElement);
  const form = pageRoot?.querySelector("[data-rp-board-form]") || null;
  const input = pageRoot?.querySelector("[data-rp-board-input]") || null;
  const list = pageRoot?.querySelector("[data-rp-board-list]") || null;
  const emptyState = pageRoot?.querySelector("[data-rp-board-empty]") || null;
  const serverId = String(contextRoot.dataset.rpBoardServerId || "").trim().toLowerCase();
  const festplayId = Number(contextRoot.dataset.rpBoardFestplayId || 0);
  const characterId = Number(contextRoot.dataset.rpBoardCharacterId || 0);
  const normalizedFestplayId = Number.isInteger(festplayId) && festplayId > 0 ? festplayId : 0;
  const canUseRealtimeUpdates = typeof io === "function";
  const requestBaseParams = new URLSearchParams({
    server_id: serverId,
    festplay_id: String(normalizedFestplayId),
    character_id: String(Number.isInteger(characterId) && characterId > 0 ? characterId : 0)
  });
  const storageKey = `rp-board-unread:${serverId}:${normalizedFestplayId}`;
  let requestSequence = 0;

  if (!serverId || !Number.isInteger(characterId) || characterId < 1) {
    return;
  }

  function formatBadgeCount(count) {
    return count > 99 ? "99+" : String(count);
  }

  function updateBadge(count) {
    const unreadCount = Number(count || 0);
    badgeNodes.forEach((badge) => {
      if (!Number.isFinite(unreadCount) || unreadCount < 1) {
        badge.hidden = true;
        badge.textContent = "0";
        return;
      }

      badge.hidden = false;
      badge.textContent = formatBadgeCount(unreadCount);
    });
  }

  function broadcastUnreadCount(count) {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          unreadCount: Number(count || 0),
          updatedAt: Date.now()
        })
      );
    } catch (_error) {
    }
  }

  function renderEntries(entries) {
    if (!list || !emptyState) return;

    list.replaceChildren();
    const safeEntries = Array.isArray(entries) ? entries : [];
    if (!safeEntries.length) {
      list.hidden = true;
      emptyState.hidden = false;
      return;
    }

    list.hidden = false;
    emptyState.hidden = true;

    safeEntries.forEach((entry) => {
      const article = document.createElement("article");
      article.className = "rp-board-entry";

      const head = document.createElement("div");
      head.className = "rp-board-entry-head";

      const authorWrap = document.createElement("div");
      authorWrap.className = "rp-board-entry-author-wrap";

      let authorNode;
      if (Number(entry?.character_id) > 0) {
        authorNode = document.createElement("a");
        authorNode.href = `/characters/${Number(entry.character_id)}/guestbook`;
        authorNode.target = "_blank";
        authorNode.rel = "noopener noreferrer";
      } else {
        authorNode = document.createElement("span");
      }

      authorNode.className = "rp-board-entry-author";
      authorNode.textContent = String(entry?.author_name || "").trim() || "Unbekannt";
      if (entry?.author_chat_text_color) {
        authorNode.style.color = String(entry.author_chat_text_color);
      }
      authorWrap.appendChild(authorNode);

      const meta = document.createElement("div");
      meta.className = "rp-board-entry-meta";

      const time = document.createElement("time");
      time.className = "rp-board-entry-time";
      time.textContent = String(entry?.created_at || "").trim();
      meta.appendChild(time);

      if (entry?.can_delete) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "rp-board-entry-delete";
        deleteButton.dataset.entryId = String(Number(entry?.id || 0));
        deleteButton.setAttribute("aria-label", "Eintrag loeschen");
        deleteButton.title = "Eintrag loeschen";
        deleteButton.textContent = "\u00d7";
        meta.appendChild(deleteButton);
      }

      head.appendChild(authorWrap);
      head.appendChild(meta);

      const body = document.createElement("p");
      body.className = "rp-board-entry-body";
      body.textContent = String(entry?.content || "");

      article.appendChild(head);
      article.appendChild(body);
      list.appendChild(article);
    });
  }

  function applyState(payload, options = {}) {
    const broadcast = options.broadcast !== false;
    const unreadCount = Number(payload?.unreadCount || 0);
    updateBadge(unreadCount);
    renderEntries(payload?.entries || []);
    if (broadcast) {
      broadcastUnreadCount(unreadCount);
    }
  }

  async function fetchBoardState() {
    const response = await window.fetch(`/rp-board/state?${requestBaseParams.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });
    if (!response.ok) {
      throw new Error("rp_board_state_failed");
    }
    return response.json();
  }

  async function postBoardForm(url, extraParams) {
    const body = new URLSearchParams(requestBaseParams);
    Object.entries(extraParams || {}).forEach(([key, value]) => {
      body.set(key, String(value ?? ""));
    });

    const response = await window.fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: body.toString()
    });
    if (!response.ok) {
      throw new Error("rp_board_post_failed");
    }
    return response.json();
  }

  async function loadState(options = {}) {
    const requestId = ++requestSequence;
    const payload = await fetchBoardState();
    if (requestId !== requestSequence) {
      return null;
    }
    applyState(payload, options);
    return payload;
  }

  async function markBoardRead(options = {}) {
    const payload = await postBoardForm("/rp-board/read", {});
    applyState(payload, options);
    return payload;
  }

  async function refreshBoardState() {
    try {
      if (pageRoot && document.visibilityState !== "hidden") {
        await markBoardRead();
      } else {
        await loadState();
      }
    } catch (error) {
      console.error("rp board refresh failed", error);
    }
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const content = String(input?.value || "").trim();
      if (!content) {
        return;
      }

      try {
        const payload = await postBoardForm("/rp-board/entries", { content });
        applyState(payload);
        input.value = "";
        input.focus();
      } catch (error) {
        console.error("rp board entry failed", error);
      }
    });
  }

  if (list) {
    list.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const deleteButton = target.closest(".rp-board-entry-delete");
      if (!deleteButton) return;

      const entryId = Number(deleteButton.dataset.entryId || 0);
      if (!Number.isInteger(entryId) || entryId < 1) {
        return;
      }

      try {
        const payload = await postBoardForm(`/rp-board/entries/${entryId}/delete`, {});
        applyState(payload);
      } catch (error) {
        console.error("rp board delete failed", error);
      }
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey || !event.newValue) {
      return;
    }

    try {
      const payload = JSON.parse(event.newValue);
      updateBadge(payload?.unreadCount || 0);
    } catch (_error) {
    }
  });

  if (pageRoot) {
    markBoardRead().catch((error) => {
      console.error("rp board initial read failed", error);
      loadState().catch((innerError) => {
        console.error("rp board initial load failed", innerError);
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        markBoardRead().catch((error) => {
          console.error("rp board visibility read failed", error);
        });
      }
    });

    window.addEventListener("focus", () => {
      markBoardRead().catch((error) => {
        console.error("rp board focus read failed", error);
      });
    });
  } else {
    loadState().catch((error) => {
      console.error("rp board initial load failed", error);
    });
  }

  if (canUseRealtimeUpdates) {
    const socket = io({
      transports: ["websocket"]
    });

    socket.on("connect", () => {
      socket.emit("rp-board:watch", {
        serverId,
        festplayId: normalizedFestplayId,
        characterId
      });
    });

    socket.on("rp-board:changed", (payload) => {
      const payloadServerId = String(payload?.serverId || "").trim().toLowerCase();
      const payloadFestplayId = Number(payload?.festplayId || 0);
      if (payloadServerId !== serverId) {
        return;
      }
      if (payloadFestplayId !== normalizedFestplayId) {
        return;
      }

      refreshBoardState();
    });
  }
})();
