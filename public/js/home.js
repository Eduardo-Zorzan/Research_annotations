import { initSidebarToggle, initSidebarResize, initAddTable, loadTables, } from "./sidebar.js";
document.addEventListener("DOMContentLoaded", () => {
    const layout = document.getElementById("layout");
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const mainToggle = document.getElementById("main-toggle");
    const sidebarTables = document.getElementById("sidebar-tables");
    const resizeHandle = document.getElementById("sidebar-resize");
    const addTableBtn = document.getElementById("sidebar-add-table");
    if (!layout || !sidebarToggle || !mainToggle || !sidebarTables || !resizeHandle)
        return;
    initSidebarToggle(layout, sidebarToggle, mainToggle);
    initSidebarResize(layout, resizeHandle);
    if (addTableBtn) {
        initAddTable(addTableBtn, sidebarTables);
    }
    loadTables(sidebarTables);
});
