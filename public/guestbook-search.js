(() => {
  const root = document.querySelector("[data-guestbook-search-root]");
  const toggleButton = root?.querySelector("[data-guestbook-search-show]");
  const panel = root?.querySelector("[data-guestbook-search-panel]");
  const form = root?.querySelector("[data-guestbook-search-form]");
  const input = root?.querySelector("[data-guestbook-search-input]");
  const results = root?.querySelector("[data-guestbook-search-results]");
  const status = root?.querySelector("[data-guestbook-search-status]");
  const dataElement = document.getElementById("guestbook-search-data");

  if (!root || !toggleButton || !panel || !form || !input || !results || !status || !dataElement) {
    return;
  }

  let characters = [];
  try {
    const parsed = JSON.parse(dataElement.textContent || "[]");
    characters = Array.isArray(parsed)
      ? parsed
          .map((entry) => ({
            id: Number(entry?.id),
            name: String(entry?.name || "").trim(),
            serverLabel: String(entry?.server_label || "").trim(),
            url: String(entry?.url || "").trim()
          }))
          .filter((entry) => entry.id > 0 && entry.name && entry.url)
      : [];
  } catch (_error) {
    characters = [];
  }

  const normalize = (value) => String(value || "").trim().toLowerCase();

  const getMatches = (query) => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
      return [];
    }

    return characters
      .filter((entry) => normalize(entry.name).includes(normalizedQuery))
      .sort((left, right) => {
        const leftName = normalize(left.name);
        const rightName = normalize(right.name);
        const leftStarts = leftName.startsWith(normalizedQuery) ? 0 : 1;
        const rightStarts = rightName.startsWith(normalizedQuery) ? 0 : 1;
        if (leftStarts !== rightStarts) {
          return leftStarts - rightStarts;
        }
        return leftName.localeCompare(rightName, "de");
      })
      .slice(0, 7);
  };

  const clearResults = () => {
    results.innerHTML = "";
    results.hidden = true;
    status.hidden = true;
    status.textContent = "";
  };

  let isOpen = false;

  const renderOpenState = () => {
    panel.hidden = !isOpen;
    toggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggleButton.classList.toggle("is-active", isOpen);

    if (!isOpen) {
      clearResults();
    }
  };

  const renderResults = () => {
    const matches = getMatches(input.value);
    const normalizedQuery = normalize(input.value);
    results.innerHTML = "";

    if (!normalizedQuery) {
      clearResults();
      return matches;
    }

    status.hidden = false;

    if (!matches.length) {
      results.hidden = true;
      status.textContent = "Kein G\u00e4stebuch mit diesem Charakternamen gefunden.";
      return matches;
    }

    results.hidden = false;
    status.textContent = `${matches.length} Treffer.`;

    matches.forEach((entry) => {
      const link = document.createElement("a");
      link.className = "guestbook-search-result";
      link.href = entry.url;

      const strong = document.createElement("strong");
      strong.textContent = entry.name;

      const small = document.createElement("small");
      small.textContent = entry.serverLabel || "Gastbuch";

      link.append(strong, small);
      results.appendChild(link);
    });

    return matches;
  };

  input.addEventListener("input", renderResults);
  input.addEventListener("focus", () => {
    if (!isOpen) {
      isOpen = true;
      renderOpenState();
    }
    renderResults();
  });

  toggleButton.addEventListener("click", () => {
    isOpen = !isOpen;
    renderOpenState();

    if (isOpen) {
      input.focus();
      input.select();
      renderResults();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (root.contains(event.target)) {
      return;
    }

    if (!isOpen) {
      return;
    }

    isOpen = false;
    renderOpenState();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isOpen) {
      return;
    }

    isOpen = false;
    renderOpenState();
    toggleButton.focus();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const matches = renderResults();
    if (matches[0]?.url) {
      window.location.href = matches[0].url;
    }
  });

  renderOpenState();
})();
