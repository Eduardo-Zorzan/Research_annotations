import {
  openAnnotationModal,
  isAnnotationModalOpen,
  getCurrentAnnotationDetailId,
} from "./annotationModal.js";

export interface TableDetail {
  id: string;
  table_id: string;
  annotation: string | null;
  name: string;
  link: string | null;
  creation_date?: string | null;
  position?: number | null;
}

export interface TableDetailsCheck {
  count: number;
  max_id: number;
}

let currentTableId: string = "";
let currentTableTitle: string = "";
let currentDetails: TableDetail[] = [];
let draggedRowIndex: number | null = null;
let activeRowModal: HTMLElement | null = null;
let activeReorderBtn: HTMLElement | null = null;
let isModalGlobalListenerInitialized = false;
let isAutoCheckInitialized = false;
let lastKnownCount: number = 0;
let lastKnownMaxId: number = 0;
let isChecking: boolean = false;
let checkIntervalId: number | null = null;

export async function fetchTableDetails(
  tableId: string
): Promise<TableDetail[]> {
  try {
    const response = await fetch(`/${encodeURIComponent(tableId)}/table_details`);
    if (response.status === 401 || response.status === 403) {
      window.location.href = "/";
      return [];
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch table details: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching table details:", error);
    return [];
  }
}

export async function checkTableDetails(
  tableId: string
): Promise<TableDetailsCheck | null> {
  if (!tableId || tableId === "0" || tableId === "") return null;
  try {
    const response = await fetch(`/${encodeURIComponent(tableId)}/table_details/check`);
    if (response.status === 401 || response.status === 403) {
      window.location.href = "/";
      return null;
    }
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Error checking table details:", error);
    return null;
  }
}

export async function saveRowOrderToDB(
  tableId: string,
  ids: string[]
): Promise<void> {
  if (!tableId || ids.length === 0) return;
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
    if (response.status === 401 || response.status === 403) {
      window.location.href = "/";
      return;
    }
    if (!response.ok) {
      throw new Error(`Failed to reorder rows: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error saving row order to database:", error);
  }
}

export async function createTableDetail(
  tableId: string,
  name: string,
  link: string | null
): Promise<TableDetail | null> {
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

    if (response.status === 401 || response.status === 403) {
      window.location.href = "/";
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to create table detail: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating table detail:", error);
    alert("Failed to add new item. Please try again.");
    return null;
  }
}

export async function updateTableDetail(
  detail: TableDetail
): Promise<boolean> {
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

    if (response.status === 401 || response.status === 403) {
      window.location.href = "/";
      return false;
    }

    if (!response.ok) {
      throw new Error(`Failed to update item: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("Error updating table detail:", error);
    return false;
  }
}

export async function deleteTableDetailsBatch(ids: string[]): Promise<boolean> {
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

    if (response.status === 401 || response.status === 403) {
      window.location.href = "/";
      return false;
    }

    if (!response.ok) {
      throw new Error(`Failed to delete items: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("Error deleting items:", error);
    alert("Failed to delete selected items. Please try again.");
    return false;
  }
}

export function closeRowModal(): void {
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

function initModalGlobalListeners(): void {
  if (isModalGlobalListenerInitialized) return;
  isModalGlobalListenerInitialized = true;

  document.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      activeRowModal &&
      !activeRowModal.contains(target) &&
      activeReorderBtn &&
      !activeReorderBtn.contains(target)
    ) {
      closeRowModal();
    }
  });

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeRowModal();
    }
  });

  window.addEventListener("scroll", () => {
    closeRowModal();
  }, true);
}

function openRowModal(
  detail: TableDetail,
  reorderBtn: HTMLElement
): void {
  closeRowModal();

  initModalGlobalListeners();

  const modal = document.createElement("div");
  modal.className = "row_options_modal";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "row_modal_action row_modal_action--danger";
  deleteBtn.setAttribute("aria-label", `Delete ${detail.name}`);
  deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';

  deleteBtn.addEventListener("click", async (e: MouseEvent) => {
    e.stopPropagation();
    closeRowModal();
    const success = await deleteTableDetailsBatch([detail.id]);
    if (success) {
      currentDetails = await fetchTableDetails(currentTableId);
      const checkRes = await checkTableDetails(currentTableId);
      if (checkRes) {
        lastKnownCount = checkRes.count;
        lastKnownMaxId = checkRes.max_id;
      }
      syncTableDetails(currentDetails, false);
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

function renderHeader(): void {
  const thead =
    document.getElementById("table-details-head") ||
    document.querySelector(".data-table thead");
  if (!thead) return;

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

function createRowElement(detail: TableDetail, index: number): HTMLTableRowElement {
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

  reorderBtn.addEventListener("click", (e: MouseEvent) => {
    e.stopPropagation();
    if (activeReorderBtn === reorderBtn) {
      closeRowModal();
    } else {
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
    } else {
      detailsBtn.classList.remove("has-annotation");
      detailsBtn.title = "Add Annotation";
      detailsBtn.innerHTML = '<i class="fa-regular fa-pen-to-square"></i>';
    }
  };

  detailsBtn.addEventListener("click", (e: MouseEvent) => {
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
    if (nameCell.classList.contains("editing")) return;
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
      if (isSavedOrCancelled) return;
      isSavedOrCancelled = true;
      const newName = input.value.trim();
      nameCell.classList.remove("editing");
      if (newName && newName !== detail.name) {
        detail.name = newName;
        nameContainer.textContent = newName;
        await updateTableDetail(detail);
      } else {
        nameContainer.textContent = detail.name;
      }
    };

    const cancelName = () => {
      if (isSavedOrCancelled) return;
      isSavedOrCancelled = true;
      nameCell.classList.remove("editing");
      nameContainer.textContent = detail.name;
    };

    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveName();
      } else if (e.key === "Escape") {
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
      const href =
        detail.link.startsWith("http://") || detail.link.startsWith("https://")
          ? detail.link
          : `https://${detail.link}`;
      linkAnchor.href = href;
      linkAnchor.target = "_blank";
      linkAnchor.rel = "noopener noreferrer";
      linkAnchor.className = "table_details_link";
      linkAnchor.textContent = detail.link;
      linkContainer.appendChild(linkAnchor);
    } else {
      const emptySpan = document.createElement("span");
      emptySpan.className = "link_placeholder";
      emptySpan.textContent = "-";
      linkContainer.appendChild(emptySpan);
    }
  };

  renderLinkDisplay();
  linkCell.appendChild(linkContainer);

  const startEditLink = () => {
    if (linkCell.classList.contains("editing")) return;
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
      if (isSavedOrCancelled) return;
      isSavedOrCancelled = true;
      const newLink = input.value.trim();
      const updatedLink = newLink || null;
      linkCell.classList.remove("editing");
      if (updatedLink !== detail.link) {
        detail.link = updatedLink;
        renderLinkDisplay();
        await updateTableDetail(detail);
      } else {
        renderLinkDisplay();
      }
    };

    const cancelLink = () => {
      if (isSavedOrCancelled) return;
      isSavedOrCancelled = true;
      linkCell.classList.remove("editing");
      renderLinkDisplay();
    };

    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveLink();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelLink();
      }
    });

    input.addEventListener("blur", () => {
      saveLink();
    });
  };

  linkCell.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === "a" || target.closest("a")) {
      return;
    }
    startEditLink();
  });

  row.appendChild(linkCell);

  row.addEventListener("dragstart", (e: DragEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || row.querySelector(".col_editable.editing")) {
      e.preventDefault();
      return;
    }
    closeRowModal();
    draggedRowIndex = parseInt(row.dataset.rowIndex || String(index), 10);
    row.classList.add("row-dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", detail.id);
    }
  });

  row.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    const currentIndex = parseInt(row.dataset.rowIndex || String(index), 10);
    if (draggedRowIndex === null || draggedRowIndex === currentIndex) return;

    const rect = row.getBoundingClientRect();
    const isBelow = e.clientY > rect.top + rect.height / 2;

    row.classList.remove("drag-over-top", "drag-over-bottom");
    if (isBelow) {
      row.classList.add("drag-over-bottom");
    } else {
      row.classList.add("drag-over-top");
    }

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  });

  row.addEventListener("dragleave", () => {
    row.classList.remove("drag-over-top", "drag-over-bottom");
  });

  row.addEventListener("drop", async (e: DragEvent) => {
    e.preventDefault();
    const isBelow = row.classList.contains("drag-over-bottom");
    row.classList.remove("drag-over-top", "drag-over-bottom");

    const currentIndex = parseInt(row.dataset.rowIndex || String(index), 10);
    if (draggedRowIndex === null || draggedRowIndex === currentIndex) return;

    const [movedItem] = currentDetails.splice(draggedRowIndex, 1);
    let targetPos = currentIndex;
    if (draggedRowIndex < currentIndex && !isBelow) {
      targetPos = currentIndex - 1;
    } else if (draggedRowIndex > currentIndex && isBelow) {
      targetPos = currentIndex + 1;
    }

    currentDetails.splice(targetPos, 0, movedItem);

    syncTableDetails(currentDetails, false);
    const orderedIds = currentDetails.map((d) => d.id);
    await saveRowOrderToDB(currentTableId, orderedIds);
  });

  row.addEventListener("dragend", () => {
    draggedRowIndex = null;
    document
      .querySelectorAll(".table_row")
      .forEach((r) =>
        r.classList.remove("row-dragging", "drag-over-top", "drag-over-bottom")
      );
  });

  return row;
}

