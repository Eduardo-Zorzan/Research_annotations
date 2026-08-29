import { initSidebarToggle, initSidebarResize, initAddTable, loadTables, } from "./sidebar.js";
import { initConfigModal, initTheme } from "./configModal.js";
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    const layout = document.getElementById("layout");
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const mainToggle = document.getElementById("main-toggle");
    const sidebarTables = document.getElementById("sidebar-tables");
    const resizeHandle = document.getElementById("sidebar-resize");
    const addTableBtn = document.getElementById("sidebar-add-table");
    const settingsBtn = document.getElementById("main-settings");
    if (!layout || !sidebarToggle || !mainToggle || !sidebarTables || !resizeHandle)
        return;
    initSidebarToggle(layout, sidebarToggle, mainToggle);
    initSidebarResize(layout, resizeHandle);
    if (addTableBtn) {
        initAddTable(addTableBtn, sidebarTables);
    }
    loadTables(sidebarTables);
    if (settingsBtn) {
        initConfigModal(settingsBtn, () => {
            loadTables(sidebarTables);
        });
    }
});
