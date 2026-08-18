import { loadTableDetails } from "./tableDetails.js";

interface Table {
  id: number;
  description: string;
  columns_order?: string | null;
}

export function initSidebarToggle(
  layout: HTMLElement,
  sidebarToggle: HTMLElement,
  mainToggle: HTMLElement
): void {
  let lastSidebarWidth = "";

  function collapseSidebar(): void {
    lastSidebarWidth = layout.style.gridTemplateColumns;
    layout.style.gridTemplateColumns = "";
    layout.classList.add("sidebar-collapsed");
  }

  function expandSidebar(): void {
    layout.classList.remove("sidebar-collapsed");
    if (lastSidebarWidth) {
      layout.style.gridTemplateColumns = lastSidebarWidth;
    }
  }

  sidebarToggle.addEventListener("click", collapseSidebar);
  mainToggle.addEventListener("click", expandSidebar);
}

export function initSidebarResize(
  layout: HTMLElement,
  resizeHandle: HTMLElement
): void {
  const MIN_WIDTH = 120;
  const MAX_WIDTH = 400;

  let isResizing = false;

  resizeHandle.addEventListener("mousedown", (e: MouseEvent) => {
    e.preventDefault();
    isResizing = true;
    layout.classList.add("resizing");
    document.body.classList.add("resizing");
    resizeHandle.classList.add("active");
  });

  document.addEventListener("mousemove", (e: MouseEvent) => {
    if (!isResizing) return;
    const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
    layout.style.gridTemplateColumns = `${width}px 4px 1fr`;
  });

  document.addEventListener("mouseup", () => {
    if (!isResizing) return;
    isResizing = false;
    layout.classList.remove("resizing");
    document.body.classList.remove("resizing");
    resizeHandle.classList.remove("active");
  });
}

export async function createTable(
  description: string,
  container: HTMLElement
): Promise<void> {
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

    const table: Table = await response.json();

    await loadTables(container, table.id);
  } catch (error) {
    console.error("Error creating table:", error);
    alert("Failed to create table. Please try again.");
  }
}

export async function updateTable(
  table: Table,
  newDescription: string,
  container: HTMLElement
): Promise<void> {
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
  } catch (error) {
    console.error("Error updating table:", error);
    alert("Failed to update table description. Please try again.");
  }
}

export async function deleteTable(
  table: Table,
  container: HTMLElement
): Promise<void> {
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
  } catch (error) {
    console.error("Error deleting table:", error);
    alert("Failed to delete table. Please try again.");
  }
}

let isGlobalClickListenerInitialized = false;
let globalTablesContainer: HTMLElement | null = null;

export async function loadTables(
  container: HTMLElement,
  id_active_table: Number | null = null
): Promise<void> {
  globalTablesContainer = container;

  if (!isGlobalClickListenerInitialized) {
    isGlobalClickListenerInitialized = true;
    document.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".sidebar_item_menu") && globalTablesContainer) {
        globalTablesContainer
          .querySelectorAll(".sidebar_item_dropdown.open")
          .forEach((d) => d.classList.remove("open"));
      }
    });
  }

  const response = await fetch("/1/tables");
  const tables: Table[] = await response.json();

  container.innerHTML = "";

  if (tables.length === 0) {
    loadTableDetails(0, "No Tables");
    return;
  }

  let activeTable = tables[0];
  if (id_active_table !== null && id_active_table !== undefined) {
    const found = tables.find((t) => t.id == id_active_table);
    if (found) {
      activeTable = found;
    }
  }

  loadTableDetails(activeTable.id, activeTable.description);

  tables.forEach((table) => {
    const containerTable = document.createElement("div");
    containerTable.dataset.tableId = String(table.id);

    const item = document.createElement("div");
    item.className = "sidebar_item";

    if (table.id === activeTable.id) {
      item.className += " active";
    }

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
    deleteBtn.className =
      "sidebar_dropdown_action sidebar_dropdown_action--danger";
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';

    dropdown.appendChild(renameBtn);
    dropdown.appendChild(deleteBtn);

    item.appendChild(label);
    item.appendChild(menuBtn);

    item.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        item.classList.contains("editing") ||
        target.closest(".sidebar_item_menu") ||
        target.closest(".sidebar_item_dropdown")
      ) {
        return;
      }
      container
        .querySelectorAll(".sidebar_item")
        .forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      loadTableDetails(table.id, table.description);
    });

    menuBtn.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      container
        .querySelectorAll(".sidebar_item_dropdown.open")
        .forEach((d) => {
          if (d !== dropdown) d.classList.remove("open");
        });

      if (!dropdown.classList.contains("open")) {
        const rect = menuBtn.getBoundingClientRect();
        dropdown.style.top = `${rect.top}px`;
        dropdown.style.left = `${rect.right + 8}px`;
        dropdown.style.right = "auto";
      }
      dropdown.classList.toggle("open");
    });

    renameBtn.addEventListener("click", (e: MouseEvent) => {
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
        if (!newDesc) return;
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

      saveBtn.addEventListener("click", (ev: MouseEvent) => {
        ev.stopPropagation();
        handleSave();
      });

      cancelBtn.addEventListener("click", (ev: MouseEvent) => {
        ev.stopPropagation();
        handleCancel();
      });

      input.addEventListener("keydown", (ev: KeyboardEvent) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          handleSave();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          handleCancel();
        }
      });
    });

    deleteBtn.addEventListener("click", async (e: MouseEvent) => {
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

export function createTempTableCard(container: HTMLElement): void {
  const existingTempInput = container.querySelector(
    ".temp_table_card .sidebar_item_input"
  ) as HTMLInputElement | null;
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

  saveBtn.addEventListener("click", (ev: MouseEvent) => {
    ev.stopPropagation();
    handleSave();
  });

  cancelBtn.addEventListener("click", (ev: MouseEvent) => {
    ev.stopPropagation();
    handleCancel();
  });

  input.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      handleSave();
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      handleCancel();
    }
  });
}

export function initAddTable(
  addBtn: HTMLElement,
  container: HTMLElement
): void {
  addBtn.addEventListener("click", () => {
    createTempTableCard(container);
  });
}
