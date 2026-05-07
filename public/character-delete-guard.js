(() => {
  const characterDeletePathPattern = /^\/characters\/\d+\/delete$/;

  function isCharacterDeleteForm(form) {
    if (!form || typeof form.getAttribute !== "function") return false;

    const action = String(form.getAttribute("action") || "").trim();
    if (!action) return false;

    try {
      const actionUrl = new URL(action, window.location.origin);
      return (
        actionUrl.origin === window.location.origin &&
        characterDeletePathPattern.test(actionUrl.pathname)
      );
    } catch {
      return false;
    }
  }

  function getSubmitControls(form) {
    return Array.from(
      form.querySelectorAll(
        'button[type="submit"], button:not([type]), input[type="submit"]'
      )
    );
  }

  function lockSubmitControls(form) {
    form.dataset.submitLocked = "true";
    getSubmitControls(form).forEach((control) => {
      control.disabled = true;
      control.setAttribute("aria-busy", "true");
    });
  }

  function unlockSubmitControls(form) {
    delete form.dataset.submitLocked;
    getSubmitControls(form).forEach((control) => {
      control.disabled = false;
      control.removeAttribute("aria-busy");
    });
  }

  function getCharacterIdFromDeleteForm(form) {
    const action = String(form?.getAttribute("action") || "").trim();
    try {
      const actionUrl = new URL(action, window.location.origin);
      const match = actionUrl.pathname.match(/^\/characters\/(\d+)\/delete$/);
      return match ? Number(match[1]) : 0;
    } catch {
      return 0;
    }
  }

  async function fetchCharacterDeleteImpact(characterId) {
    const response = await fetch(`/characters/${encodeURIComponent(String(characterId))}/delete-impact`, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (!response.ok) {
      return null;
    }

    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function buildFestplayDeleteWarning(impact) {
    const creatorFestplays = Array.isArray(impact?.creator_festplays)
      ? impact.creator_festplays
      : [];
    if (!creatorFestplays.length) {
      return "";
    }

    const festplayNames = creatorFestplays
      .map((festplay) => String(festplay?.name || "").trim())
      .filter(Boolean);
    const listText = festplayNames.length ? festplayNames.join(", ") : "dieses Festspiel";
    return `Dieser Charakter hat folgende Festspiele er\u00f6ffnet: ${listText}.\n\nWenn du den Charakter l\u00f6schst, werden diese Festspiele inklusive R\u00e4umen ebenfalls gel\u00f6scht. Trotzdem l\u00f6schen?`;
  }

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!isCharacterDeleteForm(form)) return;

    if (form.dataset.submitLocked === "true") {
      event.preventDefault();
      return;
    }

    if (event.defaultPrevented) return;

    const characterId = getCharacterIdFromDeleteForm(form);
    if (characterId > 0) {
      event.preventDefault();
      lockSubmitControls(form);

      try {
        const impact = await fetchCharacterDeleteImpact(characterId);
        const warning = buildFestplayDeleteWarning(impact);
        if (warning && !window.confirm(warning)) {
          unlockSubmitControls(form);
          return;
        }

        form.submit();
      } catch (_error) {
        form.submit();
      }
      return;
    }

    lockSubmitControls(form);
  });

  window.addEventListener("pageshow", () => {
    document
      .querySelectorAll('form[action^="/characters/"][action$="/delete"]')
      .forEach((form) => {
        if (isCharacterDeleteForm(form)) {
          unlockSubmitControls(form);
        }
      });
  });
})();
