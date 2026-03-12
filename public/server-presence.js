(() => {
  const presenceSource = document.querySelector("[data-server-presence]");
  if (!presenceSource || typeof io !== "function") return;

  const serverId = String(presenceSource.dataset.serverPresence || "")
    .trim()
    .toLowerCase();

  if (!serverId) return;

  const socket = io();

  socket.on("connect", () => {
    socket.emit("presence:set", { serverId });
  });
})();
