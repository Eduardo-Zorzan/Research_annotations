import { deleteCookie } from "./cookies.js";
let modalBackdrop = null;
let modalWindow = null;
let closeBtn = null;
let backupStatusEl = null;
let backupTimeEl = null;
let downloadBackupBtn = null;
let generateBackupBtn = null;
let importBackupBtn = null;
let importFileInput = null;
let createTokenBtn = null;
let tokenResultContainer = null;
let tokenInput = null;
let copyTokenBtn = null;
let logoutBtn = null;
let toastEl = null;
let onDataChangedCallback = null;
export function applyTheme(theme) {
    localStorage.setItem("app_theme", theme);
    if (modalWindow) {
        const cards = modalWindow.querySelectorAll(".config_theme_card");
        cards.forEach((card) => {
            card.classList.toggle("active", card.dataset.themeOption === theme);
        });
    }
    let effectiveTheme = theme;
    if (theme === "system") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        effectiveTheme = prefersDark ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    document.body.setAttribute("data-theme", effectiveTheme);
}
export function initTheme() {
    const savedTheme = localStorage.getItem("app_theme") || "system";
    applyTheme(savedTheme);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        const currentTheme = localStorage.getItem("app_theme") || "system";
        if (currentTheme === "system") {
            const active = e.matches ? "dark" : "light";
            document.documentElement.setAttribute("data-theme", active);
            document.body.setAttribute("data-theme", active);
        }
    });
}
function showToast(message) {
    if (!toastEl)
        return;
    toastEl.innerHTML = `<i class="fa-solid fa-check"></i> ${message}`;
    toastEl.classList.add("show");
    setTimeout(() => {
        toastEl?.classList.remove("show");
    }, 2200);
}
async function fetchBackupInfo() {
    if (!backupStatusEl || !backupTimeEl)
        return;
    try {
        const res = await fetch("/backup/info");
        if (res.ok) {
            const data = await res.json();
            if (data.last_backup) {
                const dateObj = new Date(data.last_backup);
                const formattedDate = dateObj.toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                });
                backupStatusEl.textContent = "Backup Generated in";
                backupTimeEl.textContent = formattedDate;
                return;
            }
        }
    }
    catch (_) { }
    backupStatusEl.textContent = "No backup generated yet";
    backupTimeEl.textContent = "";
}
async function handleGenerateBackup() {
    if (!generateBackupBtn)
        return;
    generateBackupBtn.disabled = true;
    generateBackupBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Generating...';
    try {
        const res = await fetch("/backup/generate", { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            if (backupStatusEl && backupTimeEl) {
                const dateObj = new Date(data.created_at);
                const formattedDate = dateObj.toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                });
                backupStatusEl.textContent = "Backup Generated in";
                backupTimeEl.textContent = formattedDate;
            }
            showToast("Backup generated successfully!");
        }
        else {
            showToast("Failed to generate backup");
        }
    }
    catch (_) {
        showToast("Failed to generate backup");
    }
    finally {
        generateBackupBtn.disabled = false;
        generateBackupBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Generate new backup';
    }
}
async function handleDownloadBackup() {
    try {
        const res = await fetch("/backup/download");
        if (!res.ok) {
            try {
                const data = await res.json();
                if (data && data.error) {
                    showToast(data.error);
                    return;
                }
            }
            catch (_) { }
            showToast("No backup available on server. Please generate a backup first.");
            return;
        }
        const blob = await res.blob();
        const disposition = res.headers.get("content-disposition");
        let filename = "research_annotations_backup.json";
        if (disposition && disposition.includes("filename=")) {
            const match = disposition.match(/filename="?([^"]+)"?/);
            if (match && match[1]) {
                filename = match[1];
            }
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast("Backup downloaded successfully!");
    }
    catch (_) {
        showToast("Failed to download backup");
    }
}
let confirmBackdrop = null;
let confirmWindow = null;
let confirmCancelBtn = null;
let confirmActionBtn = null;
function createConfirmModalDOM() {
    if (confirmBackdrop)
        return;
    confirmBackdrop = document.createElement("div");
    confirmBackdrop.className = "confirm_modal_backdrop";
    confirmWindow = document.createElement("div");
    confirmWindow.className = "confirm_modal_window";
    const header = document.createElement("div");
    header.className = "confirm_modal_header";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-triangle-exclamation confirm_modal_icon";
    const title = document.createElement("h3");
    title.className = "confirm_modal_title";
    title.textContent = "Replace All Existing Data?";
    header.appendChild(icon);
    header.appendChild(title);
    const text = document.createElement("p");
    text.className = "confirm_modal_text";
    text.textContent =
        "Importing this backup will permanently delete all your existing tables and notes, replacing them with the imported data. Are you sure you want to proceed?";
    const actions = document.createElement("div");
    actions.className = "confirm_modal_actions";
    confirmCancelBtn = document.createElement("button");
    confirmCancelBtn.type = "button";
    confirmCancelBtn.className = "config_btn config_btn--secondary";
    confirmCancelBtn.textContent = "Cancel";
    confirmActionBtn = document.createElement("button");
    confirmActionBtn.type = "button";
    confirmActionBtn.className = "config_btn config_btn--danger";
    confirmActionBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> Replace & Import';
    actions.appendChild(confirmCancelBtn);
    actions.appendChild(confirmActionBtn);
    confirmWindow.appendChild(header);
    confirmWindow.appendChild(text);
    confirmWindow.appendChild(actions);
    confirmBackdrop.appendChild(confirmWindow);
    document.body.appendChild(confirmBackdrop);
}
function showImportConfirmation(payload) {
    createConfirmModalDOM();
    if (!confirmBackdrop || !confirmCancelBtn || !confirmActionBtn)
        return;
    const closeConfirm = () => {
        confirmBackdrop?.classList.remove("active");
    };
    const handleCancel = () => {
        closeConfirm();
    };
    const handleConfirm = async () => {
        if (!confirmActionBtn)
            return;
        confirmActionBtn.disabled = true;
        confirmActionBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Importing...';
        try {
            const res = await fetch("/backup/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                showToast("Backup imported and data replaced successfully!");
                onDataChangedCallback?.();
                fetchBackupInfo();
                closeConfirm();
            }
            else {
                showToast("Failed to import backup");
            }
        }
        catch (_) {
            showToast("Failed to import backup");
        }
        finally {
            if (confirmActionBtn) {
                confirmActionBtn.disabled = false;
                confirmActionBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> Replace & Import';
            }
        }
    };
    const newCancelBtn = confirmCancelBtn.cloneNode(true);
    const newActionBtn = confirmActionBtn.cloneNode(true);
    confirmCancelBtn.parentNode?.replaceChild(newCancelBtn, confirmCancelBtn);
    confirmActionBtn.parentNode?.replaceChild(newActionBtn, confirmActionBtn);
    confirmCancelBtn = newCancelBtn;
    confirmActionBtn = newActionBtn;
    confirmCancelBtn.addEventListener("click", handleCancel);
    confirmActionBtn.addEventListener("click", handleConfirm);
    confirmBackdrop.addEventListener("click", (e) => {
        if (e.target === confirmBackdrop) {
            closeConfirm();
        }
    });
    confirmBackdrop.classList.add("active");
}
async function handleFileImport(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file)
        return;
    try {
        const text = await file.text();
        const payload = JSON.parse(text);
        if (!payload || !Array.isArray(payload.tables)) {
            showToast("Invalid backup file structure");
            return;
        }
        showImportConfirmation(payload);
    }
    catch (_) {
        showToast("Invalid JSON file");
    }
    finally {
        input.value = "";
    }
}
async function handleCreateToken() {
    if (!createTokenBtn || !tokenResultContainer || !tokenInput || !copyTokenBtn)
        return;
    createTokenBtn.disabled = true;
    createTokenBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating...';
    try {
        const res = await fetch("/tokens", { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            tokenInput.value = data.token;
            tokenResultContainer.style.display = "flex";
            copyTokenBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
            copyTokenBtn.classList.remove("copied");
        }
        else {
            showToast("Failed to create token");
        }
    }
    catch (_) {
        showToast("Failed to create token");
    }
    finally {
        createTokenBtn.disabled = false;
        createTokenBtn.innerHTML = '<i class="fa-solid fa-key"></i> Create new token';
    }
}
async function handleCopyToken() {
    if (!tokenInput || !copyTokenBtn || !tokenInput.value)
        return;
    try {
        await navigator.clipboard.writeText(tokenInput.value);
        copyTokenBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        copyTokenBtn.classList.add("copied");
        showToast("Token copied to clipboard!");
        setTimeout(() => {
            if (copyTokenBtn) {
                copyTokenBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
                copyTokenBtn.classList.remove("copied");
            }
        }, 2500);
    }
    catch (_) {
        tokenInput.select();
        document.execCommand("copy");
        showToast("Token copied!");
    }
}
function handleLogout() {
    deleteCookie("token");
    window.location.href = "/";
}
function createConfigModalDOM() {
    if (modalBackdrop)
        return;
    modalBackdrop = document.createElement("div");
    modalBackdrop.className = "config_modal_backdrop";
    modalWindow = document.createElement("div");
    modalWindow.className = "config_modal_window";
    const header = document.createElement("div");
    header.className = "config_modal_header";
    const titleGroup = document.createElement("div");
    titleGroup.className = "config_modal_title_group";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-gear config_modal_icon";
    const title = document.createElement("h3");
    title.className = "config_modal_title";
    title.textContent = "Settings";
    titleGroup.appendChild(icon);
    titleGroup.appendChild(title);
    closeBtn = document.createElement("button");
    closeBtn.className = "config_modal_close";
    closeBtn.setAttribute("aria-label", "Close modal");
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    header.appendChild(titleGroup);
    header.appendChild(closeBtn);
    const body = document.createElement("div");
    body.className = "config_modal_body";
    const appearanceSection = document.createElement("section");
    appearanceSection.className = "config_section";
    const appearanceHeader = document.createElement("div");
    appearanceHeader.className = "config_section_header";
    const appearanceTitle = document.createElement("h4");
    appearanceTitle.className = "config_section_title";
    appearanceTitle.textContent = "APPEARANCE";
    const appearanceDivider = document.createElement("hr");
    appearanceDivider.className = "config_divider";
    appearanceHeader.appendChild(appearanceTitle);
    appearanceHeader.appendChild(appearanceDivider);
    const themeGrid = document.createElement("div");
    themeGrid.className = "config_theme_grid";
    const themes = [
        {
            id: "light",
            name: "Light",
            previewHtml: `
        <div class="config_theme_preview config_theme_preview--light">
          <div class="config_theme_inner">Aa</div>
          <span class="config_theme_check"><i class="fa-solid fa-circle-check"></i></span>
        </div>
        <span class="config_theme_label">Light</span>
      `,
        },
        {
            id: "dark",
            name: "Dark",
            previewHtml: `
        <div class="config_theme_preview config_theme_preview--dark">
          <div class="config_theme_inner">Aa</div>
          <span class="config_theme_check"><i class="fa-solid fa-circle-check"></i></span>
        </div>
        <span class="config_theme_label">Dark</span>
      `,
        },
        {
            id: "system",
            name: "System",
            previewHtml: `
        <div class="config_theme_preview config_theme_preview--system">
          <div class="config_theme_split config_theme_split--dark">
            <div class="config_theme_inner">Aa</div>
          </div>
          <div class="config_theme_split config_theme_split--light">
            <div class="config_theme_inner">Aa</div>
          </div>
          <span class="config_theme_check"><i class="fa-solid fa-circle-check"></i></span>
        </div>
        <span class="config_theme_label">System</span>
      `,
        },
    ];
    const currentSavedTheme = localStorage.getItem("app_theme") || "system";
    themes.forEach((t) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = `config_theme_card ${currentSavedTheme === t.id ? "active" : ""}`;
        card.dataset.themeOption = t.id;
        card.innerHTML = t.previewHtml;
        card.addEventListener("click", () => {
            applyTheme(t.id);
        });
        themeGrid.appendChild(card);
    });
    appearanceSection.appendChild(appearanceHeader);
    appearanceSection.appendChild(themeGrid);
    const backupSection = document.createElement("section");
    backupSection.className = "config_section";
    const backupHeader = document.createElement("div");
    backupHeader.className = "config_section_header";
    const backupTitle = document.createElement("h4");
    backupTitle.className = "config_section_title";
    backupTitle.textContent = "BACKUP";
    const backupDivider = document.createElement("hr");
    backupDivider.className = "config_divider";
    backupHeader.appendChild(backupTitle);
    backupHeader.appendChild(backupDivider);
    const backupBox = document.createElement("div");
    backupBox.className = "config_backup_box";
    const backupInfo = document.createElement("div");
    backupInfo.className = "config_backup_info";
    backupStatusEl = document.createElement("span");
    backupStatusEl.className = "config_backup_status";
    backupStatusEl.textContent = "Last Backup:";
    backupTimeEl = document.createElement("span");
    backupTimeEl.className = "config_backup_time";
    backupTimeEl.textContent = "Loading...";
    backupInfo.appendChild(backupStatusEl);
    backupInfo.appendChild(backupTimeEl);
    const backupActions = document.createElement("div");
    backupActions.className = "config_backup_actions";
    downloadBackupBtn = document.createElement("button");
    downloadBackupBtn.type = "button";
    downloadBackupBtn.className = "config_btn config_btn--secondary";
    downloadBackupBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download';
    downloadBackupBtn.addEventListener("click", handleDownloadBackup);
    importFileInput = document.createElement("input");
    importFileInput.type = "file";
    importFileInput.accept = ".json,application/json";
    importFileInput.style.display = "none";
    importFileInput.addEventListener("change", handleFileImport);
    importBackupBtn = document.createElement("button");
    importBackupBtn.type = "button";
    importBackupBtn.className = "config_btn config_btn--secondary";
    importBackupBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> Import';
    importBackupBtn.addEventListener("click", () => {
        importFileInput?.click();
    });
    generateBackupBtn = document.createElement("button");
    generateBackupBtn.type = "button";
    generateBackupBtn.className = "config_btn config_btn--primary";
    generateBackupBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Generate new backup';
    generateBackupBtn.addEventListener("click", handleGenerateBackup);
    backupActions.appendChild(downloadBackupBtn);
    backupActions.appendChild(importBackupBtn);
    backupActions.appendChild(importFileInput);
    backupActions.appendChild(generateBackupBtn);
    backupBox.appendChild(backupInfo);
    backupBox.appendChild(backupActions);
    backupSection.appendChild(backupHeader);
    backupSection.appendChild(backupBox);
    const tokenSection = document.createElement("section");
    tokenSection.className = "config_section";
    const tokenHeader = document.createElement("div");
    tokenHeader.className = "config_section_header";
    const tokenTitle = document.createElement("h4");
    tokenTitle.className = "config_section_title";
    tokenTitle.textContent = "TOKEN";
    const tokenDivider = document.createElement("hr");
    tokenDivider.className = "config_divider";
    tokenHeader.appendChild(tokenTitle);
    tokenHeader.appendChild(tokenDivider);
    const tokenBox = document.createElement("div");
    tokenBox.className = "config_token_box";
    const tokenActions = document.createElement("div");
    tokenActions.className = "config_token_actions";
    createTokenBtn = document.createElement("button");
    createTokenBtn.type = "button";
    createTokenBtn.className = "config_btn config_btn--primary";
    createTokenBtn.innerHTML = '<i class="fa-solid fa-key"></i> Create new token';
    createTokenBtn.addEventListener("click", handleCreateToken);
    tokenActions.appendChild(createTokenBtn);
    tokenResultContainer = document.createElement("div");
    tokenResultContainer.className = "config_token_result";
    tokenResultContainer.style.display = "none";
    const tokenWarning = document.createElement("div");
    tokenWarning.className = "config_token_warning";
    tokenWarning.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <span>Make sure to copy your new token now. You will not be able to see it again after closing this window. The token is valid for one year.</span>';
    const tokenDisplayRow = document.createElement("div");
    tokenDisplayRow.className = "config_token_display_row";
    tokenInput = document.createElement("input");
    tokenInput.type = "text";
    tokenInput.readOnly = true;
    tokenInput.className = "config_token_text";
    copyTokenBtn = document.createElement("button");
    copyTokenBtn.type = "button";
    copyTokenBtn.className = "config_token_copy_btn";
    copyTokenBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
    copyTokenBtn.addEventListener("click", handleCopyToken);
    tokenDisplayRow.appendChild(tokenInput);
    tokenDisplayRow.appendChild(copyTokenBtn);
    tokenResultContainer.appendChild(tokenWarning);
    tokenResultContainer.appendChild(tokenDisplayRow);
    tokenBox.appendChild(tokenActions);
    tokenBox.appendChild(tokenResultContainer);
    tokenSection.appendChild(tokenHeader);
    tokenSection.appendChild(tokenBox);
    const accountSection = document.createElement("section");
    accountSection.className = "config_section";
    const accountHeader = document.createElement("div");
    accountHeader.className = "config_section_header";
    const accountTitle = document.createElement("h4");
    accountTitle.className = "config_section_title";
    accountTitle.textContent = "ACCOUNT";
    const accountDivider = document.createElement("hr");
    accountDivider.className = "config_divider";
    accountHeader.appendChild(accountTitle);
    accountHeader.appendChild(accountDivider);
    const accountBox = document.createElement("div");
    accountBox.className = "config_account_box";
    logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "config_btn config_btn--danger config_logout_btn";
    logoutBtn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> Logout';
    logoutBtn.addEventListener("click", handleLogout);
    accountBox.appendChild(logoutBtn);
    accountSection.appendChild(accountHeader);
    accountSection.appendChild(accountBox);
    body.appendChild(appearanceSection);
    body.appendChild(backupSection);
    body.appendChild(tokenSection);
    body.appendChild(accountSection);
    toastEl = document.createElement("div");
    toastEl.className = "config_toast";
    toastEl.innerHTML = '<i class="fa-solid fa-check"></i> Success';
    modalWindow.appendChild(toastEl);
    modalWindow.appendChild(header);
    modalWindow.appendChild(body);
    modalBackdrop.appendChild(modalWindow);
    document.body.appendChild(modalBackdrop);
    closeBtn.addEventListener("click", closeConfigModal);
    modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) {
            closeConfigModal();
        }
    });
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modalBackdrop?.classList.contains("active")) {
            closeConfigModal();
        }
    });
}
export function openConfigModal() {
    createConfigModalDOM();
    if (!modalBackdrop)
        return;
    const currentSavedTheme = localStorage.getItem("app_theme") || "system";
    applyTheme(currentSavedTheme);
    if (tokenResultContainer) {
        tokenResultContainer.style.display = "none";
    }
    if (tokenInput) {
        tokenInput.value = "";
    }
    fetchBackupInfo();
    modalBackdrop.classList.add("active");
}
export function closeConfigModal() {
    if (!modalBackdrop)
        return;
    modalBackdrop.classList.remove("active");
    if (tokenResultContainer) {
        tokenResultContainer.style.display = "none";
    }
    if (tokenInput) {
        tokenInput.value = "";
    }
}
export function initConfigModal(settingsBtn, onDataChanged) {
    if (onDataChanged) {
        onDataChangedCallback = onDataChanged;
    }
    settingsBtn.addEventListener("click", openConfigModal);
}
