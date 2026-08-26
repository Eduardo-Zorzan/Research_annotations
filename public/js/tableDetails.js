import { openAnnotationModal } from "./annotationModal.js";
let currentTableId = "";
let currentTableTitle = "";
let currentDetails = [];
let draggedRowIndex = null;
let activeRowModal = null;
let activeReorderBtn = null;
let isModalGlobalListenerInitialized = false;
export async function fetchTableDetails(tableId) {
    try {
        const response = await fetch(`/${encodeURIComponent(tableId)}/table_details`);
        if (!response.ok) {
            throw new Error(`Failed to fetch table details: ${response.statusText}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error("Error fetching table details:", error);
        return [];
    }
}
export async function saveRowOrderToDB(tableId, ids) {
    if (!tableId || ids.length === 0)
        return;
    try {
        const response = await fetch("/table_details/reorder", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                table_id: tableId,
                ids,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to reorder rows: ${response.statusText}`);
        }
    }
    catch (error) {
        console.error("Error saving row order to database:", error);
    }
}
export async function createTableDetail(tableId, name, link) {
    try {
        const response = await fetch("/table_details", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: null,
                table_id: tableId,
                annotation: null,
                name,
                link: link || null,
                creation_date: null,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to create table detail: ${response.statusText}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error("Error creating table detail:", error);
        alert("Failed to add new item. Please try again.");
        return null;
    }
}
export async function updateTableDetail(detail) {
    try {
        const response = await fetch("/table_details", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: detail.id,
                table_id: detail.table_id,
                annotation: detail.annotation,
                name: detail.name,
                link: detail.link || null,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to update item: ${response.statusText}`);
        }
        return true;
    }
    catch (error) {
        console.error("Error updating table detail:", error);
        return false;
    }
}
export async function deleteTableDetailsBatch(ids) {
    try {
        const response = await fetch("/table_details", {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: null,
                ids,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to delete items: ${response.statusText}`);
        }
        return true;
    }
    catch (error) {
        console.error("Error deleting items:", error);
        alert("Failed to delete selected items. Please try again.");
        return false;
    }
}
export function closeRowModal() {
    if (activeRowModal) {
        activeRowModal.remove();
        activeRowModal = null;
    }
    if (activeReorderBtn) {
        activeReorderBtn.classList.remove("active");
        activeReorderBtn.closest(".row_floating_handles")?.classList.remove("active");
        activeReorderBtn = null;
    }
}
function initModalGlobalListeners() {
    if (isModalGlobalListenerInitialized)
        return;
    isModalGlobalListenerInitialized = true;
    document.addEventListener("click", (e) => {
        const target = e.target;
        if (activeRowModal &&
            !activeRowModal.contains(target) &&
            activeReorderBtn &&
            !activeReorderBtn.contains(target)) {
            closeRowModal();
        }
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeRowModal();
        }
    });
    window.addEventListener("scroll", () => {
        closeRowModal();
    }, true);
}
function openRowModal(detail, reorderBtn) {
    closeRowModal();
    initModalGlobalListeners();
    const modal = document.createElement("div");
    modal.className = "row_options_modal";
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "row_modal_action row_modal_action--danger";
    deleteBtn.setAttribute("aria-label", `Delete ${detail.name}`);
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
    deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        closeRowModal();
        const success = await deleteTableDetailsBatch([detail.id]);
        if (success) {
            currentDetails = await fetchTableDetails(currentTableId);
            renderRows();
        }
    });
    modal.appendChild(deleteBtn);
    document.body.appendChild(modal);
    const rect = reorderBtn.getBoundingClientRect();
    modal.style.top = `${rect.bottom + 4}px`;
    modal.style.left = `${rect.left}px`;
    reorderBtn.classList.add("active");
    reorderBtn.closest(".row_floating_handles")?.classList.add("active");
    activeRowModal = modal;
    activeReorderBtn = reorderBtn;
}
function renderHeader() {
    const thead = document.getElementById("table-details-head") ||
        document.querySelector(".data-table thead");
    if (!thead)
        return;
    thead.innerHTML = `
    <tr>
      <th class="col-details">
        <span class="col_header_title">
          <b>Details</b>
        </span>
      </th>
      <th class="col-name">
        <span class="col_header_title">
          <b>Name</b>
        </span>
      </th>
      <th class="col-link">
        <span class="col_header_title">
          <b> <i class="fa-solid fa-link"></i> Link</b>
        </span>
      </th>
    </tr>
  `;
}
function renderRows() {
    closeRowModal();
    const tbody = document.getElementById("table-details-body") ||
        document.querySelector(".data-table tbody");
    if (!tbody)
        return;
    tbody.innerHTML = "";
    currentDetails.forEach((detail, index) => {
        const row = document.createElement("tr");
        row.className = "table_row";
        row.dataset.rowId = detail.id;
        row.dataset.rowIndex = String(index);
        row.draggable = true;
        const detailsCell = document.createElement("td");
        detailsCell.className = "col-details";
        const floatingHandles = document.createElement("div");
        floatingHandles.className = "row_floating_handles";
        const reorderBtn = document.createElement("button");
        reorderBtn.className = "row_reorder_btn";
        reorderBtn.setAttribute("aria-label", "Row options");
        reorderBtn.title = "Drag to reorder / Click for options";
        reorderBtn.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
        reorderBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (activeReorderBtn === reorderBtn) {
                closeRowModal();
            }
            else {
                openRowModal(detail, reorderBtn);
            }
        });
        floatingHandles.appendChild(reorderBtn);
        detailsCell.appendChild(floatingHandles);
        const hasAnnotation = Boolean(detail.annotation && detail.annotation.trim() !== "");
        const detailsBtn = document.createElement("button");
        detailsBtn.className = `table_details_btn ${hasAnnotation ? "has-annotation" : ""}`;
        detailsBtn.setAttribute("aria-label", "Details & Annotation");
        detailsBtn.title = hasAnnotation ? "Edit Annotation (Notes present)" : "Add Annotation";
        detailsBtn.innerHTML = hasAnnotation
            ? '<i class="fa-solid fa-file-lines"></i>'
            : '<i class="fa-regular fa-pen-to-square"></i>';
        const updateBtnAnnotationState = () => {
            const nowHas = Boolean(detail.annotation && detail.annotation.trim() !== "");
            if (nowHas) {
                detailsBtn.classList.add("has-annotation");
                detailsBtn.title = "Edit Annotation (Notes present)";
                detailsBtn.innerHTML = '<i class="fa-solid fa-file-lines"></i>';
            }
            else {
                detailsBtn.classList.remove("has-annotation");
                detailsBtn.title = "Add Annotation";
                detailsBtn.innerHTML = '<i class="fa-regular fa-pen-to-square"></i>';
            }
        };
        detailsBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openAnnotationModal(detail, async (updatedDetail) => {
                const success = await updateTableDetail(updatedDetail);
                if (success) {
                    updateBtnAnnotationState();
                }
                return success;
            });
        });
        detailsCell.appendChild(detailsBtn);
        row.appendChild(detailsCell);
        const nameCell = document.createElement("td");
        nameCell.className = "col-name col_editable";
        const nameContainer = document.createElement("div");
        nameContainer.className = "cell_editable_container";
        nameContainer.textContent = detail.name;
        nameCell.appendChild(nameContainer);
        const startEditName = () => {
            if (nameCell.classList.contains("editing"))
                return;
            nameCell.classList.add("editing");
            nameContainer.innerHTML = "";
            const input = document.createElement("input");
            input.type = "text";
            input.className = "cell_inline_input";
            input.value = detail.name;
            input.setAttribute("aria-label", "Edit item name");
            nameContainer.appendChild(input);
            input.focus();
            input.select();
            let isSavedOrCancelled = false;
            const saveName = async () => {
                if (isSavedOrCancelled)
                    return;
                isSavedOrCancelled = true;
                const newName = input.value.trim();
                nameCell.classList.remove("editing");
                if (newName && newName !== detail.name) {
                    detail.name = newName;
                    nameContainer.textContent = newName;
                    await updateTableDetail(detail);
                }
                else {
                    nameContainer.textContent = detail.name;
                }
            };
            const cancelName = () => {
                if (isSavedOrCancelled)
                    return;
                isSavedOrCancelled = true;
                nameCell.classList.remove("editing");
                nameContainer.textContent = detail.name;
            };
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    saveName();
                }
                else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelName();
                }
            });
            input.addEventListener("blur", () => {
                saveName();
            });
        };
        nameCell.addEventListener("click", () => {
            startEditName();
        });
        row.appendChild(nameCell);
        const linkCell = document.createElement("td");
        linkCell.className = "col-link col_editable";
        const linkContainer = document.createElement("div");
        linkContainer.className = "link_cell_container";
        const renderLinkDisplay = () => {
            linkContainer.innerHTML = "";
            if (detail.link && detail.link.trim() !== "") {
                const linkAnchor = document.createElement("a");
                const href = detail.link.startsWith("http://") || detail.link.startsWith("https://")
                    ? detail.link
                    : `https://${detail.link}`;
                linkAnchor.href = href;
                linkAnchor.target = "_blank";
                linkAnchor.rel = "noopener noreferrer";
                linkAnchor.className = "table_details_link";
                linkAnchor.textContent = detail.link;
                linkContainer.appendChild(linkAnchor);
            }
            else {
                const emptySpan = document.createElement("span");
                emptySpan.className = "link_placeholder";
                emptySpan.textContent = "-";
                linkContainer.appendChild(emptySpan);
            }
        };
        renderLinkDisplay();
        linkCell.appendChild(linkContainer);
        const startEditLink = () => {
            if (linkCell.classList.contains("editing"))
                return;
            linkCell.classList.add("editing");
            linkContainer.innerHTML = "";
            const input = document.createElement("input");
            input.type = "text";
            input.className = "cell_inline_input";
            input.placeholder = "https://...";
            input.value = detail.link || "";
            input.setAttribute("aria-label", "Edit item link");
            linkContainer.appendChild(input);
            input.focus();
            input.select();
            let isSavedOrCancelled = false;
            const saveLink = async () => {
                if (isSavedOrCancelled)
                    return;
                isSavedOrCancelled = true;
                const newLink = input.value.trim();
                const updatedLink = newLink || null;
                linkCell.classList.remove("editing");
                if (updatedLink !== detail.link) {
                    detail.link = updatedLink;
                    renderLinkDisplay();
                    await updateTableDetail(detail);
                }
                else {
                    renderLinkDisplay();
                }
            };
            const cancelLink = () => {
                if (isSavedOrCancelled)
                    return;
                isSavedOrCancelled = true;
                linkCell.classList.remove("editing");
                renderLinkDisplay();
            };
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    saveLink();
                }
                else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelLink();
                }
            });
            input.addEventListener("blur", () => {
                saveLink();
            });
        };
        linkCell.addEventListener("click", (e) => {
            const target = e.target;
            if (target.tagName.toLowerCase() === "a" || target.closest("a")) {
                return;
            }
            startEditLink();
        });
        row.appendChild(linkCell);
        row.addEventListener("dragstart", (e) => {
            const target = e.target;
            if (target.tagName === "INPUT" || row.querySelector(".col_editable.editing")) {
                e.preventDefault();
                return;
            }
            closeRowModal();
            draggedRowIndex = index;
            row.classList.add("row-dragging");
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", detail.id);
            }
        });
        row.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (draggedRowIndex === null || draggedRowIndex === index)
                return;
            const rect = row.getBoundingClientRect();
            const isBelow = e.clientY > rect.top + rect.height / 2;
            row.classList.remove("drag-over-top", "drag-over-bottom");
            if (isBelow) {
                row.classList.add("drag-over-bottom");
            }
            else {
                row.classList.add("drag-over-top");
            }
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = "move";
            }
        });
        row.addEventListener("dragleave", () => {
            row.classList.remove("drag-over-top", "drag-over-bottom");
        });
        row.addEventListener("drop", async (e) => {
            e.preventDefault();
            const isBelow = row.classList.contains("drag-over-bottom");
            row.classList.remove("drag-over-top", "drag-over-bottom");
            if (draggedRowIndex === null || draggedRowIndex === index)
                return;
            const [movedItem] = currentDetails.splice(draggedRowIndex, 1);
            let targetPos = index;
            if (draggedRowIndex < index && !isBelow) {
                targetPos = index - 1;
            }
            else if (draggedRowIndex > index && isBelow) {
                targetPos = index + 1;
            }
            currentDetails.splice(targetPos, 0, movedItem);
            renderRows();
            const orderedIds = currentDetails.map((d) => d.id);
            await saveRowOrderToDB(currentTableId, orderedIds);
        });
        row.addEventListener("dragend", () => {
            draggedRowIndex = null;
            document
                .querySelectorAll(".table_row")
                .forEach((r) => r.classList.remove("row-dragging", "drag-over-top", "drag-over-bottom"));
        });
        tbody.appendChild(row);
    });
    if (currentTableId && currentTableId !== "0" && currentTableId !== "") {
        const newRow = document.createElement("tr");
        newRow.className = "table_new_row";
        const newDetailsCell = document.createElement("td");
        newDetailsCell.className = "col-details new_row_cell";
        const addBtn = document.createElement("button");
        addBtn.className = "new_row_add_btn";
        addBtn.title = "Save item";
        addBtn.setAttribute("aria-label", "Save item");
        addBtn.innerHTML = '<i style="font-size:18px" class="fa-regular fa-floppy-disk"></i>';
        newDetailsCell.appendChild(addBtn);
        newRow.appendChild(newDetailsCell);
        const newNameCell = document.createElement("td");
        newNameCell.className = "col-name new_row_cell";
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "new_item_input input_name";
        nameInput.placeholder = "+ New item name...";
        nameInput.setAttribute("aria-label", "New item name");
        newNameCell.appendChild(nameInput);
        newRow.appendChild(newNameCell);
        const newLinkCell = document.createElement("td");
        newLinkCell.className = "col-link new_row_cell";
        const linkInput = document.createElement("input");
        linkInput.type = "text";
        linkInput.className = "new_item_input input_link";
        linkInput.placeholder = "https://...";
        linkInput.setAttribute("aria-label", "New item link");
        newLinkCell.appendChild(linkInput);
        newRow.appendChild(newLinkCell);
        const handleSaveNewItem = async () => {
            const name = nameInput.value.trim();
            const link = linkInput.value.trim();
            if (!name) {
                nameInput.focus();
                return;
            }
            const created = await createTableDetail(currentTableId, name, link);
            if (created) {
                currentDetails.push(created);
                renderRows();
                setTimeout(() => {
                    const freshNameInput = document.querySelector(".table_new_row .input_name");
                    freshNameInput?.focus();
                }, 50);
            }
        };
        addBtn.addEventListener("click", () => {
            handleSaveNewItem();
        });
        nameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSaveNewItem();
            }
            else if (e.key === "Escape") {
                nameInput.value = "";
                linkInput.value = "";
            }
        });
        linkInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSaveNewItem();
            }
            else if (e.key === "Escape") {
                nameInput.value = "";
                linkInput.value = "";
            }
        });
        tbody.appendChild(newRow);
    }
    else if (currentDetails.length === 0) {
        const emptyRow = document.createElement("tr");
        const emptyCell = document.createElement("td");
        emptyCell.colSpan = 3;
        emptyCell.className = "table_details_empty";
        emptyCell.textContent = "No details found for this table.";
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
    }
}
export async function loadTableDetails(tableId, tableTitle) {
    closeRowModal();
    currentTableId = tableId;
    currentTableTitle = tableTitle;
    const tableTitleEl = document.getElementById("table-title") ||
        document.querySelector(".table-title");
    if (tableTitleEl) {
        tableTitleEl.textContent = tableTitle;
    }
    if (tableId && tableId !== "0" && tableId !== "") {
        currentDetails = await fetchTableDetails(tableId);
    }
    else {
        currentDetails = [];
    }
    renderHeader();
    renderRows();
}
