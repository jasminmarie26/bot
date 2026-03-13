(() => {
  const forms = Array.from(document.querySelectorAll(".theme-form"));
  if (!forms.length) return;

  const body = document.body;
  const themeClassPrefix = "theme-";
  const themeStorageKey = "active-theme-preview";

  function applyTheme(themeId) {
    if (!body || !themeId) return;

    for (const className of Array.from(body.classList)) {
      if (className.startsWith(themeClassPrefix)) {
        body.classList.remove(className);
      }
    }

    body.classList.add(`${themeClassPrefix}${themeId}`);
  }

  function syncThemeSelects(themeId) {
    for (const form of forms) {
      const select = form.querySelector('select[name="theme"]');
      if (select) {
        select.value = themeId;
        select.dataset.savedTheme = themeId;
      }
    }
  }

  function persistThemeLocally(themeId) {
    try {
      window.localStorage.setItem(themeStorageKey, themeId);
    } catch (_error) {
      // Ignore storage failures; the live switch still works for the current page.
    }
  }

  function getPersistedLocalTheme() {
    try {
      return String(window.localStorage.getItem(themeStorageKey) || "").trim().toLowerCase();
    } catch (_error) {
      return "";
    }
  }

  async function saveTheme(form, nextTheme) {
    const returnField = form.elements.return_to;
    if (returnField && typeof returnField.value === "string") {
      returnField.value = returnField.value.split("#")[0] + window.location.hash;
    }

    const payload = new URLSearchParams(new FormData(form));
    const response = await fetch(form.action, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: payload
    });

    if (!response.ok) {
      throw new Error(`Theme switch failed with status ${response.status}`);
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      return nextTheme;
    }

    try {
      const result = await response.json();
      return String(result?.theme || nextTheme || "").trim().toLowerCase();
    } catch (_error) {
      return nextTheme;
    }
  }

  for (const form of forms) {
    const select = form.querySelector('select[name="theme"]');
    if (!select) continue;

    select.dataset.savedTheme = select.value;

    select.addEventListener("change", async () => {
      const nextTheme = String(select.value || "").trim().toLowerCase();
      const previousTheme = String(select.dataset.savedTheme || "").trim().toLowerCase();
      if (!nextTheme || nextTheme === previousTheme) return;

      applyTheme(nextTheme);
      syncThemeSelects(nextTheme);
      persistThemeLocally(nextTheme);

      for (const candidate of forms) {
        const candidateSelect = candidate.querySelector('select[name="theme"]');
        if (candidateSelect) {
          candidateSelect.disabled = true;
        }
      }

      try {
        const persistedTheme = await saveTheme(form, nextTheme);
        applyTheme(persistedTheme);
        syncThemeSelects(persistedTheme);
        persistThemeLocally(persistedTheme);
      } catch (_error) {
        applyTheme(nextTheme);
        syncThemeSelects(nextTheme);
        persistThemeLocally(nextTheme);
      } finally {
        for (const candidate of forms) {
          const candidateSelect = candidate.querySelector('select[name="theme"]');
          if (candidateSelect) {
            candidateSelect.disabled = false;
          }
        }
      }
    });
  }

  const localTheme = getPersistedLocalTheme();
  if (localTheme) {
    applyTheme(localTheme);
    syncThemeSelects(localTheme);
  }
})();
