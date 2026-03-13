(() => {
  const searchInput = document.getElementById("members-search");
  const cards = Array.from(document.querySelectorAll("[data-member-card]"));
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

    cards.forEach((card) => {
      const haystack = [
        card.dataset.memberName || "",
        card.dataset.memberOwner || "",
        card.dataset.memberServer || ""
      ].join(" ");
      const isVisible = !query || haystack.includes(query);
      card.hidden = !isVisible;
      if (isVisible) {
        visibleCount += 1;
      }
    });

    updateStatus(visibleCount, searchInput.value);
  }

  searchInput.addEventListener("input", applyFilter);
  applyFilter();
})();
