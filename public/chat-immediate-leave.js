(() => {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) {
    return;
  }

  let socketId = "";
  let immediateChatLeaveSent = false;
  let serverRestartReloadInProgress = false;

  function setSocketId(value) {
    socketId = String(value || "").trim();
    if (!socketId) {
      immediateChatLeaveSent = false;
    }
  }

  function setServerRestartReloadInProgress(value) {
    serverRestartReloadInProgress = value === true;
  }

  function notifyImmediateChatLeave() {
    if (immediateChatLeaveSent || !socketId || serverRestartReloadInProgress) {
      return;
    }

    immediateChatLeaveSent = true;
    const payload = new URLSearchParams();
    payload.set("socketId", socketId);

    if (typeof window.navigator.sendBeacon === "function") {
      try {
        const sent = window.navigator.sendBeacon("/chat/disconnect-now", payload);
        if (sent) {
          return;
        }
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

  window.__chatImmediateLeave = {
    setSocketId,
    setServerRestartReloadInProgress,
    notifyImmediateChatLeave
  };

  window.addEventListener("beforeunload", notifyImmediateChatLeave);
  window.addEventListener("pagehide", notifyImmediateChatLeave);
})();
