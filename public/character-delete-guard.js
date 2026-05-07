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

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!isCharacterDeleteForm(form)) return;

    if (form.dataset.submitLocked === "true") {
      event.preventDefault();
      return;
    }

    if (event.defaultPrevented) return;
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