function updateRowElement(
  row: HTMLTableRowElement,
  detail: TableDetail,
  index: number
): void {
  row.dataset.rowIndex = String(index);

  const isModalOpenForThisDetail =
    isAnnotationModalOpen() && getCurrentAnnotationDetailId() === detail.id;

  if (!isModalOpenForThisDetail) {
    const detailsBtn = row.querySelector(".table_details_btn") as HTMLButtonElement | null;
    if (detailsBtn) {
      const hasAnnotation = Boolean(detail.annotation && detail.annotation.trim() !== "");
      if (hasAnnotation) {
        detailsBtn.classList.add("has-annotation");
        detailsBtn.title = "Edit Annotation (Notes present)";
        detailsBtn.innerHTML = '<i class="fa-solid fa-file-lines"></i>';
      } else {
        detailsBtn.classList.remove("has-annotation");
        detailsBtn.title = "Add Annotation";
        detailsBtn.innerHTML = '<i class="fa-regular fa-pen-to-square"></i>';
      }
    }
  }

  const nameCell = row.querySelector(".col-name") as HTMLElement | null;
  if (nameCell && !nameCell.classList.contains("editing")) {
    const nameContainer = nameCell.querySelector(".cell_editable_container");
    if (nameContainer && nameContainer.textContent !== detail.name) {
      nameContainer.textContent = detail.name;
    }
  }

  const linkCell = row.querySelector(".col-link") as HTMLElement | null;
  if (linkCell && !linkCell.classList.contains("editing")) {
    const linkContainer = linkCell.querySelector(".link_cell_container");
    if (linkContainer) {
      const currentAnchor = linkContainer.querySelector("a.table_details_link");
      const currentLinkText = currentAnchor ? currentAnchor.textContent : "";
      const targetLink = detail.link || "";

      if (currentLinkText !== targetLink) {
        linkContainer.innerHTML = "";
        if (detail.link && detail.link.trim() !== "") {
          const linkAnchor = document.createElement("a");
          const href =
            detail.link.startsWith("http://") || detail.link.startsWith("https://")
              ? detail.link
              : `https://${detail.link}`;
          linkAnchor.href = href;
          linkAnchor.target = "_blank";
          linkAnchor.rel = "noopener noreferrer";
          linkAnchor.className = "table_details_link";
          linkAnchor.textContent = detail.link;
          linkContainer.appendChild(linkAnchor);
        } else {
          const emptySpan = document.createElement("span");
          emptySpan.className = "link_placeholder";
          emptySpan.textContent = "-";
          linkContainer.appendChild(emptySpan);
        }
      }
    }
  }
}

