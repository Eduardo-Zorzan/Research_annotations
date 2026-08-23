import { loadTableDetails } from "./tableDetails.js";
let currentTables = [];
let currentActiveTableId = 0;
let draggedTableIndex = null;
let isGlobalClickListenerInitialized = false;
let globalTablesContainer = null;
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
export async function saveTableOrderToDB(ids) {
    if (ids.length === 0)
        return;
    try {
        const response = await fetch("/tables/reorder", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ids,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to reorder tables: ${response.statusText}`);
        }
    }
    catch (error) {
        console.error("Error saving table order to database:", error);
    }
}
export async function createTable(description, container) {
    try {
        const response = await fetch("/tables", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: 0,
                description,
                user_id: 1,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to create table: ${response.statusText}`);
        }
        const table = await response.json();
        await loadTables(container, table.id);
    }
    catch (error) {
        console.error("Error creating table:", error);
        alert("Failed to create table. Please try again.");
    }
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
        await loadTables(container, table.id);
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
function renderTables(container) {
    container.innerHTML = "";
    if (currentTables.length === 0) {
        loadTableDetails(0, "No Tables");
        return;
    }
    let activeTable = currentTables.find((t) => t.id === currentActiveTableId) || currentTables[0];
    currentActiveTableId = activeTable.id;
    loadTableDetails(activeTable.id, activeTable.description);
    currentTables.forEach((table, index) => {
        const containerTable = document.createElement("div");
        containerTable.className = "sidebar_item_wrapper";
        containerTable.dataset.tableId = String(table.id);
        containerTable.dataset.tableIndex = String(index);
        const item = document.createElement("div");
        item.className = "sidebar_item";
        item.draggable = true;
        if (table.id === activeTable.id) {
            item.className += " active";
        }
        const label = document.createElement("span");
        label.className = "sidebar_item_label";
        label.textContent = table.description;
        const menuBtn = document.createElement("button");
        menuBtn.className = "sidebar_item_menu";
        menuBtn.setAttribute("aria-label", "Table options");
        menuBtn.setAttribute("draggable", "false");
        menuBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
        const dropdown = document.createElement("div");
        dropdown.className = "sidebar_item_dropdown";
        const renameBtn = document.createElement("button");
        renameBtn.className = "sidebar_dropdown_action";
        renameBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Rename';
        const deleteBtn = document.createElement("button");
        deleteBtn.className =
            "sidebar_dropdown_action sidebar_dropdown_action--danger";
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
        dropdown.appendChild(renameBtn);
        dropdown.appendChild(deleteBtn);
        item.appendChild(label);
        item.appendChild(menuBtn);
        item.addEventListener("dragstart", (e) => {
            const target = e.target;
            if (item.classList.contains("editing") ||
                target.tagName === "INPUT" ||
                target.closest(".sidebar_item_menu") ||
                target.closest(".sidebar_item_dropdown")) {
                e.preventDefault();
                return;
            }
            draggedTableIndex = index;
            item.classList.add("table-dragging");
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(table.id));
            }
        });
        item.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (draggedTableIndex === null || draggedTableIndex === index)
                return;
            const rect = item.getBoundingClientRect();
            const isBelow = e.clientY > rect.top + rect.height / 2;
            containerTable.classList.remove("drag-over-top", "drag-over-bottom");
            if (isBelow) {
                containerTable.classList.add("drag-over-bottom");
            }
            else {
                containerTable.classList.add("drag-over-top");
            }
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = "move";
            }
        });
        item.addEventListener("dragleave", () => {
            containerTable.classList.remove("drag-over-top", "drag-over-bottom");
        });
        item.addEventListener("drop", async (e) => {
            e.preventDefault();
            const isBelow = containerTable.classList.contains("drag-over-bottom");
            containerTable.classList.remove("drag-over-top", "drag-over-bottom");
            if (draggedTableIndex === null || draggedTableIndex === index)
                return;
            const [movedTable] = currentTables.splice(draggedTableIndex, 1);
            let targetPos = index;
            if (draggedTableIndex < index && !isBelow) {
                targetPos = index - 1;
            }
            else if (draggedTableIndex > index && isBelow) {
                targetPos = index + 1;
            }
            currentTables.splice(targetPos, 0, movedTable);
            renderTables(container);
            const orderedIds = currentTables.map((t) => t.id);
            await saveTableOrderToDB(orderedIds);
        });
        item.addEventListener("dragend", () => {
            draggedTableIndex = null;
            container
                .querySelectorAll(".sidebar_item")
                .forEach((el) => el.classList.remove("table-dragging"));
            container
                .querySelectorAll(".sidebar_item_wrapper")
                .forEach((el) => el.classList.remove("drag-over-top", "drag-over-bottom"));
        });
        item.addEventListener("click", (e) => {
            const target = e.target;
            if (item.classList.contains("editing") ||
                target.closest(".sidebar_item_menu") ||
                target.closest(".sidebar_item_dropdown")) {
                return;
            }
            currentActiveTableId = table.id;
            container
                .querySelectorAll(".sidebar_item")
                .forEach((el) => el.classList.remove("active"));
            item.classList.add("active");
            loadTableDetails(table.id, table.description);
        });
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            container
                .querySelectorAll(".sidebar_item_dropdown.open")
                .forEach((d) => {
                if (d !== dropdown)
                    d.classList.remove("open");
            });
            if (!dropdown.classList.contains("open")) {
                const rect = menuBtn.getBoundingClientRect();
                dropdown.style.top = `${rect.top}px`;
                dropdown.style.left = `${rect.right + 8}px`;
                dropdown.style.right = "auto";
            }
            dropdown.classList.toggle("open");
        });
        renameBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.remove("open");
            item.draggable = false;
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
                    await loadTables(container, table.id);
                    return;
                }
                saveBtn.disabled = true;
                await updateTable(table, newDesc, container);
            };
            const handleCancel = () => {
                loadTables(container, table.id);
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
export async function loadTables(container, id_active_table = null) {
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
    currentTables = await response.json();
    if (id_active_table !== null && id_active_table !== undefined) {
        currentActiveTableId = Number(id_active_table);
    }
    else if (currentTables.length > 0 &&
        !currentTables.some((t) => t.id === currentActiveTableId)) {
        currentActiveTableId = currentTables[0].id;
    }
    renderTables(container);
}
export function createTempTableCard(container) {
    const existingTempInput = container.querySelector(".temp_table_card .sidebar_item_input");
    if (existingTempInput) {
        existingTempInput.focus();
        existingTempInput.select();
        return;
    }
    const containerTable = document.createElement("div");
    containerTable.className = "temp_table_card";
    const item = document.createElement("div");
    item.className = "sidebar_item editing";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "sidebar_item_input";
    input.value = "";
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
    containerTable.appendChild(item);
    container.prepend(containerTable);
    input.focus();
    const handleSave = async () => {
        const desc = input.value.trim();
        if (!desc) {
            input.focus();
            return;
        }
        saveBtn.disabled = true;
        cancelBtn.disabled = true;
        await createTable(desc, container);
    };
    const handleCancel = () => {
        containerTable.remove();
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
}
export function initAddTable(addBtn, container) {
    addBtn.addEventListener("click", () => {
        createTempTableCard(container);
    });
}
