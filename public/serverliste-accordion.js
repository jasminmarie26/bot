(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const exclusiveSections = document.querySelectorAll("[data-serverlist-exclusive-section]");
    if (!exclusiveSections.length) {
      return;
    }

    const buildStorageKey = (section, index) => {
      const groupName = String(section.dataset.serverlistExclusiveSection || "default").trim() || "default";
      return `serverlist:accordion:${window.location.pathname}:${groupName}:${index}`;
    };

    const readStoredOpenState = (key) => {
      try {
        const value = window.localStorage.getItem(key);
        if (value === "1") {
          return true;
        }
        if (value === "0") {
          return false;
        }
      } catch (_) {
        return null;
      }
      return null;
    };

    const writeStoredOpenState = (key, isOpen) => {
      try {
        window.localStorage.setItem(key, isOpen ? "1" : "0");
      } catch (_) {
        // ignore storage errors (private mode, quota, blocked storage)
      }
    };

    exclusiveSections.forEach((section, index) => {
      const storageKey = buildStorageKey(section, index);
      const storedOpenState = readStoredOpenState(storageKey);
      if (storedOpenState !== null) {
        section.open = storedOpenState;
      }

      const summary = section.querySelector(":scope > summary");

      if (summary) {
        summary.addEventListener("click", (event) => {
          if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea")) {
            return;
          }

          event.preventDefault();
          section.open = !section.open;
        });
      }

      section.addEventListener("toggle", () => {
        writeStoredOpenState(storageKey, section.open);
      });
    });
  });
})();
