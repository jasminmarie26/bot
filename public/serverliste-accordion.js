(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const exclusiveSections = document.querySelectorAll("[data-serverlist-exclusive-section]");
    if (!exclusiveSections.length) {
      return;
    }

    exclusiveSections.forEach((section) => {
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
    });
  });
})();
