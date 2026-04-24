(() => {
  const searchInput = document.getElementById("members-search");
  const cards = Array.from(document.querySelectorAll("[data-member-card]"));
  const sections = Array.from(document.querySelectorAll("[data-members-section]"));
  const groups = Array.from(document.querySelectorAll("[data-members-group]"));
  const status = document.getElementById("members-search-status");
  if (!searchInput || !status || !cards.length) return;

  function updateStatus(visibleCount, query) {
    const trimmedQuery = String(query || "").trim();
    status.textContent = trimmedQuery
      ? `${visibleCount} Treffer f\u00FCr "${trimmedQuery}".`
      : `${visibleCount} Charaktere gefunden.`;
  }

  function syncCollapsibleState(element, hasVisibleCards, hasQuery) {
    if (!(element instanceof HTMLDetailsElement)) return;

    if (hasQuery) {
      if (!Object.prototype.hasOwnProperty.call(element.dataset, "membersOpenBeforeSearch")) {
        element.dataset.membersOpenBeforeSearch = element.open ? "true" : "false";
      }

      if (hasVisibleCards) {
        element.open = true;
      }
      return;
    }

    if (Object.prototype.hasOwnProperty.call(element.dataset, "membersOpenBeforeSearch")) {
      element.open = element.dataset.membersOpenBeforeSearch === "true";
      delete element.dataset.membersOpenBeforeSearch;
    }
  }

  function applyFilter() {
    const query = searchInput.value.trim().toLowerCase();
    const hasQuery = query.length > 0;
    const visibleIds = new Set();

    groups.forEach((group) => {
      group.hidden = false;
    });

    cards.forEach((card) => {
      const group = card.closest("[data-members-group]");
      const groupLabel = (group?.dataset.membersGroupLabel || "").toLowerCase();
      const memberName = card.dataset.memberName || "";
      const haystack = [
        memberName,
        card.dataset.memberOwner || "",
        card.dataset.memberServer || "",
        card.dataset.memberRole || ""
      ].join(" ");
      const isVisible = !query
        ? true
        : haystack.includes(query) || groupLabel.includes(query);
      card.hidden = !isVisible;
      if (isVisible) {
        visibleIds.add(card.dataset.memberId || memberName);
      }
    });

    groups.forEach((group) => {
      const groupCards = Array.from(group.querySelectorAll("[data-member-card]"));
      const hasVisibleCards = groupCards.some((card) => !card.hidden);
      syncCollapsibleState(group, hasVisibleCards, hasQuery);
      group.hidden = !hasVisibleCards;
    });

    sections.forEach((section) => {
      const sectionCards = Array.from(section.querySelectorAll("[data-member-card]"));
      if (!sectionCards.length) {
        section.hidden = hasQuery;
        return;
      }

      const visibleSectionCards = sectionCards.filter((card) => !card.hidden);
      const hasVisibleCards = visibleSectionCards.length > 0;
      syncCollapsibleState(section, hasVisibleCards, hasQuery);
      section.hidden = !hasVisibleCards;
    });

    updateStatus(visibleIds.size, searchInput.value);
  }

  searchInput.addEventListener("input", applyFilter);
  applyFilter();
})();
