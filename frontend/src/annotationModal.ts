import { TableDetail } from "./tableDetails.js";

declare const EditorJS: any;

let modalBackdrop: HTMLElement | null = null;
let modalWindow: HTMLElement | null = null;
let titleEl: HTMLElement | null = null;
let badgeEl: HTMLElement | null = null;
let closeBtn: HTMLButtonElement | null = null;
let maximizeBtn: HTMLButtonElement | null = null;
let footerSaveBtn: HTMLButtonElement | null = null;
let toastEl: HTMLElement | null = null;
let editorHolderEl: HTMLElement | null = null;
let resizeHandle: HTMLElement | null = null;

let editorInstance: any = null;
let currentDetail: TableDetail | null = null;
let isUnsaved: boolean = false;
let onSaveCallback: ((updatedDetail: TableDetail) => Promise<boolean | void>) | null = null;
let isMaximized: boolean = false;

function showToast(message: string): void {
  if (!toastEl) return;
  toastEl.innerHTML = `<i class="fa-solid fa-check"></i> ${message}`;
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl?.classList.remove("show");
  }, 2200);
}

function updateBadgeStatus(saved: boolean): void {
  if (!badgeEl) return;
  if (saved) {
    badgeEl.textContent = "Saved";
    badgeEl.className = "annotation_modal_badge saved";
    isUnsaved = false;
  } else {
    badgeEl.textContent = "Unsaved changes";
    badgeEl.className = "annotation_modal_badge unsaved";
    isUnsaved = true;
  }
}

function toggleMaximize(): void {
  if (!modalWindow || !maximizeBtn) return;
  isMaximized = !isMaximized;
  if (isMaximized) {
    modalWindow.classList.add("maximized");
    maximizeBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
    maximizeBtn.title = "Restore size";
  } else {
    modalWindow.classList.remove("maximized");
    maximizeBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    maximizeBtn.title = "Maximize window";
  }
}

function initResizeHandler(handle: HTMLElement, windowEl: HTMLElement): void {
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;

  const onMouseDown = (e: MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = windowEl.offsetWidth;
    startHeight = windowEl.offsetHeight;

    document.body.style.cursor = "se-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const minWidth = 540;
      const minHeight = 440;
      const maxWidth = window.innerWidth * 0.96;
      const maxHeight = window.innerHeight * 0.94;

      const newWidth = Math.min(Math.max(startWidth + deltaX, minWidth), maxWidth);
      const newHeight = Math.min(Math.max(startHeight + deltaY, minHeight), maxHeight);

      windowEl.style.width = `${newWidth}px`;
      windowEl.style.height = `${newHeight}px`;
    };

    const onMouseUp = () => {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  handle.addEventListener("mousedown", onMouseDown);
}

function parseContentToEditorJSData(content: string | null): any {
  if (!content || content.trim() === "") {
    return {
      time: Date.now(),
      blocks: [],
      version: "2.30.0",
    };
  }

  try {
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.blocks)) {
      return parsed;
    }
  } catch (_e) {}

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = content;

  const blocks: any[] = [];
  const children = Array.from(tempDiv.children);

  if (children.length === 0 && tempDiv.textContent?.trim()) {
    blocks.push({
      type: "paragraph",
      data: {
        text: tempDiv.textContent.trim(),
      },
    });
  } else {
    children.forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
        const level = parseInt(tag.replace("h", ""), 10) || 2;
        blocks.push({
          type: "header",
          data: {
            text: child.innerHTML,
            level: Math.min(Math.max(level, 1), 4),
          },
        });
      } else if (tag === "ul" || tag === "ol") {
        const items = Array.from(child.querySelectorAll("li")).map((li) => li.innerHTML);
        blocks.push({
          type: "list",
          data: {
            style: tag === "ol" ? "ordered" : "unordered",
            items: items.length > 0 ? items : [child.innerHTML],
          },
        });
      } else if (tag === "blockquote") {
        blocks.push({
          type: "quote",
          data: {
            text: child.innerHTML,
            caption: "",
            alignment: "left",
          },
        });
      } else if (tag === "pre") {
        blocks.push({
          type: "code",
          data: {
            code: child.textContent || "",
          },
        });
      } else if (tag === "hr") {
        blocks.push({
          type: "delimiter",
          data: {},
        });
      } else if (tag === "img") {
        blocks.push({
          type: "image",
          data: {
            file: {
              url: (child as HTMLImageElement).src,
            },
            caption: (child as HTMLImageElement).alt || "",
          },
        });
      } else {
        const text = child.innerHTML.trim();
        if (text && text !== "<br>") {
          blocks.push({
            type: "paragraph",
            data: {
              text: text,
            },
          });
        }
      }
    });
  }

  return {
    time: Date.now(),
    blocks: blocks.length > 0 ? blocks : [{ type: "paragraph", data: { text: "" } }],
    version: "2.30.0",
  };
}

