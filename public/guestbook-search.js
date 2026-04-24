(() => {
  const root = document.querySelector("[data-guestbook-search-root]");
  const toggleButton = root?.querySelector("[data-guestbook-search-show]");
  const panel = root?.querySelector("[data-guestbook-search-panel]");
  const form = root?.querySelector("[data-guestbook-search-form]");
  const input = root?.querySelector("[data-guestbook-search-input]");
  const results = root?.querySelector("[data-guestbook-search-results]");
  const status = root?.querySelector("[data-guestbook-search-status]");
  const serverGroup = root?.querySelector("[data-guestbook-search-server-group]");
  const serverFilters = root?.querySelector("[data-guestbook-search-server-filters]");
  const letterGroup = root?.querySelector("[data-guestbook-search-letter-group]");
  const letterFilters = root?.querySelector("[data-guestbook-search-letter-filters]");
  const tagGroup = root?.querySelector("[data-guestbook-search-tag-group]");
  const tagFilters = root?.querySelector("[data-guestbook-search-tag-filters]");
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

  const normalize = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const normalizeComparable = (value) => normalize(value).replace(/[^a-z0-9]+/g, "");

  const normalizeServerId = (value) => String(value || "").trim().toLowerCase();

  const normalizeTagList = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }

    const seen = new Set();
    return value
      .map((entry) => String(entry || "").trim())
      .filter((entry) => {
        const normalizedEntry = normalize(entry);
        if (!normalizedEntry || seen.has(normalizedEntry)) {
          return false;
        }
        seen.add(normalizedEntry);
        return true;
      });
  };

  const getInitialLetter = (name) => {
    const firstCharacter = String(name || "").trim().charAt(0);
    const normalizedCharacter = normalize(firstCharacter).replace(/[^a-z0-9]/g, "").charAt(0);
    return normalizedCharacter ? normalizedCharacter.toUpperCase() : "#";
  };

  let currentServerId = "";
  let characters = [];

  try {
    const parsed = JSON.parse(dataElement.textContent || "{}");
    const payload = Array.isArray(parsed)
      ? { characters: parsed }
      : (parsed && typeof parsed === "object" ? parsed : {});

    currentServerId = normalizeServerId(payload.current_server_id);
    characters = Array.isArray(payload.characters)
      ? payload.characters
          .map((entry) => {
            const name = String(entry?.name || "").trim();
            const url = String(entry?.url || "").trim();
            const serverId = normalizeServerId(entry?.server_id);
            const tags = normalizeTagList(entry?.tags);
            return {
              id: Number(entry?.id),
              name,
              url,
              serverId,
              serverLabel: String(entry?.server_label || "").trim(),
              ownerUsername: String(entry?.owner_username || "").trim(),
              tags,
              normalizedName: normalize(name),
              comparableName: normalizeComparable(name),
              normalizedTags: tags.map((tag) => normalize(tag)),
              comparableTags: tags.map((tag) => normalizeComparable(tag)),
              initialLetter: getInitialLetter(name)
            };
          })
          .filter((entry) => entry.id > 0 && entry.name && entry.url)
      : [];
  } catch (_error) {
    currentServerId = "";
    characters = [];
  }

  if (!characters.length) {
    return;
  }

  const serverEntries = Array.from(
    characters.reduce((map, entry) => {
      if (!entry.serverId) {
        return map;
      }
      if (!map.has(entry.serverId)) {
        map.set(entry.serverId, {
          id: entry.serverId,
          label: entry.serverLabel || entry.serverId.toUpperCase()
        });
      }
      return map;
    }, new Map()).values()
  ).sort((left, right) => {
    if (left.id === currentServerId) return -1;
    if (right.id === currentServerId) return 1;
    return String(left.label || left.id).localeCompare(String(right.label || right.id), "de");
  });

  const getServerLabel = (serverId) => {
    if (!serverId) {
      return "Alle Server";
    }
    const match = serverEntries.find((entry) => entry.id === serverId);
    return match?.label || serverId.toUpperCase();
  };

  const state = {
    query: "",
    serverId: serverEntries.some((entry) => entry.id === currentServerId) ? currentServerId : "",
    letter: "",
    tag: ""
  };

  const hasActiveDiscoveryFilter = () => Boolean(state.query || state.letter || state.tag);

  const getScopedCharacters = () => (
    state.serverId
      ? characters.filter((entry) => entry.serverId === state.serverId)
      : characters
  );

  const getAvailableLetters = () => Array.from(
    new Set(getScopedCharacters().map((entry) => entry.initialLetter).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right, "de"));

  const getAvailableTags = () => Array.from(
    getScopedCharacters().reduce((set, entry) => {
      entry.tags.forEach((tag) => {
        if (tag) {
          set.add(tag);
        }
      });
      return set;
    }, new Set())
  ).sort((left, right) => left.localeCompare(right, "de"));

  const renderFilterButtons = (container, options, activeValue, type) => {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    container.innerHTML = "";
    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `guestbook-search-filter-btn${option.value === activeValue ? " is-active" : ""}`;
      button.dataset.filterType = type;
      button.dataset.filterValue = option.value;
      button.textContent = option.label;
      container.appendChild(button);
    });
  };

  const syncAvailableFilters = () => {
    const availableLetters = getAvailableLetters();
    const availableTags = getAvailableTags();

    if (state.letter && !availableLetters.includes(state.letter)) {
      state.letter = "";
    }

    if (state.tag && !availableTags.some((entry) => normalize(entry) === normalize(state.tag))) {
      state.tag = "";
    }

    if (serverGroup instanceof HTMLElement && serverFilters instanceof HTMLElement) {
      const serverOptions = [{ value: "", label: "Alle" }, ...serverEntries.map((entry) => ({
        value: entry.id,
        label: entry.label
      }))];
      serverGroup.hidden = serverOptions.length <= 2;
      renderFilterButtons(serverFilters, serverOptions, state.serverId, "server");
    }

    if (letterGroup instanceof HTMLElement && letterFilters instanceof HTMLElement) {
      letterGroup.hidden = availableLetters.length < 1;
      renderFilterButtons(
        letterFilters,
        availableLetters.map((entry) => ({ value: entry, label: entry })),
        state.letter,
        "letter"
      );
    }

    if (tagGroup instanceof HTMLElement && tagFilters instanceof HTMLElement) {
      tagGroup.hidden = availableTags.length < 1;
      renderFilterButtons(
        tagFilters,
        availableTags.map((entry) => ({ value: entry, label: entry })),
        state.tag,
        "tag"
      );
    }
  };

  const getMatches = () => {
    const normalizedQuery = normalize(state.query);
    const comparableQuery = normalizeComparable(state.query);
    return getScopedCharacters()
      .filter((entry) => {
        if (state.letter && entry.initialLetter !== state.letter) {
          return false;
        }

        if (state.tag) {
          const normalizedSelectedTag = normalize(state.tag);
          if (!entry.normalizedTags.includes(normalizedSelectedTag)) {
            return false;
          }
        }

        if (!normalizedQuery) {
          return true;
        }

        return (
          entry.normalizedName.includes(normalizedQuery) ||
          entry.normalizedTags.some((tag) => tag.includes(normalizedQuery)) ||
          (comparableQuery
            ? (
                entry.comparableName.includes(comparableQuery) ||
                entry.comparableTags.some((tag) => tag.includes(comparableQuery))
              )
            : false)
        );
      })
      .sort((left, right) => {
        if (normalizedQuery) {
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
        }

        return left.name.localeCompare(right.name, "de");
      })
      .slice(0, 18);
  };

  const clearResults = () => {
    results.innerHTML = "";
    results.hidden = true;
  };

  let isOpen = false;

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

  const renderResults = () => {
    syncAvailableFilters();
    results.innerHTML = "";

    if (!hasActiveDiscoveryFilter()) {
      clearResults();
      status.hidden = false;
      status.textContent = "Wähle einen Buchstaben, einen Tag oder gib einen Namen ein.";
      return [];
    }

    const matches = getMatches();
    const selectedServerLabel = getServerLabel(state.serverId);
    status.hidden = false;

    if (!matches.length) {
      clearResults();
      status.textContent = state.serverId
        ? `Kein Gästebuch in ${selectedServerLabel} mit diesen Filtern gefunden.`
        : "Kein Gästebuch mit diesen Filtern gefunden.";
      return matches;
    }

    results.hidden = false;
    status.textContent = state.serverId
      ? `${matches.length} Treffer in ${selectedServerLabel}.`
      : `${matches.length} Treffer.`;

    matches.forEach((entry) => {
      const link = document.createElement("a");
      link.className = "guestbook-search-result";
      link.href = entry.url;

      const strong = document.createElement("strong");
      strong.textContent = entry.name;

      const small = document.createElement("small");
      const metaParts = [];
      if (entry.serverLabel) {
        metaParts.push(entry.serverLabel);
      }
      if (entry.ownerUsername) {
        metaParts.push(`Account: ${entry.ownerUsername}`);
      }
      small.textContent = metaParts.join(" · ") || "Gästebuch";

      link.append(strong, small);

      if (entry.tags.length) {
        const tagsWrap = document.createElement("div");
        tagsWrap.className = "guestbook-search-result-tags";
        entry.tags.slice(0, 4).forEach((tag) => {
          const chip = document.createElement("span");
          chip.className = "guestbook-search-tag";
          chip.textContent = tag;
          tagsWrap.appendChild(chip);
        });
        link.appendChild(tagsWrap);
      }

      results.appendChild(link);
    });

    return matches;
  };

  const rerender = () => {
    renderResults();
  };

  input.addEventListener("input", () => {
    state.query = input.value;
    rerender();
  });

  input.addEventListener("focus", () => {
    if (!isOpen) {
      isOpen = true;
      renderOpenState();
    }
    rerender();
  });

  toggleButton.addEventListener("click", () => {
    isOpen = !isOpen;
    renderOpenState();

    if (isOpen) {
      input.focus();
      input.select();
      rerender();
    }
  });

  [serverFilters, letterFilters, tagFilters].forEach((container) => {
    container?.addEventListener("click", (event) => {
      const button = event.target instanceof HTMLElement
        ? event.target.closest(".guestbook-search-filter-btn")
        : null;
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const type = String(button.dataset.filterType || "").trim();
      const value = String(button.dataset.filterValue || "").trim();

      if (type === "server") {
        state.serverId = value;
        state.letter = "";
        state.tag = "";
      } else if (type === "letter") {
        state.letter = state.letter === value ? "" : value;
      } else if (type === "tag") {
        state.tag = normalize(state.tag) === normalize(value) ? "" : value;
      }

      rerender();
    });
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
  syncAvailableFilters();
})();
