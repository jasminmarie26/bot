(() => {
  const searchInput = document.getElementById("members-search");
  const cards = Array.from(document.querySelectorAll("[data-member-card]"));
  const sections = Array.from(document.querySelectorAll("[data-members-section]"));
  const status = document.getElementById("members-search-status");
  if (!searchInput || !status || !cards.length) return;

  function updateStatus(visibleCount, query) {
    const trimmedQuery = String(query || "").trim();
    status.textContent = trimmedQuery
      ? `${visibleCount} Treffer für "${trimmedQuery}".`
      : `${visibleCount} Charaktere gefunden.`;
  }

  function applyFilter() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;
    const hasNameMatch =
      query.length > 0 &&
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
        section.hidden = query.length > 0;
        return;
      }

      const visibleSectionCards = sectionCards.filter((card) => !card.hidden);
      section.hidden = visibleSectionCards.length === 0;
    });

    updateStatus(visibleCount, searchInput.value);
  }

  searchInput.addEventListener("input", applyFilter);
  applyFilter();
})();