function buildEditorJSTools(): any {
  const w = window as any;
  const tools: any = {};

  if (w.Header) {
    tools.header = {
      class: w.Header,
      inlineToolbar: ["link", "marker", "bold", "italic"],
      config: {
        placeholder: "Heading...",
        levels: [1, 2, 3, 4],
        defaultLevel: 2,
      },
      shortcut: "CMD+SHIFT+H",
    };
  }

  const listTool = w.EditorjsList || w.List;
  if (listTool) {
    tools.list = {
      class: listTool,
      inlineToolbar: true,
      config: {
        defaultStyle: "unordered",
      },
      shortcut: "CMD+SHIFT+L",
    };
  }

  if (w.Checklist) {
    tools.checklist = {
      class: w.Checklist,
      inlineToolbar: true,
      shortcut: "CMD+SHIFT+C",
    };
  }

  if (w.Quote) {
    tools.quote = {
      class: w.Quote,
      inlineToolbar: true,
      config: {
        quotePlaceholder: "Enter a quote...",
        captionPlaceholder: "Quote author...",
      },
      shortcut: "CMD+SHIFT+O",
    };
  }

  const codeTool = w.CodeTool || w.Code;
  if (codeTool) {
    tools.code = {
      class: codeTool,
      shortcut: "CMD+SHIFT+P",
    };
  }

  if (w.Embed) {
    tools.embed = {
      class: w.Embed,
      config: {
        services: {
          youtube: true,
          vimeo: true,
          coub: true,
          codepen: true,
        },
      },
    };
  }

  if (w.Table) {
    tools.table = {
      class: w.Table,
      inlineToolbar: true,
      config: {
        rows: 2,
        cols: 3,
      },
    };
  }

  if (w.Delimiter) {
    tools.delimiter = w.Delimiter;
  }

  if (w.Marker) {
    tools.marker = {
      class: w.Marker,
      shortcut: "CMD+SHIFT+M",
    };
  }

  if (w.InlineCode) {
    tools.inlineCode = {
      class: w.InlineCode,
      shortcut: "CMD+SHIFT+C",
    };
  }

  const imageTool = w.ImageTool || w.Image;
  if (imageTool) {
    tools.image = {
      class: imageTool,
      config: {
        uploader: {
          async uploadByFile(file: File) {
            try {
              const compressedBlob = await compressImageFile(file);
              const formData = new FormData();
              const filename = file.name ? file.name.replace(/\.[^/.]+$/, "") + ".webp" : "image.webp";
              formData.append("image", compressedBlob, filename);

              const res = await fetch("/upload/image", {
                method: "POST",
                body: formData,
              });

              if (!res.ok) {
                return { success: 0 };
              }

              const data = await res.json();
              return {
                success: 1,
                file: {
                  url: data.file.url,
                },
              };
            } catch (_) {
              return { success: 0 };
            }
          },
          uploadByUrl(url: string) {
            return Promise.resolve({
              success: 1,
              file: {
                url: url,
              },
            });
          },
        },
      },
    };
  }

  return tools;
}