function createBottomNewRow(): HTMLTableRowElement {
  const newRow = document.createElement("tr");
  newRow.className = "table_new_row";

  const newDetailsCell = document.createElement("td");
  newDetailsCell.className = "col-details new_row_cell";
  const addBtn = document.createElement("button");
  addBtn.className = "new_row_add_btn";
  addBtn.title = "Save item";
  addBtn.setAttribute("aria-label", "Save item");
  addBtn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i>';

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
      lastKnownCount++;
      const checkRes = await checkTableDetails(currentTableId);
      if (checkRes) {
        lastKnownMaxId = checkRes.max_id;
        lastKnownCount = checkRes.count;
      }
      nameInput.value = "";
      linkInput.value = "";
      syncTableDetails(currentDetails, false);
      setTimeout(() => {
        const freshNameInput = document.querySelector<HTMLInputElement>(
          ".table_new_row .input_name"
        );
        freshNameInput?.focus();
      }, 50);
    }
  };

  addBtn.addEventListener("click", () => {
    handleSaveNewItem();
  });

  nameInput.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveNewItem();
    } else if (e.key === "Escape") {
      nameInput.value = "";
      linkInput.value = "";
    }
  });

  linkInput.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveNewItem();
    } else if (e.key === "Escape") {
      nameInput.value = "";
      linkInput.value = "";
    }
  });

  return newRow;
}

