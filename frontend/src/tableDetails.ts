export interface TableDetail {
  id: number;
  table_id: number;
  annotation: string | null;
  name: string;
  link: string | null;
  creation_date?: string | null;
  position?: number | null;
}

let currentTableId: number = 0;
let currentTableTitle: string = "";
let currentDetails: TableDetail[] = [];
let selectedIds: Set<number> = new Set<number>();
let draggedRowIndex: number | null = null;

export async function fetchTableDetails(tableId: number): Promise<TableDetail[]> {
  try {
    const response = await fetch(`/${tableId}/table_details`);
    if (!response.ok) {
      throw new Error(`Failed to fetch table details: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching table details:", error);
    return [];
  }
}

export async function saveRowOrderToDB(
  tableId: number,
  ids: number[]
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
    if (!response.ok) {
      throw new Error(`Failed to reorder rows: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error saving row order to database:", error);
  }
}

export async function createTableDetail(
  tableId: number,
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

export async function deleteTableDetailsBatch(ids: number[]): Promise<boolean> {
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
  } catch (error) {
    console.error("Error deleting items:", error);
    alert("Failed to delete selected items. Please try again.");
    return false;
  }
}

function updateSelectionToolbar(): void {
  const toolbar = document.getElementById("selection-toolbar");
  const countLabel = document.getElementById("selection-count");
  const selectAllCheckbox = document.getElementById(
    "select-all-checkbox"
  ) as HTMLInputElement | null;

  if (selectAllCheckbox) {
    if (currentDetails.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (selectedIds.size === currentDetails.length) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else if (selectedIds.size > 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }

  if (toolbar && countLabel) {
    if (selectedIds.size > 0) {
      toolbar.style.display = "flex";
      countLabel.textContent = `${selectedIds.size} selected`;
    } else {
      toolbar.style.display = "none";
    }
  }

  const tbody = document.getElementById("table-details-body");
  if (tbody) {
    tbody.querySelectorAll("tr.table_row").forEach((row) => {
      const rowElement = row as HTMLTableRowElement;
      const rowId = Number(rowElement.dataset.rowId);
      if (selectedIds.has(rowId)) {
        rowElement.classList.add("selected");
      } else {
        rowElement.classList.remove("selected");
      }
    });
  }
}

function renderHeader(): void {
  const thead =
    document.getElementById("table-details-head") ||
    document.querySelector(".data-table thead");
  if (!thead) return;

  thead.innerHTML = `
    <tr>
      <th class="col-select">
        <input
          type="checkbox"
          id="select-all-checkbox"
          class="table_checkbox"
          title="Select all"
          aria-label="Select all rows"
        />
      </th>
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

  const selectAll = document.getElementById(
    "select-all-checkbox"
  ) as HTMLInputElement | null;
  if (selectAll) {
    selectAll.addEventListener("change", () => {
      if (selectAll.checked) {
        currentDetails.forEach((d) => selectedIds.add(d.id));
      } else {
        selectedIds.clear();
      }
      const tbody = document.getElementById("table-details-body");
      if (tbody) {
        tbody
          .querySelectorAll<HTMLInputElement>(".row_checkbox")
          .forEach((cb) => {
            cb.checked = selectAll.checked;
          });
      }
      updateSelectionToolbar();
    });
  }
}

function renderRows(): void {
  const tbody =
    document.getElementById("table-details-body") ||
    document.querySelector(".data-table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  currentDetails.forEach((detail, index) => {
    const row = document.createElement("tr");
    row.className = "table_row";
    row.dataset.rowId = String(detail.id);
    row.dataset.rowIndex = String(index);
    row.draggable = true;

    if (selectedIds.has(detail.id)) {
      row.classList.add("selected");
    }

    const selectCell = document.createElement("td");
    selectCell.className = "col-select";

    const dragHandle = document.createElement("i");
    dragHandle.className = "fa-solid fa-grip-vertical row_drag_handle";
    dragHandle.title = "Drag to reorder row";

    const rowCheckbox = document.createElement("input");
    rowCheckbox.type = "checkbox";
    rowCheckbox.className = "table_checkbox row_checkbox";
    rowCheckbox.checked = selectedIds.has(detail.id);
    rowCheckbox.setAttribute("aria-label", `Select ${detail.name}`);

    rowCheckbox.addEventListener("change", (e: Event) => {
      e.stopPropagation();
      if (rowCheckbox.checked) {
        selectedIds.add(detail.id);
      } else {
        selectedIds.delete(detail.id);
      }
      updateSelectionToolbar();
    });

    selectCell.appendChild(dragHandle);
    selectCell.appendChild(rowCheckbox);
    row.appendChild(selectCell);

    const detailsCell = document.createElement("td");
    detailsCell.className = "col-details";
    const detailsBtn = document.createElement("button");
    detailsBtn.className = "table_details_btn";
    detailsBtn.setAttribute("aria-label", "Details");
    detailsBtn.title = "Details";
    detailsBtn.innerHTML = '<i class="fa-regular fa-pen-to-square"></i>';
    detailsBtn.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      console.log("Detail item clicked:", detail);
    });
    detailsCell.appendChild(detailsBtn);
    row.appendChild(detailsCell);

    const nameCell = document.createElement("td");
    nameCell.className = "col-name";
    nameCell.textContent = detail.name;
    row.appendChild(nameCell);

    const linkCell = document.createElement("td");
    linkCell.className = "col-link";
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
      linkCell.appendChild(linkAnchor);
    } else {
      linkCell.textContent = "-";
    }
    row.appendChild(linkCell);

    row.addEventListener("dragstart", (e: DragEvent) => {
      draggedRowIndex = index;
      row.classList.add("row-dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(detail.id));
      }
    });

    row.addEventListener("dragover", (e: DragEvent) => {
      e.preventDefault();
      if (draggedRowIndex === null || draggedRowIndex === index) return;

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

      if (draggedRowIndex === null || draggedRowIndex === index) return;

      const [movedItem] = currentDetails.splice(draggedRowIndex, 1);
      let targetPos = index;
      if (draggedRowIndex < index && !isBelow) {
        targetPos = index - 1;
      } else if (draggedRowIndex > index && isBelow) {
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
        .forEach((r) =>
          r.classList.remove("row-dragging", "drag-over-top", "drag-over-bottom")
        );
    });

    tbody.appendChild(row);
  });

  if (currentTableId > 0) {
    const newRow = document.createElement("tr");
    newRow.className = "table_new_row";

    const newSelectCell = document.createElement("td");
    newSelectCell.className = "col-select new_row_plus";
    newSelectCell.innerHTML = '<i class="fa-solid fa-plus"></i>';
    newRow.appendChild(newSelectCell);

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
        updateSelectionToolbar();
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

    tbody.appendChild(newRow);
  } else if (currentDetails.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 4;
    emptyCell.className = "table_details_empty";
    emptyCell.textContent = "No details found for this table.";
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  }

  updateSelectionToolbar();
}

function initToolbarListeners(): void {
  const deleteBtn = document.getElementById("btn-delete-selected");
  const clearBtn = document.getElementById("btn-clear-selection");

  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (selectedIds.size === 0) return;
      const count = selectedIds.size;
      if (confirm(`Are you sure you want to delete ${count} selected item(s)?`)) {
        const idsToDelete = Array.from(selectedIds);
        const success = await deleteTableDetailsBatch(idsToDelete);
        if (success) {
          selectedIds.clear();
          currentDetails = await fetchTableDetails(currentTableId);
          renderRows();
          updateSelectionToolbar();
        }
      }
    };
  }

  if (clearBtn) {
    clearBtn.onclick = () => {
      selectedIds.clear();
      updateSelectionToolbar();
      const tbody = document.getElementById("table-details-body");
      if (tbody) {
        tbody
          .querySelectorAll<HTMLInputElement>(".row_checkbox")
          .forEach((cb) => {
            cb.checked = false;
          });
      }
    };
  }
}

export async function loadTableDetails(
  tableId: number,
  tableTitle: string
): Promise<void> {
  currentTableId = tableId;
  currentTableTitle = tableTitle;
  selectedIds.clear();

  const tableTitleEl =
    document.getElementById("table-title") ||
    (document.querySelector(".table-title") as HTMLElement | null);
  if (tableTitleEl) {
    tableTitleEl.textContent = tableTitle;
  }

  initToolbarListeners();

  if (tableId > 0) {
    currentDetails = await fetchTableDetails(tableId);
  } else {
    currentDetails = [];
  }

  renderHeader();
  renderRows();
}