function compressImageFile(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    if (file.type === "image/svg+xml" || file.type === "image/gif") {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDimension = 1920;
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        "image/webp",
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}


function createModalDOM(): void {
  if (modalBackdrop) return;

  modalBackdrop = document.createElement("div");
  modalBackdrop.className = "annotation_modal_backdrop";

  modalWindow = document.createElement("div");
  modalWindow.className = "annotation_modal_window";

  const header = document.createElement("div");
  header.className = "annotation_modal_header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "annotation_modal_title_group";

  titleEl = document.createElement("h3");
  titleEl.className = "annotation_modal_title";
  titleEl.textContent = "Notes";

  badgeEl = document.createElement("span");
  badgeEl.className = "annotation_modal_badge saved";
  badgeEl.textContent = "Saved";

  titleGroup.appendChild(titleEl);
  titleGroup.appendChild(badgeEl);

  const actions = document.createElement("div");
  actions.className = "annotation_modal_actions";

  maximizeBtn = document.createElement("button");
  maximizeBtn.className = "annotation_modal_btn annotation_modal_btn--icon";
  maximizeBtn.setAttribute("aria-label", "Maximize window");
  maximizeBtn.title = "Maximize window";
  maximizeBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';

  closeBtn = document.createElement("button");
  closeBtn.className = "annotation_modal_btn annotation_modal_btn--close";
  closeBtn.setAttribute("aria-label", "Close modal");
  closeBtn.title = "Close (Esc)";
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';

  actions.appendChild(maximizeBtn);
  actions.appendChild(closeBtn);

  header.appendChild(titleGroup);
  header.appendChild(actions);

  const body = document.createElement("div");
  body.className = "annotation_modal_body";

  const editorContainer = document.createElement("div");
  editorContainer.className = "annotation_editor_container";

  editorHolderEl = document.createElement("div");
  editorHolderEl.id = "editorjs-holder";
  editorHolderEl.className = "editorjs_canvas_holder";

  editorContainer.appendChild(editorHolderEl);
  body.appendChild(editorContainer);

  toastEl = document.createElement("div");
  toastEl.className = "annotation_modal_toast";
  toastEl.innerHTML = '<i class="fa-solid fa-check"></i> Note saved successfully!';
  body.appendChild(toastEl);

  const footer = document.createElement("div");
  footer.className = "annotation_modal_footer";

  const hint = document.createElement("div");
  hint.className = "annotation_modal_hint";
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shortcutKey = isMac ? "⌘S" : "Ctrl+S";
  hint.innerHTML = `<i class="fa-regular fa-keyboard"></i> Press <kbd>${shortcutKey}</kbd> to save &nbsp;|&nbsp; <kbd>Esc</kbd> to close`;

  const footerActions = document.createElement("div");
  footerActions.className = "annotation_modal_actions";

  footerSaveBtn = document.createElement("button");
  footerSaveBtn.className = "annotation_modal_btn annotation_modal_btn--primary";
  footerSaveBtn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Save';

  footerActions.appendChild(footerSaveBtn);

  footer.appendChild(hint);
  footer.appendChild(footerActions);

  resizeHandle = document.createElement("div");
  resizeHandle.className = "annotation_modal_resize_handle";
  resizeHandle.title = "Drag to resize";

  modalWindow.appendChild(header);
  modalWindow.appendChild(body);
  modalWindow.appendChild(footer);
  modalWindow.appendChild(resizeHandle);
  modalBackdrop.appendChild(modalWindow);
  document.body.appendChild(modalBackdrop);

  initResizeHandler(resizeHandle, modalWindow);

  const handleSave = async () => {
    await saveAnnotation();
  };

  const handleClose = () => {
    closeAnnotationModal();
  };

  footerSaveBtn.addEventListener("click", handleSave);
  closeBtn.addEventListener("click", handleClose);
  maximizeBtn.addEventListener("click", toggleMaximize);

  let mouseDownOnBackdrop = false;
  modalBackdrop.addEventListener("mousedown", (e: MouseEvent) => {
    mouseDownOnBackdrop = e.target === modalBackdrop;
  });

  modalBackdrop.addEventListener("mouseup", (e: MouseEvent) => {
    if (mouseDownOnBackdrop && e.target === modalBackdrop) {
      closeAnnotationModal();
    }
    mouseDownOnBackdrop = false;
  });

  modalWindow.addEventListener("click", (e: MouseEvent) => {
    e.stopPropagation();
  });

  window.addEventListener("keydown", async (e: KeyboardEvent) => {
    if (!modalBackdrop?.classList.contains("active")) return;

    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      await saveAnnotation();
    } else if (e.key === "Escape") {
      const openPopover = document.querySelector(".ce-popover--opened, .ce-inline-toolbar--showed");
      if (openPopover) {
        return;
      }
      e.preventDefault();
      closeAnnotationModal();
    }
  });
}

async function initEditorInstance(initialData: any): Promise<void> {
  if (editorInstance && typeof editorInstance.destroy === "function") {
    try {
      await editorInstance.destroy();
    } catch (_e) {}
    editorInstance = null;
  }

  const editorGlobal = (window as any).EditorJS || (typeof EditorJS !== "undefined" ? EditorJS : null);
  if (!editorGlobal || !editorHolderEl) {
    console.error("EditorJS is not loaded from CDN.");
    return;
  }

  editorHolderEl.innerHTML = "";

  const tools = buildEditorJSTools();

  editorInstance = new editorGlobal({
    holder: "editorjs-holder",
    tools: tools,
    data: initialData,
    placeholder: "Type '/' for commands or start typing...",
    autofocus: true,
    onChange: () => {
      updateBadgeStatus(false);
    },
  });

  await editorInstance.isReady;
}

export async function saveAnnotation(): Promise<boolean> {
  if (!editorInstance || !currentDetail) return false;

  try {
    const outputData = await editorInstance.save();
    const cleanContent =
      outputData.blocks.length === 0 ||
      (outputData.blocks.length === 1 &&
        outputData.blocks[0].type === "paragraph" &&
        !outputData.blocks[0].data.text?.trim())
        ? null
        : JSON.stringify(outputData);

    currentDetail.annotation = cleanContent;

    if (onSaveCallback) {
      await onSaveCallback(currentDetail);
    }

    updateBadgeStatus(true);
    showToast("Note saved successfully!");
    return true;
  } catch (err) {
    console.error("Error saving EditorJS content:", err);
    return false;
  }
}

export async function openAnnotationModal(
  detail: TableDetail,
  onSave: (updatedDetail: TableDetail) => Promise<boolean | void>
): Promise<void> {
  createModalDOM();

  currentDetail = detail;
  onSaveCallback = onSave;

  if (titleEl) {
    titleEl.textContent = `${detail.name} — Note`;
  }

  updateBadgeStatus(true);
  modalBackdrop?.classList.add("active");

  const initialData = parseContentToEditorJSData(detail.annotation);
  await initEditorInstance(initialData);
}

export async function closeAnnotationModal(): Promise<void> {
  if (!modalBackdrop?.classList.contains("active")) return;

  if (isUnsaved) {
    const discardConfirmed = confirm(
      "You have unsaved changes. Do you really want to discard them and exit?"
    );
    if (!discardConfirmed) {
      return;
    }
  }

  modalBackdrop?.classList.remove("active");
  currentDetail = null;
}
