(() => {
  const mq = window.matchMedia("(max-width: 720px)");

  function layoutCharacterRowBreaks() {
    if (mq.matches) {
      document.querySelectorAll(".serverlist-overview-character-row-break").forEach((el) => el.remove());
      return;
    }

    document.querySelectorAll(".serverlist-overview-character-grid").forEach((grid) => {
      grid.querySelectorAll(".serverlist-overview-character-row-break").forEach((el) => el.remove());
      const cards = [...grid.querySelectorAll(":scope > .serverlist-overview-character-card")];
      if (cards.length < 2) {
        return;
      }

      const tops = cards.map((c) => Math.round(c.getBoundingClientRect().top));
      const insertIdx = [];
      for (let i = 1; i < cards.length; i += 1) {
        if (tops[i] > tops[i - 1]) {
          insertIdx.push(i);
        }
      }
      for (let k = insertIdx.length - 1; k >= 0; k -= 1) {
        const idx = insertIdx[k];
        const div = document.createElement("div");
        div.className = "serverlist-overview-character-row-break";
        div.setAttribute("aria-hidden", "true");
        grid.insertBefore(div, cards[idx]);
      }
    });
  }

  function scheduleLayout() {
    requestAnimationFrame(() => {
      requestAnimationFrame(layoutCharacterRowBreaks);
    });
  }

  let resizeTimer;
  let roTimer;

  document.addEventListener("DOMContentLoaded", () => {
    scheduleLayout();

    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(scheduleLayout, 120);
    });

    mq.addEventListener("change", scheduleLayout);

    if (typeof ResizeObserver !== "undefined") {
      document.querySelectorAll(".serverlist-overview-character-grid").forEach((grid) => {
        const ro = new ResizeObserver(() => {
          clearTimeout(roTimer);
          roTimer = setTimeout(scheduleLayout, 60);
        });
        ro.observe(grid);
      });
    }
  });
})();
