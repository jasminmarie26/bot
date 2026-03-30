(() => {
  const toggle = document.querySelector("[data-character-notes-toggle]");
  const panel = document.querySelector("[data-character-notes-panel]");
  const closeButton = document.querySelector("[data-character-notes-close]");
  const form = document.querySelector("[data-character-notes-form]");
  const select = document.querySelector("[data-character-notes-select]");
  const input = document.querySelector("[data-character-notes-input]");
  const status = document.querySelector("[data-character-notes-status]");
  const saveButton = document.querySelector("[data-character-notes-save]");

  if (!toggle || !panel || !form || !select || !input || !status || !saveButton) {
    return;
  }

  let activeCharacterId = Number(toggle.dataset.characterNotesSelectedCharacterId || select.value || "");
  let requestSequence = 0;
  let isBusy = false;

  function setBusy(nextBusy) {
    isBusy = nextBusy;
    select.disabled = nextBusy;
    input.disabled = nextBusy;
    saveButton.disabled = nextBusy;
  }

  function setStatus(message, { error = false } = {}) {
    status.textContent = String(message || "").trim();
    status.classList.toggle("is-error", error);
  }

  function isOpen() {
    return !panel.hidden;
  }

  function formatUpdatedAt(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) {
      return "";
    }

    const isoCandidate = value.includes("T") ? value : value.replace(" ", "T");
    const parsedDate = new Date(isoCandidate);
    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(parsedDate);
    } catch (_error) {
      return "";
    }
  }

  async function loadNote(characterId, { focusInput = false } = {}) {
    const parsedCharacterId = Number(characterId);
    if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 1) {
      input.value = "";
      activeCharacterId = null;
      setStatus("Kein Charakter ausgewählt.", { error: true });
      return;
    }

    const currentRequest = ++requestSequence;
    activeCharacterId = parsedCharacterId;
    setBusy(true);
    setStatus("Notiz wird geladen...");

    try {
      const response = await window.fetch(`/character-notes/${parsedCharacterId}`, {
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("load_failed");
      }

      const payload = await response.json();
      if (currentRequest !== requestSequence) {
        return;
      }

      input.value = String(payload?.content || "");
      const updatedAtLabel = formatUpdatedAt(payload?.updated_at);
      setStatus(
        input.value.trim()
          ? updatedAtLabel
            ? `Zuletzt gespeichert: ${updatedAtLabel}`
            : "Notiz geladen."
          : "Noch keine Notiz gespeichert."
      );

      if (focusInput) {
        window.requestAnimationFrame(() => {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        });
      }
    } catch (_error) {
      if (currentRequest !== requestSequence) {
        return;
      }
      input.value = "";
      setStatus("Notiz konnte nicht geladen werden.", { error: true });
    } finally {
      if (currentRequest === requestSequence) {
        setBusy(false);
      }
    }
  }

  function openPanel() {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.classList.add("is-open");
    loadNote(Number(select.value || activeCharacterId || ""), {
      focusInput: true
    });
  }

  function closePanel() {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.classList.remove("is-open");
  }

  toggle.addEventListener("click", () => {
    if (isOpen()) {
      closePanel();
      return;
    }

    openPanel();
  });

  closeButton?.addEventListener("click", closePanel);

  select.addEventListener("change", () => {
    loadNote(Number(select.value || ""), {
      focusInput: true
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const parsedCharacterId = Number(select.value || activeCharacterId || "");
    if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 1 || isBusy) {
      return;
    }

    setBusy(true);
    setStatus("Notiz wird gespeichert...");

    try {
      const response = await window.fetch(`/character-notes/${parsedCharacterId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: new URLSearchParams({
          content: input.value
        }).toString(),
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("save_failed");
      }

      const payload = await response.json();
      input.value = String(payload?.content || "");
      activeCharacterId = parsedCharacterId;
      const updatedAtLabel = formatUpdatedAt(payload?.updated_at);
      setStatus(
        updatedAtLabel
          ? `${String(payload?.message || "Notiz gespeichert.").trim()} ${updatedAtLabel}`
          : String(payload?.message || "Notiz gespeichert.").trim()
      );
    } catch (_error) {
      setStatus("Notiz konnte nicht gespeichert werden.", { error: true });
    } finally {
      setBusy(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      closePanel();
    }
  });

  document.addEventListener("mousedown", (event) => {
    if (!isOpen()) {
      return;
    }
    if (panel.contains(event.target) || toggle.contains(event.target)) {
      return;
    }
    closePanel();
  });
})();
