(() => {
  const panel = document.querySelector("[data-guestbook-panel]");
  const toggle = document.querySelector("[data-guestbook-panel-toggle]");
  const closeButtons = document.querySelectorAll("[data-guestbook-panel-close]");

  if (!panel || !toggle) return;

  const entryHash = () => window.location.hash.startsWith("#guestbook-entry-");

  const updatePanelState = (expanded, options = {}) => {
    const shouldScrollToEntry = Boolean(options.scrollToEntry);

    panel.hidden = !expanded;
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    const actionLabel = expanded ? "Gästebuch-Einträge schließen" : "Gästebuch-Einträge öffnen";
    toggle.setAttribute("aria-label", actionLabel);
    toggle.setAttribute("title", actionLabel);

    if (expanded && shouldScrollToEntry) {
      window.requestAnimationFrame(() => {
        const targetEntry = panel.querySelector(window.location.hash);
        targetEntry?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
  };

  toggle.addEventListener("click", () => {
    updatePanelState(panel.hidden);
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      updatePanelState(false);
    });
  });

  document.addEventListener("click", (event) => {
    if (panel.hidden) return;
    if (panel.contains(event.target) || toggle.contains(event.target)) return;
    updatePanelState(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      updatePanelState(false);
    }
  });

  updatePanelState(panel.dataset.autoOpen === "true" || entryHash(), {
    scrollToEntry: entryHash()
  });
})();
