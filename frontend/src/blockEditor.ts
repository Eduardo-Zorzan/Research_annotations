export interface BlockCommand {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  badge?: string;
  previewTitle: string;
  previewDesc: string;
  previewSample: string;
  action: (editor: BlockEditor) => void;
}

export class BlockEditor {
  private container: HTMLElement;
  private editable: HTMLElement;
  private slashMenu: HTMLElement;
  private previewCard: HTMLElement;
  private searchInput: HTMLInputElement;
  private menuList: HTMLElement;
  private bubbleToolbar: HTMLElement;
  private mediaModal: HTMLElement;
  
  private activeCommandIndex: number = 0;
  private filteredCommands: BlockCommand[] = [];
  private isMenuOpen: boolean = false;
  private savedSelection: Range | null = null;
  private onChangeCallback: (() => void) | null = null;

  private commands: BlockCommand[] = [
    {
      id: "text",
      title: "Text",
      subtitle: "Just start writing with plain text.",
      icon: '<span class="slash_icon_text">T</span>',
      previewTitle: "Plain Text",
      previewDesc: "Start writing with plain text without special formatting.",
      previewSample: "<p>This is a plain text paragraph for your notes.</p>",
      action: () => this.formatBlock("p"),
    },
    {
      id: "h1",
      title: "Heading 1",
      subtitle: "Big section heading.",
      badge: "#",
      icon: '<span class="slash_icon_h">H1</span>',
      previewTitle: "Heading 1",
      previewDesc: "Top-level heading for major sections.",
      previewSample: '<h1 style="font-size:22px; font-weight:700; margin:0;">Main Heading</h1>',
      action: () => this.formatBlock("h1"),
    },
    {
      id: "h2",
      title: "Heading 2",
      subtitle: "Medium section heading.",
      badge: "##",
      icon: '<span class="slash_icon_h">H2</span>',
      previewTitle: "Heading 2",
      previewDesc: "Medium subheading to organize topics.",
      previewSample: '<h2 style="font-size:18px; font-weight:600; margin:0;">Section Subheading</h2>',
      action: () => this.formatBlock("h2"),
    },
    {
      id: "h3",
      title: "Heading 3",
      subtitle: "Small section heading.",
      badge: "###",
      icon: '<span class="slash_icon_h">H3</span>',
      previewTitle: "Heading 3",
      previewDesc: "Smaller subheading for specific items.",
      previewSample: '<h3 style="font-size:15px; font-weight:600; margin:0;">Specific Topic</h3>',
      action: () => this.formatBlock("h3"),
    },
    {
      id: "h4",
      title: "Heading 4",
      subtitle: "Sub-item heading.",
      badge: "####",
      icon: '<span class="slash_icon_h">H4</span>',
      previewTitle: "Heading 4",
      previewDesc: "Lowest-level heading for details.",
      previewSample: '<h4 style="font-size:13px; font-weight:600; margin:0; text-transform:uppercase; letter-spacing:0.5px;">Mini Topic</h4>',
      action: () => this.formatBlock("h4"),
    },
    {
      id: "bullet_list",
      title: "Bulleted list",
      subtitle: "Create a simple bulleted list.",
      badge: "-",
      icon: '<i class="fa-solid fa-list-ul"></i>',
      previewTitle: "Bulleted list",
      previewDesc: "Organize items in a bulleted point list.",
      previewSample: '<ul style="margin:0; padding-left:18px;"><li>First research item</li><li>Second relevant item</li></ul>',
      action: () => this.formatList("ul"),
    },
    {
      id: "numbered_list",
      title: "Numbered list",
      subtitle: "Create a list with numbering.",
      badge: "1.",
      icon: '<i class="fa-solid fa-list-ol"></i>',
      previewTitle: "Numbered list",
      previewDesc: "Sequence steps or numbered processes.",
      previewSample: '<ol style="margin:0; padding-left:18px;"><li>Initial step</li><li>Execution</li><li>Results</li></ol>',
      action: () => this.formatList("ol"),
    },
    {
      id: "task_list",
      title: "To-do list",
      subtitle: "Track tasks with a to-do list.",
      badge: "[]",
      icon: '<i class="fa-regular fa-square-check"></i>',
      previewTitle: "To-do list",
      previewDesc: "Interactive checkboxes to track completion.",
      previewSample: '<div style="display:flex; flex-direction:column; gap:4px;"><label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" checked disabled> <span style="text-decoration:line-through; opacity:0.6;">Research articles</span></label><label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" disabled> <span>Validate data</span></label></div>',
      action: () => this.insertTaskList(),
    },
    {
      id: "quote",
      title: "Quote",
      subtitle: "Capture a quote or note.",
      badge: ">",
      icon: '<i class="fa-solid fa-quote-left"></i>',
      previewTitle: "Quote",
      previewDesc: "Highlight thoughts, references, or key notes.",
      previewSample: '<blockquote style="border-left:3px solid #3b82f6; padding-left:10px; font-style:italic; margin:0; color:#64748b;">"Imagination is more important than knowledge."</blockquote>',
      action: () => this.formatBlock("blockquote"),
    },
    {
      id: "code",
      title: "Code block",
      subtitle: "Capture a code snippet.",
      badge: "```",
      icon: '<i class="fa-solid fa-code"></i>',
      previewTitle: "Code block",
      previewDesc: "Write or paste code snippets and formulas.",
      previewSample: '<pre style="background:#1e293b; color:#38bdf8; padding:8px; border-radius:4px; font-size:12px; margin:0;"><code>const data = fetch("/api");</code></pre>',
      action: () => this.insertCodeBlock(),
    },
    {
      id: "divider",
      title: "Divider",
      subtitle: "Visually divide blocks with a line.",
      badge: "---",
      icon: '<i class="fa-solid fa-minus"></i>',
      previewTitle: "Divider",
      previewDesc: "Separate content blocks with a subtle line.",
      previewSample: '<div style="padding:10px 0;"><hr style="border:none; border-top:1px solid #cbd5e1; margin:0;"></div>',
      action: () => this.insertDivider(),
    },
    {
      id: "image",
      title: "Image",
      subtitle: "Insert an image with URL or local file.",
      icon: '<i class="fa-regular fa-image"></i>',
      previewTitle: "Image",
      previewDesc: "Upload or embed image links.",
      previewSample: '<div style="background:#f1f5f9; padding:12px; text-align:center; border-radius:4px; font-size:12px; color:#64748b;"><i class="fa-regular fa-image" style="font-size:24px; margin-bottom:4px;"></i><br>Photo or Graphic</div>',
      action: () => this.openMediaPrompt("image"),
    },
    {
      id: "video",
      title: "Video",
      subtitle: "Embed from YouTube, Vimeo, or video link.",
      icon: '<i class="fa-brands fa-youtube"></i>',
      previewTitle: "Video",
      previewDesc: "Embed videos with an interactive player.",
      previewSample: '<div style="background:#0f172a; color:#f87171; padding:12px; text-align:center; border-radius:4px; font-size:12px;"><i class="fa-brands fa-youtube" style="font-size:24px;"></i><br><span style="color:#e2e8f0;">YouTube Player</span></div>',
      action: () => this.openMediaPrompt("video"),
    },
  ];

