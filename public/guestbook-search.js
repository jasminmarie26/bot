(() => {
  const root = document.querySelector("[data-guestbook-search-root]");
  const toggleButton = root?.querySelector("[data-guestbook-search-show]");
  const panel = root?.querySelector("[data-guestbook-search-panel]");
  const form = root?.querySelector("[data-guestbook-search-form]");
  const input = root?.querySelector("[data-guestbook-search-input]");
  const results = root?.querySelector("[data-guestbook-search-results]");
  const status = root?.querySelector("[data-guestbook-search-status]");
  const dataElement = document.getElementById("guestbook-search-data");

  if (
    !root ||
    !toggleButton ||
    !panel ||
    !form ||
    !input ||
    !results ||
    !status ||
    !dataElement
  ) {
    return;
  }

  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const normalizeComparable = (value) => normalize(value).replace(/[^a-z0-9]+/g, "");

  let characters = [];

  try {
    const parsed = JSON.parse(dataElement.textContent || "{}");
    const payload = Array.isArray(parsed)
      ? { characters: parsed }
      : (parsed && typeof parsed === "object" ? parsed : {});

    characters = Array.isArray(payload.characters)
      ? payload.characters
          .map((entry) => {
            const name = String(entry?.name || "").trim();
            const url = String(entry?.url || "").trim();
            return {
              id: Number(entry?.id),
              name,
              url,
              normalizedName: normalize(name),
              comparableName: normalizeComparable(name)
            };
          })
          .filter((entry) => entry.id > 0 && entry.name && entry.url)
      : [];
  } catch (_error) {
    characters = [];
  }

  if (!characters.length) {
    return;
  }

  let isOpen = false;

  const clearResults = () => {
    results.innerHTML = "";
    results.hidden = true;
  };

  const renderOpenState = () => {
    panel.hidden = !isOpen;
    toggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggleButton.classList.toggle("is-active", isOpen);

    if (!isOpen) {
      clearResults();
      status.hidden = true;
      status.textContent = "";
    }
  };

  const getMatches = () => {
    const rawQuery = String(input.value || "").trim();
    const normalizedQuery = normalize(rawQuery);
    const comparableQuery = normalizeComparable(rawQuery);

    if (!normalizedQuery) {
      return [];
    }

    return characters
      .filter((entry) =>
        entry.normalizedName.includes(normalizedQuery) ||
        (comparableQuery ? entry.comparableName.includes(comparableQuery) : false)
      )
      .sort((left, right) => {
        const leftStarts =
          left.normalizedName.startsWith(normalizedQuery) ||
          (comparableQuery && left.comparableName.startsWith(comparableQuery))
            ? 0
            : 1;
        const rightStarts =
          right.normalizedName.startsWith(normalizedQuery) ||
          (comparableQuery && right.comparableName.startsWith(comparableQuery))
            ? 0
            : 1;
        if (leftStarts !== rightStarts) {
          return leftStarts - rightStarts;
        }

        return left.name.localeCompare(right.name, "de");
      })
      .slice(0, 18);
  };

  const renderResults = () => {
    results.innerHTML = "";

    const rawQuery = String(input.value || "").trim();
    if (!rawQuery) {
      clearResults();
      status.hidden = false;
      status.textContent = "Gib einen Charakternamen ein.";
      return [];
    }

    const matches = getMatches();
    status.hidden = false;

    if (!matches.length) {
      clearResults();
      status.textContent = "Kein Gästebuch zu diesem Charakternamen gefunden.";
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

      link.appendChild(strong);
      results.appendChild(link);
    });

    return matches;
  };

  input.addEventListener("input", () => {
    renderResults();
  });

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
