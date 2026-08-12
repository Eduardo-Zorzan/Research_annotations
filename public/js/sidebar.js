export function initSidebarToggle(layout, sidebarToggle, mainToggle) {
    let lastSidebarWidth = "";
    function collapseSidebar() {
        lastSidebarWidth = layout.style.gridTemplateColumns;
        layout.style.gridTemplateColumns = "";
        layout.classList.add("sidebar-collapsed");
    }
    function expandSidebar() {
        layout.classList.remove("sidebar-collapsed");
        if (lastSidebarWidth) {
            layout.style.gridTemplateColumns = lastSidebarWidth;
        }
    }
    sidebarToggle.addEventListener("click", collapseSidebar);
    mainToggle.addEventListener("click", expandSidebar);
}
export function initSidebarResize(layout, resizeHandle) {
    const MIN_WIDTH = 120;
    const MAX_WIDTH = 400;
    let isResizing = false;
    resizeHandle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        isResizing = true;
        layout.classList.add("resizing");
        document.body.classList.add("resizing");
        resizeHandle.classList.add("active");
    });
    document.addEventListener("mousemove", (e) => {
        if (!isResizing)
            return;
        const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
        layout.style.gridTemplateColumns = `${width}px 4px 1fr`;
    });
    document.addEventListener("mouseup", () => {
        if (!isResizing)
            return;
        isResizing = false;
        layout.classList.remove("resizing");
        document.body.classList.remove("resizing");
        resizeHandle.classList.remove("active");
    });
}
export async function loadTables(container) {
    const response = await fetch("/1/tables");
    const tables = await response.json();
    container.innerHTML = "";
    // Close any open menu when clicking outside
    document.addEventListener("click", (e) => {
        const target = e.target;
        if (!target.closest(".sidebar_item_menu")) {
            container
                .querySelectorAll(".sidebar_item_dropdown.open")
                .forEach((d) => d.classList.remove("open"));
        }
    });
    tables.forEach((table, index) => {
        const containerTable = document.createElement("div");
        containerTable.dataset.tableId = String(table.id);
        const item = document.createElement("div");
        item.className = "sidebar_item" + (index === 0 ? " active" : "");
        const label = document.createElement("span");
        label.className = "sidebar_item_label";
        label.textContent = table.description;
        const menuBtn = document.createElement("button");
        menuBtn.className = "sidebar_item_menu";
        menuBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
        const dropdown = document.createElement("div");
        dropdown.className = "sidebar_item_dropdown";
        const renameBtn = document.createElement("button");
        renameBtn.className = "sidebar_dropdown_action";
        renameBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Rename';
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "sidebar_dropdown_action sidebar_dropdown_action--danger";
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
        dropdown.appendChild(renameBtn);
        dropdown.appendChild(deleteBtn);
        item.appendChild(label);
        item.appendChild(menuBtn);
        // Select table on click (but not when clicking menu)
        item.addEventListener("click", (e) => {
            const target = e.target;
            if (target.closest(".sidebar_item_menu") || target.closest(".sidebar_item_dropdown"))
                return;
            container
                .querySelectorAll(".sidebar_item")
                .forEach((el) => el.classList.remove("active"));
            item.classList.add("active");
        });
        // Toggle dropdown
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            // Close other open dropdowns
            container
                .querySelectorAll(".sidebar_item_dropdown.open")
                .forEach((d) => { if (d !== dropdown)
                d.classList.remove("open"); });
            if (!dropdown.classList.contains("open")) {
                const rect = menuBtn.getBoundingClientRect();
                dropdown.style.top = `${rect.top}px`;
                // Open to the right of the menu button with a small gap
                dropdown.style.left = `${rect.right + 8}px`;
                dropdown.style.right = "auto";
            }
            dropdown.classList.toggle("open");
        });
        containerTable.appendChild(item);
        containerTable.appendChild(dropdown);
        container.appendChild(containerTable);
    });
}
