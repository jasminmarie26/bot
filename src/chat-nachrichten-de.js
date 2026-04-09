function buildRaumPraesenzNachricht(kind, displayName) {
  const safeName = String(displayName || "").trim() || "Jemand";
  const isLeave = kind === "leave";
  const suffix = isLeave ? "Verlässt den Chat" : "Betritt den Chat";

  return {
    text: `${safeName}: ${suffix}`,
    actorName: safeName,
    suffix,
    kind: isLeave ? "leave" : "enter"
  };
}

module.exports = {
  buildRaumPraesenzNachricht
};
