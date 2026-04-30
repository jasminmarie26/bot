(() => {
  const forms = Array.from(document.querySelectorAll(".theme-form"));
  if (!forms.length) return;

  const body = document.body;
  const root = document.documentElement;
  const themeClassPrefix = "theme-";
  const themeStorageKeyBase = "active-theme-preview";
  let desiredTheme = "";

  function stripThemeClasses(element) {
    if (!element) return;

    for (const className of Array.from(element.classList)) {
      if (className.startsWith(themeClassPrefix)) {
        element.classList.remove(className);
      }
    }
  }

  function applyTheme(themeId) {
    if (!body || !themeId) return;

    desiredTheme = themeId;
    stripThemeClasses(body);
    stripThemeClasses(root);

    body.classList.add(`${themeClassPrefix}${themeId}`);
    root.classList.add(`${themeClassPrefix}${themeId}`);
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

  function getThemeStorageKey(form) {
    const characterField = form?.elements?.character_id;
    const characterId = String(characterField?.value || body?.dataset?.themeCharacterId || "")
      .trim();
    return characterId ? `${themeStorageKeyBase}:character:${characterId}` : themeStorageKeyBase;
  }

  function persistThemeLocally(themeId, form) {
    try {
      window.localStorage.setItem(getThemeStorageKey(form), themeId);
    } catch (_error) {
      // Ignore storage failures; the live switch still works for the current page.
    }
  }

  function getPersistedLocalTheme(form) {
    try {
      return String(window.localStorage.getItem(getThemeStorageKey(form)) || "").trim().toLowerCase();
    } catch (_error) {
      return "";
    }
  }

  function setThemeCharacterId(characterId) {
    const normalizedCharacterId = String(characterId || "").trim();
    if (body) {
      body.dataset.themeCharacterId = normalizedCharacterId;
    }

    for (const form of forms) {
      const characterField = form?.elements?.character_id;
      if (characterField) {
        characterField.value = normalizedCharacterId;
      }
    }
  }

  async function saveTheme(form, nextTheme) {
    const returnField = form.elements.return_to;
    let returnTo = window.location.pathname + window.location.search + window.location.hash;
    if (returnField && typeof returnField.value === "string") {
      returnTo = returnField.value.split("#")[0] + window.location.hash;
    }

    const payload = new URLSearchParams();
    payload.set("theme", nextTheme);
    payload.set("return_to", returnTo);
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
      persistThemeLocally(nextTheme, form);

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
        persistThemeLocally(persistedTheme, form);
      } catch (_error) {
        applyTheme(nextTheme);
        syncThemeSelects(nextTheme);
        persistThemeLocally(nextTheme, form);
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

  const localTheme = getPersistedLocalTheme(forms[0]);
  if (localTheme) {
    applyTheme(localTheme);
    syncThemeSelects(localTheme);
  }

  window.addEventListener("app:active-character-change", (event) => {
    const characterId = Number(event?.detail?.characterId);
    if (!Number.isInteger(characterId) || characterId < 1) return;

    setThemeCharacterId(characterId);
    const scopedTheme = getPersistedLocalTheme(forms[0]);
    if (scopedTheme) {
      applyTheme(scopedTheme);
      syncThemeSelects(scopedTheme);
    }
  });

  if (body && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(() => {
      if (!desiredTheme) return;
      const expectedClass = `${themeClassPrefix}${desiredTheme}`;
      if (!body.classList.contains(expectedClass) || (root && !root.classList.contains(expectedClass))) {
        applyTheme(desiredTheme);
      }
    });

    observer.observe(body, { attributes: true, attributeFilter: ["class"] });
    if (root) {
      observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    }
  }
})();
