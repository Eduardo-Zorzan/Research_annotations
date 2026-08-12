import { initSidebarToggle, initSidebarResize, loadTables } from "./sidebar.js";
document.addEventListener("DOMContentLoaded", () => {
    const layout = document.getElementById("layout");
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const mainToggle = document.getElementById("main-toggle");
    const sidebarTables = document.getElementById("sidebar-tables");
    const resizeHandle = document.getElementById("sidebar-resize");
    if (!layout || !sidebarToggle || !mainToggle || !sidebarTables || !resizeHandle)
        return;
    initSidebarToggle(layout, sidebarToggle, mainToggle);
    initSidebarResize(layout, resizeHandle);
    loadTables(sidebarTables);
});
