(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const exclusiveSections = document.querySelectorAll("[data-serverlist-exclusive-section]");
    if (!exclusiveSections.length) {
      return;
    }

    const groups = new Map();

    exclusiveSections.forEach((section) => {
      const groupName = String(section.dataset.serverlistExclusiveSection || "").trim();
      if (!groupName) {
        return;
      }

      const currentGroup = groups.get(groupName) || [];
      currentGroup.push(section);
      groups.set(groupName, currentGroup);
    });

    const closeGroupExcept = (groupName, activeSection) => {
      const groupSections = groups.get(groupName) || [];
      groupSections.forEach((otherSection) => {
        if (otherSection !== activeSection) {
          otherSection.open = false;
        }
      });
    };

    groups.forEach((groupSections) => {
      const openSections = groupSections.filter((section) => section.open);
      openSections.slice(1).forEach((section) => {
        section.open = false;
      });
    });

    exclusiveSections.forEach((section) => {
      const groupName = String(section.dataset.serverlistExclusiveSection || "").trim();
      const summary = section.querySelector(":scope > summary");

      if (summary) {
        summary.addEventListener("click", (event) => {
          if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea")) {
            return;
          }

          event.preventDefault();
          const nextOpenState = !section.open;
          if (nextOpenState) {
            closeGroupExcept(groupName, section);
          }
          section.open = nextOpenState;
        });
      }

      section.addEventListener("toggle", () => {
        if (!section.open) {
          return;
        }
        closeGroupExcept(groupName, section);
      });
    });
  });
})();