function syncTableDetails(
  freshDetails: TableDetail[],
  isAutoReload: boolean = false
): void {
  const tbody =
    document.getElementById("table-details-body") ||
    document.querySelector(".data-table tbody");
  if (!tbody) return;

  const emptyRow = tbody.querySelector(".table_details_empty");
  if (freshDetails.length > 0 && emptyRow) {
    emptyRow.remove();
  }

  const existingRows = Array.from(
    tbody.querySelectorAll("tr.table_row")
  ) as HTMLTableRowElement[];
  const rowMap = new Map<string, HTMLTableRowElement>();
  existingRows.forEach((r) => {
    if (r.dataset.rowId) {
      rowMap.set(r.dataset.rowId, r);
    }
  });

  let bottomRow = tbody.querySelector("tr.table_new_row") as HTMLTableRowElement | null;

  const freshIds = new Set(freshDetails.map((d) => d.id));
  existingRows.forEach((r) => {
    const id = r.dataset.rowId;
    if (id && !freshIds.has(id)) {
      if (activeRowModal && activeReorderBtn?.closest("tr") === r) {
        closeRowModal();
      }
      r.remove();
      rowMap.delete(id);
    }
  });

  if (currentTableId && currentTableId !== "0" && currentTableId !== "") {
    if (!bottomRow) {
      bottomRow = createBottomNewRow();
      tbody.appendChild(bottomRow);
    }
  }

  freshDetails.forEach((detail, index) => {
    let row = rowMap.get(detail.id);
    if (row) {
      updateRowElement(row, detail, index);
    } else {
      row = createRowElement(detail, index);
      if (isAutoReload) {
        row.classList.add("row_new_entry");
      }
      rowMap.set(detail.id, row);
    }

    if (bottomRow && bottomRow.parentNode === tbody) {
      tbody.insertBefore(row, bottomRow);
    } else {
      tbody.appendChild(row);
    }
  });

  if (bottomRow && bottomRow.parentNode === tbody) {
    tbody.appendChild(bottomRow);
  }

  if (freshDetails.length === 0) {
    if (!currentTableId || currentTableId === "0" || currentTableId === "") {
      if (!tbody.querySelector(".table_details_empty")) {
        const emptyTr = document.createElement("tr");
        const emptyTd = document.createElement("td");
        emptyTd.colSpan = 3;
        emptyTd.className = "table_details_empty";
        emptyTd.textContent = "No details found for this table.";
        emptyTr.appendChild(emptyTd);
        tbody.appendChild(emptyTr);
      }
    }
  }

  currentDetails = freshDetails;
}

function renderRows(): void {
  syncTableDetails(currentDetails, false);
}

export async function checkForNewRows(): Promise<void> {
  if (!currentTableId || currentTableId === "0" || currentTableId === "") return;
  if (draggedRowIndex !== null) return;
  if (isChecking) return;

  isChecking = true;
  try {
    const checkRes = await checkTableDetails(currentTableId);
    if (!checkRes) return;

    const countChanged = checkRes.count !== lastKnownCount;
    const maxIdChanged = checkRes.max_id > lastKnownMaxId;

    if (countChanged || maxIdChanged) {
      lastKnownCount = checkRes.count;
      lastKnownMaxId = checkRes.max_id;
      const freshDetails = await fetchTableDetails(currentTableId);
      syncTableDetails(freshDetails, true);
    }
  } catch (error) {
    console.error("Error checking for new rows:", error);
  } finally {
    isChecking = false;
  }
}

export function initAutoCheckListeners(): void {
  if (isAutoCheckInitialized) return;
  isAutoCheckInitialized = true;

  window.addEventListener("focus", () => {
    checkForNewRows();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkForNewRows();
    }
  });

  if (checkIntervalId !== null) {
    window.clearInterval(checkIntervalId);
  }
  checkIntervalId = window.setInterval(() => {
    checkForNewRows();
  }, 3500);
}

export async function loadTableDetails(
  tableId: string,
  tableTitle: string
): Promise<void> {
  closeRowModal();
  currentTableId = tableId;
  currentTableTitle = tableTitle;

  const tableTitleEl =
    document.getElementById("table-title") ||
    (document.querySelector(".table-title") as HTMLElement | null);
  if (tableTitleEl) {
    tableTitleEl.textContent = tableTitle;
  }

  if (tableId && tableId !== "0" && tableId !== "") {
    currentDetails = await fetchTableDetails(tableId);
    const checkRes = await checkTableDetails(tableId);
    if (checkRes) {
      lastKnownCount = checkRes.count;
      lastKnownMaxId = checkRes.max_id;
    } else {
      lastKnownCount = currentDetails.length;
      lastKnownMaxId = 0;
    }
  } else {
    currentDetails = [];
    lastKnownCount = 0;
    lastKnownMaxId = 0;
  }

  renderHeader();
  syncTableDetails(currentDetails, false);
  initAutoCheckListeners();
}
