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
export async function updateTable(table, newDescription, container) {
    try {
        const response = await fetch("/tables", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: table.id,
                description: newDescription,
                user_id: 1,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to update table: ${response.statusText}`);
        }
        await loadTables(container);
    }
    catch (error) {
        console.error("Error updating table:", error);
        alert("Failed to update table description. Please try again.");
    }
}
export async function deleteTable(table, container) {
    try {
        const response = await fetch("/tables", {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: table.id,
                description: table.description,
                user_id: 1,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to delete table: ${response.statusText}`);
        }
        await loadTables(container);
    }
    catch (error) {
        console.error("Error deleting table:", error);
        alert("Failed to delete table. Please try again.");
    }
}
let isGlobalClickListenerInitialized = false;
let globalTablesContainer = null;
export async function loadTables(container) {
    globalTablesContainer = container;
    if (!isGlobalClickListenerInitialized) {
        isGlobalClickListenerInitialized = true;
        document.addEventListener("click", (e) => {
            const target = e.target;
            if (!target.closest(".sidebar_item_menu") && globalTablesContainer) {
                globalTablesContainer
                    .querySelectorAll(".sidebar_item_dropdown.open")
                    .forEach((d) => d.classList.remove("open"));
            }
        });
    }
    const response = await fetch("/1/tables");
    const tables = await response.json();
    container.innerHTML = "";
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
        menuBtn.setAttribute("aria-label", "Table options");
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
        // Select table on click (when not editing and not clicking menu)
        item.addEventListener("click", (e) => {
            const target = e.target;
            if (item.classList.contains("editing") ||
                target.closest(".sidebar_item_menu") ||
                target.closest(".sidebar_item_dropdown")) {
                return;
            }
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
                .forEach((d) => {
                if (d !== dropdown)
                    d.classList.remove("open");
            });
            if (!dropdown.classList.contains("open")) {
                const rect = menuBtn.getBoundingClientRect();
                dropdown.style.top = `${rect.top}px`;
                // Open to the right of the menu button with a small gap
                dropdown.style.left = `${rect.right + 8}px`;
                dropdown.style.right = "auto";
            }
            dropdown.classList.toggle("open");
        });
        // Rename (switch table card to inline edit mode)
        renameBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.remove("open");
            item.classList.add("editing");
            item.innerHTML = "";
            const input = document.createElement("input");
            input.type = "text";
            input.className = "sidebar_item_input";
            input.value = table.description;
            input.setAttribute("aria-label", "Table description");
            const actions = document.createElement("div");
            actions.className = "sidebar_item_actions";
            const saveBtn = document.createElement("button");
            saveBtn.className = "sidebar_item_save";
            saveBtn.title = "Save";
            saveBtn.setAttribute("aria-label", "Save");
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            const cancelBtn = document.createElement("button");
            cancelBtn.className = "sidebar_item_cancel";
            cancelBtn.title = "Cancel";
            cancelBtn.setAttribute("aria-label", "Cancel");
            cancelBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            actions.appendChild(saveBtn);
            actions.appendChild(cancelBtn);
            item.appendChild(input);
            item.appendChild(actions);
            input.focus();
            input.select();
            const handleSave = async () => {
                const newDesc = input.value.trim();
                if (!newDesc)
                    return;
                if (newDesc === table.description) {
                    await loadTables(container);
                    return;
                }
                saveBtn.disabled = true;
                await updateTable(table, newDesc, container);
            };
            const handleCancel = () => {
                loadTables(container);
            };
            saveBtn.addEventListener("click", (ev) => {
                ev.stopPropagation();
                handleSave();
            });
            cancelBtn.addEventListener("click", (ev) => {
                ev.stopPropagation();
                handleCancel();
            });
            input.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    handleSave();
                }
                else if (ev.key === "Escape") {
                    ev.preventDefault();
                    handleCancel();
                }
            });
        });
        // Delete table
        deleteBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            dropdown.classList.remove("open");
            if (confirm(`Are you sure you want to delete "${table.description}"?`)) {
                await deleteTable(table, container);
            }
        });
        containerTable.appendChild(item);
        containerTable.appendChild(dropdown);
        container.appendChild(containerTable);
    });
}
