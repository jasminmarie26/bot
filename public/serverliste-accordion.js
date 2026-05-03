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

    exclusiveSections.forEach((section) => {
      section.addEventListener("toggle", () => {
        if (!section.open) {
          return;
        }

        const groupName = String(section.dataset.serverlistExclusiveSection || "").trim();
        const groupSections = groups.get(groupName) || [];

        groupSections.forEach((otherSection) => {
          if (otherSection !== section) {
            otherSection.open = false;
          }
        });
      });
    });
  });
})();
