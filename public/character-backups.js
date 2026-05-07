(() => {
  const initCharacterBackupSelection = () => {
    const root = document.querySelector("[data-character-backups-root]");
    if (!root) {
      return;
    }

    const panel = root.querySelector("[data-character-backup-panel]");
    if (!panel) {
      return;
    }

    const getSelections = () => Array.from(panel.querySelectorAll("[data-backup-character-select]"));
    const getSelectedSelections = () => getSelections().filter((input) => input.checked);

    const updateSelectionState = () => {
      const isSelecting = panel.classList.contains("is-selecting-backups");
      const selectedInputs = getSelectedSelections();
      const toggle = panel.querySelector("[data-backup-delete-selected-toggle]");

      getSelections().forEach((input) => {
        const card = input.closest("[data-backup-character-card]");
        card?.classList.toggle("is-backup-selected", input.checked);
      });

      if (toggle) {
        toggle.classList.toggle("is-active", isSelecting);
        toggle.setAttribute("aria-pressed", isSelecting ? "true" : "false");
        toggle.setAttribute(
          "aria-label",
          selectedInputs.length
            ? `${selectedInputs.length} ausgew\u00e4hlte Backups endg\u00fcltig l\u00f6schen`
            : "Gel\u00f6schte Charaktere zum L\u00f6schen ausw\u00e4hlen"
        );
        toggle.title = selectedInputs.length
          ? `${selectedInputs.length} ausgew\u00e4hlte Backups endg\u00fcltig l\u00f6schen`
          : "Gel\u00f6schte Charaktere zum L\u00f6schen ausw\u00e4hlen";
      }
    };

    const setSelectionMode = (enabled) => {
      panel.classList.toggle("is-selecting-backups", enabled);
      if (!enabled) {
        getSelections().forEach((input) => {
          input.checked = false;
        });
      }
      updateSelectionState();
    };

    const submitSelectedBackups = (selectedInputs) => {
      const form = panel.querySelector("[data-backup-delete-selected-form]");
      if (!form || !selectedInputs.length) {
        return;
      }

      const selectedNames = selectedInputs
        .map((input) => input.closest("[data-backup-character-card]")?.dataset.backupName || "")
        .filter(Boolean);
      const confirmText = selectedNames.length === 1
        ? `${selectedNames[0]} endg\u00fcltig l\u00f6schen? Danach kann der Charakter nie wieder wiederhergestellt werden.`
        : `${selectedNames.length} Backups endg\u00fcltig l\u00f6schen? Danach k\u00f6nnen die Charaktere nie wieder wiederhergestellt werden.`;

      if (!window.confirm(confirmText)) {
        return;
      }

      form.querySelectorAll('input[name="backup_ids"]').forEach((input) => input.remove());
      selectedInputs.forEach((input) => {
        const hiddenInput = document.createElement("input");
        hiddenInput.type = "hidden";
        hiddenInput.name = "backup_ids";
        hiddenInput.value = input.value;
        form.appendChild(hiddenInput);
      });
      form.submit();
    };

    const submitAllBackups = (button) => {
      const form = button.closest("[data-backup-delete-all-form]");
      if (!form) {
        return;
      }

      const count = Number(button.dataset.backupCount) || getSelections().length;
      const confirmText = count === 1
        ? "Diesen gel\u00f6schten Charakter endg\u00fcltig l\u00f6schen? Danach kann er nie wieder wiederhergestellt werden."
        : `${count} gel\u00f6schte Charaktere endg\u00fcltig l\u00f6schen? Danach k\u00f6nnen sie nie wieder wiederhergestellt werden.`;

      if (window.confirm(confirmText)) {
        form.submit();
      }
    };

    root.addEventListener("click", (event) => {
      const allToggle = event.target.closest("[data-backup-delete-all-toggle]");
      if (allToggle) {
        event.preventDefault();
        event.stopPropagation();
        submitAllBackups(allToggle);
        return;
      }

      const toggle = event.target.closest("[data-backup-delete-selected-toggle]");
      if (toggle) {
        event.preventDefault();
        event.stopPropagation();

        if (!panel.classList.contains("is-selecting-backups")) {
          setSelectionMode(true);
          return;
        }

        const selectedInputs = getSelectedSelections();
        if (!selectedInputs.length) {
          setSelectionMode(false);
          return;
        }

        submitSelectedBackups(selectedInputs);
        return;
      }

      const actions = event.target.closest("[data-backup-character-actions]");
      if (actions) {
        event.stopPropagation();
        return;
      }

      if (!panel.classList.contains("is-selecting-backups")) {
        return;
      }

      if (event.target.closest(".character-mini-actions")) {
        return;
      }

      const card = event.target.closest("[data-backup-character-card]");
      if (!card) {
        return;
      }

      const selectionInput = card.querySelector("[data-backup-character-select]");
      if (!selectionInput) {
        return;
      }

      if (event.target.closest(".backup-character-select")) {
        window.setTimeout(updateSelectionState, 0);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      selectionInput.checked = !selectionInput.checked;
      updateSelectionState();
    });

    root.addEventListener("change", (event) => {
      const selectionInput = event.target.closest("[data-backup-character-select]");
      if (selectionInput) {
        updateSelectionState();
      }
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCharacterBackupSelection);
  } else {
    initCharacterBackupSelection();
  }
})();
