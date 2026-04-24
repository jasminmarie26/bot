(() => {
  const searchInput = document.getElementById("members-search");
  const cards = Array.from(document.querySelectorAll("[data-member-card]"));
  const sections = Array.from(document.querySelectorAll("[data-members-section]"));
  const status = document.getElementById("members-search-status");
  if (!searchInput || !status || !cards.length) return;

  function updateStatus(visibleCount, query) {
    const trimmedQuery = String(query || "").trim();
    status.textContent = trimmedQuery
      ? `${visibleCount} Treffer f\u00FCr "${trimmedQuery}".`
      : `${visibleCount} Charaktere gefunden.`;
  }

  function syncCollapsibleSection(section, hasVisibleCards, hasQuery) {
    if (!(section instanceof HTMLDetailsElement)) return;

    if (hasQuery) {
      if (!Object.prototype.hasOwnProperty.call(section.dataset, "membersOpenBeforeSearch")) {
        section.dataset.membersOpenBeforeSearch = section.open ? "true" : "false";
      }

      if (hasVisibleCards) {
        section.open = true;
      }
      return;
    }

    if (Object.prototype.hasOwnProperty.call(section.dataset, "membersOpenBeforeSearch")) {
      section.open = section.dataset.membersOpenBeforeSearch === "true";
      delete section.dataset.membersOpenBeforeSearch;
    }
  }

  function applyFilter() {
    const query = searchInput.value.trim().toLowerCase();
    const hasQuery = query.length > 0;
    let visibleCount = 0;
    const hasNameMatch =
      hasQuery &&
      cards.some((card) => (card.dataset.memberName || "").includes(query));

    cards.forEach((card) => {
      const memberName = card.dataset.memberName || "";
      const haystack = [
        memberName,
        card.dataset.memberOwner || "",
        card.dataset.memberServer || ""
      ].join(" ");
      const isVisible = !query
        ? true
        : hasNameMatch
          ? memberName.includes(query)
          : haystack.includes(query);
      card.hidden = !isVisible;
      if (isVisible) {
        visibleCount += 1;
      }
    });

    sections.forEach((section) => {
      const sectionCards = Array.from(section.querySelectorAll("[data-member-card]"));
      if (!sectionCards.length) {
        section.hidden = hasQuery;
        return;
      }

      const visibleSectionCards = sectionCards.filter((card) => !card.hidden);
      const hasVisibleCards = visibleSectionCards.length > 0;
      syncCollapsibleSection(section, hasVisibleCards, hasQuery);
      section.hidden = !hasVisibleCards;
    });

    updateStatus(visibleCount, searchInput.value);
  }

  searchInput.addEventListener("input", applyFilter);
  applyFilter();
})();
