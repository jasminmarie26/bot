(() => {
  const panel = document.querySelector("[data-guestbook-panel]");
  const toggle = document.querySelector("[data-guestbook-panel-toggle]");
  const closeButtons = document.querySelectorAll("[data-guestbook-panel-close]");
  const topbar = document.querySelector(".topbar");

  if (!panel || !toggle) return;

  const entryHash = () => window.location.hash.startsWith("#guestbook-entry-");
  const guestbookPanelStateKey = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageId = urlParams.get("page_id") || "default";
    return `guestbook-panel:${window.location.pathname}:${pageId}`;
  })();

  const readPersistedPanelState = () => {
    try {
      return window.sessionStorage.getItem(guestbookPanelStateKey);
    } catch (_error) {
      return null;
    }
  };

  const persistPanelState = (expanded) => {
    try {
      window.sessionStorage.setItem(guestbookPanelStateKey, expanded ? "open" : "closed");
    } catch (_error) {
      // Ignore storage errors and keep the panel working normally.
    }
  };

  const syncGuestbookOffsets = () => {
    if (!topbar) return;

    const topbarRect = topbar.getBoundingClientRect();
    const offset = Math.max(0, Math.round(topbarRect.top + topbarRect.height));

    document.documentElement.style.setProperty("--guestbook-top-offset", `${offset}px`);
    document.documentElement.style.setProperty("--guestbook-panel-top-offset", `${offset}px`);
  };

  const updatePanelState = (expanded, options = {}) => {
    const shouldScrollToEntry = Boolean(options.scrollToEntry);

    panel.hidden = !expanded;
    document.documentElement.classList.toggle("guestbook-panel-open", expanded);
    document.body.classList.toggle("guestbook-panel-open", expanded);
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    persistPanelState(expanded);

    const actionLabel = expanded
      ? "Gästebuch-Einträge schließen"
      : "Gästebuch-Einträge öffnen";

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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      updatePanelState(false);
    }
  });

  syncGuestbookOffsets();
  window.addEventListener("resize", syncGuestbookOffsets);
  window.addEventListener("load", syncGuestbookOffsets, { once: true });

  const persistedPanelState = readPersistedPanelState();
  const shouldAutoOpen = panel.dataset.autoOpen === "true" || entryHash();
  const initialOpen = shouldAutoOpen || persistedPanelState === "open";

  updatePanelState(initialOpen, {
    scrollToEntry: entryHash()
  });
})();