  constructor(parentContainer: HTMLElement) {
    this.container = parentContainer;
    this.container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "block_editor_wrapper";

    this.editable = document.createElement("div");
    this.editable.className = "block_editable_canvas";
    this.editable.contentEditable = "true";
    this.editable.setAttribute("spellcheck", "true");
    this.editable.setAttribute("data-placeholder", "Type '/' for commands or start typing...");

    wrapper.appendChild(this.editable);
    this.container.appendChild(wrapper);

    this.slashMenu = this.createSlashMenuDOM();
    this.previewCard = this.slashMenu.querySelector(".slash_preview_card") as HTMLElement;
    this.searchInput = this.slashMenu.querySelector(".slash_search_input") as HTMLInputElement;
    this.menuList = this.slashMenu.querySelector(".slash_menu_list") as HTMLElement;
    document.body.appendChild(this.slashMenu);

    this.bubbleToolbar = this.createBubbleToolbarDOM();
    document.body.appendChild(this.bubbleToolbar);

    this.mediaModal = this.createMediaModalDOM();
    document.body.appendChild(this.mediaModal);

    this.initEvents();
    this.filteredCommands = [...this.commands];
  }

  public setOnChange(callback: () => void): void {
    this.onChangeCallback = callback;
  }

  public getHTML(): string {
    const clone = this.editable.cloneNode(true) as HTMLElement;
    const originalCheckboxes = this.editable.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const cloneCheckboxes = clone.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    originalCheckboxes.forEach((orig, idx) => {
      if (cloneCheckboxes[idx]) {
        if (orig.checked) {
          cloneCheckboxes[idx].setAttribute("checked", "checked");
        } else {
          cloneCheckboxes[idx].removeAttribute("checked");
        }
      }
    });

    const content = clone.innerHTML.trim();
    if (content === "<p><br></p>" || content === "<p></p>" || content === "") {
      return "";
    }
    return content;
  }

