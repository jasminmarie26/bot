(() => {
  const loadedFamilies = new Set();
  const loadedStylesheets = new Set();

  const normalizeFamily = (value) => String(value || "")
    .trim()
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);

  const isSafeFamily = (value) => /^[A-Za-z0-9][A-Za-z0-9 '&-]*$/i.test(value);

  const appendStylesheet = (href) => {
    const normalizedHref = String(href || "").trim();
    if (!normalizedHref || loadedStylesheets.has(normalizedHref)) {
      return;
    }

    loadedStylesheets.add(normalizedHref);

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = normalizedHref;
    document.head.appendChild(link);
  };

  const loadFamily = (familyName) => {
    const normalizedFamily = normalizeFamily(familyName);
    if (!normalizedFamily || !isSafeFamily(normalizedFamily) || loadedFamilies.has(normalizedFamily)) {
      return;
    }

    loadedFamilies.add(normalizedFamily);
    appendStylesheet(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(normalizedFamily).replace(/%20/g, "+")}&display=swap`
    );
    appendStylesheet(
      `/bbcode-fonts/1001freefonts.css?family=${encodeURIComponent(normalizedFamily)}`
    );
  };

  const scanRoot = (root) => {
    if (!root) {
      return;
    }

    const candidates = [];
    if (root instanceof Element && root.hasAttribute("data-bb-font-family")) {
      candidates.push(root);
    }
    if (root.querySelectorAll) {
      candidates.push(...root.querySelectorAll("[data-bb-font-family]"));
    }

    candidates.forEach((node) => {
      loadFamily(node.getAttribute("data-bb-font-family"));
    });
  };

  const boot = () => {
    scanRoot(document);

    if (typeof MutationObserver !== "function" || !document.body) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            scanRoot(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
