document.addEventListener("DOMContentLoaded", async () => {
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const themeSunIcon = document.getElementById("theme-sun-icon");
  const themeMoonIcon = document.getElementById("theme-moon-icon");

  const settingsBtn = document.getElementById("settings-btn");
  const settingsModal = document.getElementById("settings-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const settingsAppUrl = document.getElementById("settings-app-url");
  const settingsToken = document.getElementById("settings-token");
  const settingsLoadBtn = document.getElementById("settings-load-btn");
  const modalError = document.getElementById("modal-error");
  const loadBtnText = document.getElementById("load-btn-text");

  const customSelect = document.getElementById("custom-select");
  const customSelectTrigger = document.getElementById("custom-select-trigger");
  const customSelectText = document.getElementById("custom-select-text");
  const customSelectArrow = document.getElementById("custom-select-arrow");
  const customSelectMenu = document.getElementById("custom-select-menu");
  const tableSelect = document.getElementById("table-select");

  const nameInput = document.getElementById("name-input");
  const duplicateWarning = document.getElementById("duplicate-warning");
  const addBtn = document.getElementById("add-btn");
  const addBtnText = document.getElementById("add-btn-text");
  const statusToast = document.getElementById("status-toast");

  let activeTabUrl = "";
  let currentAppUrl = "";
  let currentToken = "";
  const tableRowsCache = new Map();
  let toastTimer = null;

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    if (theme === "dark") {
      themeSunIcon.classList.remove("hidden");
      themeMoonIcon.classList.add("hidden");
    } else {
      themeSunIcon.classList.add("hidden");
      themeMoonIcon.classList.remove("hidden");
    }
  }

  async function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    await chrome.storage.local.set({ extension_theme: next });
  }

  function showToast(message, isError = false) {
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    statusToast.textContent = message;
    statusToast.style.backgroundColor = isError ? "#ef4444" : "";
    statusToast.classList.remove("hidden");
    toastTimer = setTimeout(() => {
      statusToast.classList.add("hidden");
    }, 2800);
  }

  function closeCustomSelect() {
    customSelectMenu.classList.add("hidden");
    customSelectArrow.classList.remove("open");
    customSelectTrigger.setAttribute("aria-expanded", "false");
  }

  function openCustomSelect() {
    if (customSelectTrigger.disabled) {
      return;
    }
    customSelectMenu.classList.remove("hidden");
    customSelectArrow.classList.add("open");
    customSelectTrigger.setAttribute("aria-expanded", "true");
  }

  function toggleCustomSelect() {
    if (customSelectTrigger.disabled) {
      return;
    }
    const isClosed = customSelectMenu.classList.contains("hidden");
    if (isClosed) {
      openCustomSelect();
    } else {
      closeCustomSelect();
    }
  }

  function setSelectState(message, disabled = true) {
    customSelectText.textContent = message;
    customSelectTrigger.disabled = disabled;
    customSelectMenu.innerHTML = "";
    closeCustomSelect();
    tableSelect.innerHTML = `<option value="" disabled selected>${message}</option>`;
    tableSelect.value = "";
    if (disabled) {
      addBtn.disabled = true;
    }
  }

  function setSelectedTable(tableId, tableDescription) {
    tableSelect.value = String(tableId);
    customSelectText.textContent = tableDescription;

    const options = customSelectMenu.querySelectorAll(".custom_option");
    options.forEach((opt) => {
      const isSelected = opt.dataset.value === String(tableId);
      opt.classList.toggle("selected", isSelected);
      opt.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function renderCustomOptions(tables, selectedId) {
    customSelectMenu.innerHTML = "";
    tableSelect.innerHTML = "";

    for (const table of tables) {
      const opt = document.createElement("option");
      opt.value = table.id;
      opt.textContent = table.description;
      tableSelect.appendChild(opt);

      const isSelected = String(table.id) === String(selectedId);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `custom_option${isSelected ? " selected" : ""}`;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", isSelected ? "true" : "false");
      btn.dataset.value = table.id;

      const span = document.createElement("span");
      span.className = "custom_option_text";
      span.textContent = table.description;

      const icon = document.createElement("i");
      icon.className = "fa-solid fa-check custom_option_check";

      btn.appendChild(span);
      btn.appendChild(icon);

      btn.addEventListener("click", async () => {
        closeCustomSelect();
        if (tableSelect.value !== String(table.id)) {
          setSelectedTable(table.id, table.description);
          await onTableSelected();
        }
      });

      customSelectMenu.appendChild(btn);
    }
  }

  function openSettingsModal() {
    closeCustomSelect();
    settingsAppUrl.value = currentAppUrl;
    settingsToken.value = currentToken;
    modalError.textContent = "";
    modalError.classList.add("hidden");
    settingsModal.classList.remove("hidden");
    settingsToken.focus();
  }

  function closeSettingsModal() {
    settingsModal.classList.add("hidden");
    modalError.classList.add("hidden");
  }

  function checkDuplicateName() {
    const selectedTableId = tableSelect.value;
    if (!selectedTableId) {
      duplicateWarning.classList.add("hidden");
      return;
    }

    const currentName = nameInput.value.trim().toLowerCase();
    if (!currentName) {
      duplicateWarning.classList.add("hidden");
      return;
    }

    const rows = tableRowsCache.get(selectedTableId) || [];
    const exists = rows.some((row) => row.name && row.name.trim().toLowerCase() === currentName);

    if (exists) {
      duplicateWarning.classList.remove("hidden");
    } else {
      duplicateWarning.classList.add("hidden");
    }
  }

  async function fetchTableRows(tableId) {
    if (tableRowsCache.has(tableId)) {
      return tableRowsCache.get(tableId);
    }

    try {
      const response = await fetch(`${currentAppUrl}/${encodeURIComponent(tableId)}/table_details`, {
        credentials: "omit",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return [];
      }

      const rows = await response.json();
      tableRowsCache.set(tableId, rows);
      return rows;
    } catch {
      return [];
    }
  }

  async function onTableSelected() {
    const tableId = tableSelect.value;
    if (!tableId) {
      duplicateWarning.classList.add("hidden");
      return;
    }

    await chrome.storage.local.set({ last_table_id: tableId });
    await fetchTableRows(tableId);
    checkDuplicateName();
  }

  async function loadTablesList(preferredTableId = null) {
    setSelectState("Loading tables...", true);
    addBtn.disabled = true;

    if (!currentAppUrl || !currentToken) {
      setSelectState("Configure Settings to load tables", true);
      addBtn.disabled = true;
      return false;
    }

    try {
      const response = await fetch(`${currentAppUrl}/tables`, {
        credentials: "omit",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        setSelectState("Invalid or expired token", true);
        showToast("Invalid token. Please check settings.", true);
        return false;
      }

      if (!response.ok) {
        setSelectState("Error loading tables", true);
        showToast("Error connecting to server", true);
        return false;
      }

      const tables = await response.json();
      if (!Array.isArray(tables) || tables.length === 0) {
        setSelectState("No tables found", true);
        addBtn.disabled = true;
        return true;
      }

      customSelectTrigger.disabled = false;
      addBtn.disabled = false;

      let selectTarget = preferredTableId;
      if (!selectTarget || !tables.some((t) => String(t.id) === String(selectTarget))) {
        selectTarget = tables[0].id;
      }

      const selectedTable = tables.find((t) => String(t.id) === String(selectTarget)) || tables[0];
      renderCustomOptions(tables, selectedTable.id);
      setSelectedTable(selectedTable.id, selectedTable.description);

      await onTableSelected();
      return true;
    } catch {
      setSelectState("Connection error", true);
      showToast("Cannot reach application server", true);
      return false;
    }
  }

  async function handleAddRow() {
    const selectedTableId = tableSelect.value;
    if (!selectedTableId) {
      showToast("Please select a table", true);
      return;
    }

    const name = nameInput.value.trim();
    if (!name) {
      showToast("Annotation name cannot be empty", true);
      nameInput.focus();
      return;
    }

    const addBtnIcon = addBtn.querySelector(".btn_icon");
    addBtn.disabled = true;
    addBtnText.textContent = "Adding...";

    try {
      const payload = {
        table_id: selectedTableId,
        name: name,
        link: activeTabUrl || null,
        annotation: null,
      };

      const response = await fetch(`${currentAppUrl}/table_details`, {
        method: "POST",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        showToast("Failed to add row to table", true);
        addBtn.disabled = false;
        if (addBtnIcon) {
          addBtnIcon.className = "fa-solid fa-plus btn_icon";
        }
        addBtnText.textContent = "Add";
        return;
      }

      const createdRow = await response.json();
      const cached = tableRowsCache.get(selectedTableId) || [];
      cached.push(createdRow);
      tableRowsCache.set(selectedTableId, cached);

      nameInput.value = "";
      duplicateWarning.classList.add("hidden");

      showToast("Annotation added successfully!");
      if (addBtnIcon) {
        addBtnIcon.className = "fa-solid fa-check btn_icon";
      }
      addBtnText.textContent = "Added!";
      setTimeout(() => {
        addBtn.disabled = false;
        if (addBtnIcon) {
          addBtnIcon.className = "fa-solid fa-plus btn_icon";
        }
        addBtnText.textContent = "Add";
      }, 1200);
    } catch {
      showToast("Network error while adding row", true);
      addBtn.disabled = false;
      if (addBtnIcon) {
        addBtnIcon.className = "fa-solid fa-plus btn_icon";
      }
      addBtnText.textContent = "Add";
    }
  }

  async function handleSettingsSave() {
    let appUrl = settingsAppUrl.value.trim();
    const token = settingsToken.value.trim();

    if (!appUrl) {
      modalError.textContent = "Please provide the App URL";
      modalError.classList.remove("hidden");
      return;
    }

    if (!token) {
      modalError.textContent = "Please provide your access token";
      modalError.classList.remove("hidden");
      return;
    }

    appUrl = appUrl.replace(/\/+$/, "");

    settingsLoadBtn.disabled = true;
    loadBtnText.textContent = "Testing...";
    modalError.classList.add("hidden");

    try {
      const response = await fetch(`${appUrl}/tables`, {
        credentials: "omit",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        modalError.textContent = "Unauthorized: Token is invalid or expired";
        modalError.classList.remove("hidden");
        settingsLoadBtn.disabled = false;
        loadBtnText.textContent = "Load";
        return;
      }

      if (!response.ok) {
        modalError.textContent = `Server returned error (${response.status})`;
        modalError.classList.remove("hidden");
        settingsLoadBtn.disabled = false;
        loadBtnText.textContent = "Load";
        return;
      }

      currentAppUrl = appUrl;
      currentToken = token;

      await chrome.storage.local.set({
        app_url: currentAppUrl,
        user_token: currentToken,
      });

      closeSettingsModal();
      showToast("Settings saved successfully");
      tableRowsCache.clear();
      await loadTablesList();
    } catch {
      modalError.textContent = "Connection failed: URL unreachable";
      modalError.classList.remove("hidden");
    } finally {
      settingsLoadBtn.disabled = false;
      loadBtnText.textContent = "Load";
    }
  }

  const stored = await chrome.storage.local.get([
    "extension_theme",
    "app_url",
    "user_token",
    "last_table_id",
  ]);

  const initialTheme = stored.extension_theme || "dark";
  applyTheme(initialTheme);

  if (stored.app_url) {
    currentAppUrl = stored.app_url;
  }
  if (stored.user_token) {
    currentToken = stored.user_token;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      activeTabUrl = tab.url || "";
      nameInput.value = tab.title || "";
    }
  } catch {
    nameInput.value = "";
  }

  themeToggleBtn.addEventListener("click", toggleTheme);
  settingsBtn.addEventListener("click", openSettingsModal);
  modalCloseBtn.addEventListener("click", closeSettingsModal);
  settingsLoadBtn.addEventListener("click", handleSettingsSave);

  customSelectTrigger.addEventListener("click", toggleCustomSelect);

  document.addEventListener("click", (e) => {
    if (!customSelect.contains(e.target)) {
      closeCustomSelect();
    }
  });

  tableSelect.addEventListener("change", onTableSelected);
  nameInput.addEventListener("input", checkDuplicateName);
  addBtn.addEventListener("click", handleAddRow);

  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
      closeSettingsModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCustomSelect();
      if (!settingsModal.classList.contains("hidden")) {
        closeSettingsModal();
      }
    }
  });

  if (!currentToken) {
    openSettingsModal();
  } else {
    await loadTablesList(stored.last_table_id);
  }
});