  public setHTML(html: string): void {
    if (!html || html.trim() === "") {
      this.editable.innerHTML = "<p><br></p>";
    } else {
      this.editable.innerHTML = html;
    }
    this.attachTaskCheckboxListeners();
  }

  public focus(): void {
    this.editable.focus();
    if (this.editable.childNodes.length === 0) {
      this.editable.innerHTML = "<p><br></p>";
    }
  }

  public destroy(): void {
    this.slashMenu.remove();
    this.bubbleToolbar.remove();
    this.mediaModal.remove();
  }

  private createSlashMenuDOM(): HTMLElement {
    const menu = document.createElement("div");
    menu.className = "block_slash_menu";

    menu.innerHTML = `
      <div class="slash_menu_main">
        <div class="slash_search_box">
          <span class="slash_search_slash">/</span>
          <input type="text" class="slash_search_input" placeholder="Type to search" aria-label="Search block" />
        </div>
        <div class="slash_section_header">Basic blocks</div>
        <div class="slash_menu_list" role="listbox"></div>
        <div class="slash_menu_footer">
          <span>Close menu</span>
          <kbd>esc</kbd>
        </div>
      </div>
      <div class="slash_preview_card">
        <div class="slash_preview_sample"></div>
        <div class="slash_preview_content">
          <div class="slash_preview_title"></div>
          <div class="slash_preview_desc"></div>
        </div>
      </div>
    `;

    return menu;
  }

