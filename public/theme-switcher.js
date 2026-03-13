(() => {
  const forms = Array.from(document.querySelectorAll(".theme-form"));
  if (!forms.length) return;

  const body = document.body;
  const themeClassPrefix = "theme-";

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

    const result = await response.json();
    return String(result?.theme || nextTheme || "").trim().toLowerCase();
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
      } catch (_error) {
        applyTheme(previousTheme);
        syncThemeSelects(previousTheme);
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
})();