  private createBubbleToolbarDOM(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "block_bubble_toolbar";
    bar.innerHTML = `
      <button type="button" class="bubble_btn" data-command="bold" title="Bold (Ctrl+B)">
        <i class="fa-solid fa-bold"></i>
      </button>
      <button type="button" class="bubble_btn" data-command="italic" title="Italic (Ctrl+I)">
        <i class="fa-solid fa-italic"></i>
      </button>
      <button type="button" class="bubble_btn" data-command="underline" title="Underline (Ctrl+U)">
        <i class="fa-solid fa-underline"></i>
      </button>
      <button type="button" class="bubble_btn" data-command="strikeThrough" title="Strikethrough">
        <i class="fa-solid fa-strikethrough"></i>
      </button>
      <div class="bubble_divider"></div>
      <div class="bubble_color_group">
        <button type="button" class="bubble_btn" id="bubble-text-color-btn" title="Text color">
          <i class="fa-solid fa-font"></i>
          <span class="bubble_color_bar" style="background:#3b82f6;"></span>
        </button>
        <div class="bubble_color_palette">
          <span class="color_swatch" data-color="#1e293b" style="background:#1e293b;" title="Default"></span>
          <span class="color_swatch" data-color="#ef4444" style="background:#ef4444;" title="Red"></span>
          <span class="color_swatch" data-color="#f59e0b" style="background:#f59e0b;" title="Orange"></span>
          <span class="color_swatch" data-color="#10b981" style="background:#10b981;" title="Green"></span>
          <span class="color_swatch" data-color="#3b82f6" style="background:#3b82f6;" title="Blue"></span>
          <span class="color_swatch" data-color="#8b5cf6" style="background:#8b5cf6;" title="Purple"></span>
          <span class="color_swatch" data-color="#ec4899" style="background:#ec4899;" title="Pink"></span>
        </div>
      </div>
      <div class="bubble_color_group">
        <button type="button" class="bubble_btn" id="bubble-bg-color-btn" title="Background highlight">
          <i class="fa-solid fa-highlighter"></i>
          <span class="bubble_color_bar" style="background:#fef08a;"></span>
        </button>
        <div class="bubble_color_palette">
          <span class="color_swatch" data-bg="transparent" style="background:#ffffff; border:1px dashed #94a3b8;" title="None"></span>
          <span class="color_swatch" data-bg="#fee2e2" style="background:#fee2e2;" title="Red"></span>
          <span class="color_swatch" data-bg="#fef3c7" style="background:#fef3c7;" title="Yellow"></span>
          <span class="color_swatch" data-bg="#d1fae5" style="background:#d1fae5;" title="Green"></span>
          <span class="color_swatch" data-bg="#dbeafe" style="background:#dbeafe;" title="Blue"></span>
          <span class="color_swatch" data-bg="#ede9fe" style="background:#ede9fe;" title="Purple"></span>
        </div>
      </div>
      <div class="bubble_divider"></div>
      <button type="button" class="bubble_btn" data-command="createLink" title="Link (Ctrl+K)">
        <i class="fa-solid fa-link"></i>
      </button>
    `;

    return bar;
  }

  private createMediaModalDOM(): HTMLElement {
    const modal = document.createElement("div");
    modal.className = "block_media_modal_backdrop";
    modal.innerHTML = `
      <div class="block_media_modal_window">
        <div class="block_media_modal_header">
          <h4 id="media-modal-title">Insert Media</h4>
          <button type="button" class="block_media_modal_close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="block_media_modal_body">
          <div class="media_input_group" id="media-url-group">
            <label id="media-url-label" for="media-url-input">Media URL:</label>
            <input type="text" id="media-url-input" placeholder="https://..." class="block_input_field" />
          </div>
          <div class="media_input_group" id="media-file-group">
            <label for="media-file-input">Or upload a file from your computer:</label>
            <input type="file" id="media-file-input" accept="image/*" class="block_file_field" />
          </div>
          <div class="media_input_group" id="media-caption-group">
            <label for="media-caption-input">Caption (optional):</label>
            <input type="text" id="media-caption-input" placeholder="Image caption..." class="block_input_field" />
          </div>
        </div>
        <div class="block_media_modal_footer">
          <button type="button" class="block_btn" id="media-cancel-btn">Cancel</button>
          <button type="button" class="block_btn block_btn--primary" id="media-confirm-btn">Insert</button>
        </div>
      </div>
    `;
    return modal;
  }

  private initEvents(): void {
    this.editable.addEventListener("input", (e: Event) => {
      this.handleInput(e);
      if (this.onChangeCallback) {
        this.onChangeCallback();
      }
    });

    this.editable.addEventListener("keydown", (e: KeyboardEvent) => {
      this.handleKeyDown(e);
    });

    this.searchInput.addEventListener("input", () => {
      const query = this.searchInput.value.toLowerCase().trim();
      this.filterCommands(query);
    });

    this.searchInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.navigateMenu(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.navigateMenu(-1);
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          this.navigateMenu(-1);
        } else {
          this.navigateMenu(1);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.executeActiveCommand();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.closeSlashMenu();
      }
    });

    document.addEventListener("selectionchange", () => {
      if (this.isMenuOpen) return;
      this.updateBubbleToolbar();
    });

    this.bubbleToolbar.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const cmd = btn.getAttribute("data-command");
        if (cmd === "createLink") {
          const url = prompt("Enter URL link:", "https://");
          if (url) {
            document.execCommand("createLink", false, url);
          }
        } else if (cmd) {
          document.execCommand(cmd, false);
        }
        this.updateBubbleToolbar();
        if (this.onChangeCallback) this.onChangeCallback();
      });
    });

    this.bubbleToolbar.querySelectorAll<HTMLElement>("[data-color]").forEach((swatch) => {
      swatch.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const color = swatch.getAttribute("data-color");
        if (color) {
          document.execCommand("foreColor", false, color);
        }
        if (this.onChangeCallback) this.onChangeCallback();
      });
    });

    this.bubbleToolbar.querySelectorAll<HTMLElement>("[data-bg]").forEach((swatch) => {
      swatch.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const bg = swatch.getAttribute("data-bg");
        if (bg) {
          document.execCommand("hiliteColor", false, bg);
        }
        if (this.onChangeCallback) this.onChangeCallback();
      });
    });

    document.addEventListener("click", (e: MouseEvent) => {
      if (this.isMenuOpen && !this.slashMenu.contains(e.target as Node)) {
        this.closeSlashMenu();
      }
    });

    this.editable.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox") {
        const item = target.closest(".block_task_item");
        if (item) {
          if ((target as HTMLInputElement).checked) {
            item.classList.add("completed");
            target.setAttribute("checked", "checked");
          } else {
            item.classList.remove("completed");
            target.removeAttribute("checked");
          }
          if (this.onChangeCallback) this.onChangeCallback();
        }
      }
    });
  }

  private handleInput(_e: Event): void {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const text = node.textContent || "";
    const offset = range.startOffset;

    const beforeCaret = text.slice(0, offset);

    if (beforeCaret === "# ") {
      node.textContent = text.slice(offset);
      this.formatBlock("h1");
      return;
    } else if (beforeCaret === "## ") {
      node.textContent = text.slice(offset);
      this.formatBlock("h2");
      return;
    } else if (beforeCaret === "### ") {
      node.textContent = text.slice(offset);
      this.formatBlock("h3");
      return;
    } else if (beforeCaret === "#### ") {
      node.textContent = text.slice(offset);
      this.formatBlock("h4");
      return;
    } else if (beforeCaret === "- " || beforeCaret === "* ") {
      node.textContent = text.slice(offset);
      this.formatList("ul");
      return;
    } else if (beforeCaret === "1. ") {
      node.textContent = text.slice(offset);
      this.formatList("ol");
      return;
    } else if (beforeCaret === "[] " || beforeCaret === "[ ] ") {
      node.textContent = text.slice(offset);
      this.insertTaskList();
      return;
    } else if (beforeCaret === "> ") {
      node.textContent = text.slice(offset);
      this.formatBlock("blockquote");
      return;
    } else if (beforeCaret === "---" || beforeCaret === "--- ") {
      node.textContent = text.slice(offset);
      this.insertDivider();
      return;
    }

    const lastSlashIndex = beforeCaret.lastIndexOf("/");
    if (lastSlashIndex !== -1) {
      const charBeforeSlash = lastSlashIndex > 0 ? beforeCaret[lastSlashIndex - 1] : " ";
      if (charBeforeSlash === " " || charBeforeSlash === "\n" || lastSlashIndex === 0) {
        const query = beforeCaret.slice(lastSlashIndex + 1);
        if (!query.includes(" ")) {
          this.openSlashMenu(range, query);
          return;
        }
      }
    }

    if (this.isMenuOpen) {
      this.closeSlashMenu();
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.isMenuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.navigateMenu(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.navigateMenu(-1);
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          this.navigateMenu(-1);
        } else {
          this.navigateMenu(1);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.executeActiveCommand();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.closeSlashMenu();
      }
    } else {
      if (e.key === "Tab") {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const node = sel.anchorNode;
          const isInList = node instanceof HTMLElement ? node.closest("li, ul, ol") : node?.parentElement?.closest("li, ul, ol");
          
          if (isInList) {
            if (e.shiftKey) {
              document.execCommand("outdent", false);
            } else {
              document.execCommand("indent", false);
            }
          } else {
            if (e.shiftKey) {
              document.execCommand("outdent", false);
            } else {
              document.execCommand("insertHTML", false, "&nbsp;&nbsp;&nbsp;&nbsp;");
            }
          }
          if (this.onChangeCallback) {
            this.onChangeCallback();
          }
        }
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const node = sel.anchorNode;
          const taskItem = node instanceof HTMLElement ? node.closest(".block_task_item") : node?.parentElement?.closest(".block_task_item");
          if (taskItem) {
            const textContent = taskItem.querySelector(".task_text")?.textContent || "";
            if (textContent.trim() === "") {
              e.preventDefault();
              taskItem.remove();
              this.formatBlock("p");
              return;
            }
          }
        }
      }
    }
  }

  private openSlashMenu(range: Range, query: string): void {
    this.savedSelection = range.cloneRange();
    this.isMenuOpen = true;

    const rect = range.getBoundingClientRect();
    const menuTop = rect.bottom + window.scrollY + 6;
    const menuLeft = Math.max(16, Math.min(rect.left + window.scrollX, window.innerWidth - 620));

    this.slashMenu.style.top = `${menuTop}px`;
    this.slashMenu.style.left = `${menuLeft}px`;
    this.slashMenu.classList.add("active");

    this.searchInput.value = query;
    this.filterCommands(query);

    this.bubbleToolbar.classList.remove("active");
  }

  private closeSlashMenu(): void {
    this.isMenuOpen = false;
    this.slashMenu.classList.remove("active");
    this.searchInput.value = "";
  }

  private filterCommands(query: string): void {
    if (!query) {
      this.filteredCommands = [...this.commands];
    } else {
      this.filteredCommands = this.commands.filter((cmd) => {
        return (
          cmd.title.toLowerCase().includes(query) ||
          cmd.subtitle.toLowerCase().includes(query) ||
          (cmd.badge && cmd.badge.toLowerCase().includes(query)) ||
          cmd.id.toLowerCase().includes(query)
        );
      });
    }

    this.activeCommandIndex = 0;
    this.renderMenuList();
  }

  private renderMenuList(): void {
    this.menuList.innerHTML = "";

    if (this.filteredCommands.length === 0) {
      const empty = document.createElement("div");
      empty.className = "slash_empty_state";
      empty.textContent = "No commands found";
      this.menuList.appendChild(empty);
      this.previewCard.style.display = "none";
      return;
    }

    this.previewCard.style.display = "flex";

    this.filteredCommands.forEach((cmd, index) => {
      const item = document.createElement("div");
      item.className = `slash_menu_item ${index === this.activeCommandIndex ? "active" : ""}`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === this.activeCommandIndex));

      item.innerHTML = `
        <div class="slash_item_icon">${cmd.icon}</div>
        <div class="slash_item_details">
          <div class="slash_item_title">${cmd.title}</div>
        </div>
        ${cmd.badge ? `<div class="slash_item_badge">${cmd.badge}</div>` : ""}
      `;

      item.addEventListener("mouseenter", () => {
        this.activeCommandIndex = index;
        this.updateActiveMenuItem();
      });

      item.addEventListener("click", () => {
        this.activeCommandIndex = index;
        this.executeActiveCommand();
      });

      this.menuList.appendChild(item);
    });

    this.updatePreviewCard();
  }

  private updateActiveMenuItem(): void {
    const items = this.menuList.querySelectorAll(".slash_menu_item");
    items.forEach((it, idx) => {
      if (idx === this.activeCommandIndex) {
        it.classList.add("active");
        it.scrollIntoView({ block: "nearest" });
      } else {
        it.classList.remove("active");
      }
    });
    this.updatePreviewCard();
  }

  private updatePreviewCard(): void {
    const activeCmd = this.filteredCommands[this.activeCommandIndex];
    if (!activeCmd) return;

    const sampleEl = this.previewCard.querySelector(".slash_preview_sample") as HTMLElement;
    const titleEl = this.previewCard.querySelector(".slash_preview_title") as HTMLElement;
    const descEl = this.previewCard.querySelector(".slash_preview_desc") as HTMLElement;

    if (sampleEl) sampleEl.innerHTML = activeCmd.previewSample;
    if (titleEl) titleEl.textContent = activeCmd.previewTitle;
    if (descEl) descEl.textContent = activeCmd.previewDesc;
  }

  private navigateMenu(direction: number): void {
    if (this.filteredCommands.length === 0) return;
    this.activeCommandIndex = (this.activeCommandIndex + direction + this.filteredCommands.length) % this.filteredCommands.length;
    this.updateActiveMenuItem();
  }

  private executeActiveCommand(): void {
    const activeCmd = this.filteredCommands[this.activeCommandIndex];
    if (!activeCmd) return;

    this.cleanSlashQuery();
    this.closeSlashMenu();
    activeCmd.action(this);

    if (this.onChangeCallback) {
      this.onChangeCallback();
    }
  }

  private cleanSlashQuery(): void {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const text = node.textContent;
      const offset = range.startOffset;
      const lastSlash = text.slice(0, offset).lastIndexOf("/");
      if (lastSlash !== -1) {
        node.textContent = text.slice(0, lastSlash) + text.slice(offset);
        const newRange = document.createRange();
        newRange.setStart(node, Math.min(lastSlash, (node.textContent || "").length));
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    }
  }

  private formatBlock(tag: string): void {
    this.editable.focus();
    document.execCommand("formatBlock", false, `<${tag}>`);
  }

  private formatList(tag: "ul" | "ol"): void {
    this.editable.focus();
    if (tag === "ul") {
      document.execCommand("insertUnorderedList", false);
    } else {
      document.execCommand("insertOrderedList", false);
    }
  }

  private insertTaskList(): void {
    this.editable.focus();
    const taskHTML = `
      <ul class="block_task_list">
        <li class="block_task_item">
          <input type="checkbox" class="block_checkbox" />
          <span class="task_text" contenteditable="true">Task...</span>
        </li>
      </ul>
      <p><br></p>
    `;
    document.execCommand("insertHTML", false, taskHTML);
    this.attachTaskCheckboxListeners();
  }

  private insertCodeBlock(): void {
    this.editable.focus();
    const codeHTML = `
      <pre class="block_code_block"><code contenteditable="true">Write your code here...</code></pre>
      <p><br></p>
    `;
    document.execCommand("insertHTML", false, codeHTML);
  }

  private insertDivider(): void {
    this.editable.focus();
    const hrHTML = `<hr class="block_divider" /><p><br></p>`;
    document.execCommand("insertHTML", false, hrHTML);
  }

  private openMediaPrompt(type: "image" | "video"): void {
    const title = this.mediaModal.querySelector("#media-modal-title") as HTMLElement;
    const urlLabel = this.mediaModal.querySelector("#media-url-label") as HTMLElement;
    const urlInput = this.mediaModal.querySelector("#media-url-input") as HTMLInputElement;
    const fileGroup = this.mediaModal.querySelector("#media-file-group") as HTMLElement;
    const captionGroup = this.mediaModal.querySelector("#media-caption-group") as HTMLElement;
    const captionInput = this.mediaModal.querySelector("#media-caption-input") as HTMLInputElement;
    const fileInput = this.mediaModal.querySelector("#media-file-input") as HTMLInputElement;
    const confirmBtn = this.mediaModal.querySelector("#media-confirm-btn") as HTMLElement;
    const cancelBtn = this.mediaModal.querySelector("#media-cancel-btn") as HTMLElement;
    const closeBtn = this.mediaModal.querySelector(".block_media_modal_close") as HTMLElement;

    urlInput.value = "";
    captionInput.value = "";
    fileInput.value = "";

    if (type === "image") {
      title.textContent = "Insert Image";
      urlLabel.textContent = "Image URL:";
      urlInput.placeholder = "https://example.com/image.png";
      fileGroup.style.display = "block";
      captionGroup.style.display = "block";
    } else {
      title.textContent = "Embed Video";
      urlLabel.textContent = "YouTube or Video link:";
      urlInput.placeholder = "https://www.youtube.com/watch?v=...";
      fileGroup.style.display = "none";
      captionGroup.style.display = "none";
    }

    this.mediaModal.classList.add("active");
    urlInput.focus();

    const closeModal = () => {
      this.mediaModal.classList.remove("active");
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      closeBtn.onclick = null;
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
      const url = urlInput.value.trim();
      const caption = captionInput.value.trim();
      const file = fileInput.files?.[0];

      if (type === "image") {
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            this.insertImageHTML(dataUrl, caption);
            closeModal();
          };
          reader.readAsDataURL(file);
          return;
        } else if (url) {
          this.insertImageHTML(url, caption);
          closeModal();
        }
      } else {
        if (url) {
          this.insertVideoHTML(url);
          closeModal();
        }
      }
    };
  }

  private insertImageHTML(src: string, caption?: string): void {
    this.editable.focus();
    const captionHTML = caption ? `<figcaption class="block_image_caption">${caption}</figcaption>` : "";
    const html = `
      <figure class="block_image_block">
        <img src="${src}" alt="${caption || "Image"}" loading="lazy" />
        ${captionHTML}
      </figure>
      <p><br></p>
    `;
    document.execCommand("insertHTML", false, html);
    if (this.onChangeCallback) this.onChangeCallback();
  }

  private insertVideoHTML(url: string): void {
    this.editable.focus();
    let embedSrc = url;

    if (url.includes("youtube.com/watch?v=")) {
      const videoId = new URL(url).searchParams.get("v");
      if (videoId) embedSrc = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      if (videoId) embedSrc = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes("vimeo.com/")) {
      const videoId = url.split("vimeo.com/")[1]?.split("?")[0];
      if (videoId) embedSrc = `https://player.vimeo.com/video/${videoId}`;
    }

    const html = `
      <div class="block_video_block">
        <div class="block_video_aspect">
          <iframe src="${embedSrc}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
      </div>
      <p><br></p>
    `;
    document.execCommand("insertHTML", false, html);
    if (this.onChangeCallback) this.onChangeCallback();
  }

  private attachTaskCheckboxListeners(): void {
    this.editable.querySelectorAll<HTMLInputElement>(".block_task_list input[type='checkbox']").forEach((cb) => {
      const parent = cb.closest(".block_task_item");
      if (cb.hasAttribute("checked") || cb.checked) {
        cb.checked = true;
        parent?.classList.add("completed");
      }
    });
  }

  private updateBubbleToolbar(): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !this.editable.contains(sel.anchorNode)) {
      this.bubbleToolbar.classList.remove("active");
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      this.bubbleToolbar.classList.remove("active");
      return;
    }

    const top = rect.top + window.scrollY - 48;
    const left = Math.max(10, rect.left + window.scrollX + rect.width / 2 - 140);

    this.bubbleToolbar.style.top = `${top}px`;
    this.bubbleToolbar.style.left = `${left}px`;
    this.bubbleToolbar.classList.add("active");
  }
}
