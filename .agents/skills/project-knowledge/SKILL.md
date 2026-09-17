---
name: project-knowledge
description: >-
  Repository knowledge base, architectural reference, design decisions, user constraints, and running development log for the Research Annotations project. Activate on any development, feature implementation, refactoring, or architectural task in this project to record and follow project instructions.
---

# Research Annotations - Project Knowledge & Continuous Learning

This skill maintains the cumulative architectural knowledge, guidelines, and design decisions acquired during development. Every development task must document new knowledge and updates directly in this skill.

---

## 1. Core Rules & Constraints

1. **Strictly English Only**:
   - The entire user interface, labels, tooltips, dialogs, toasts, placeholders, button text, error messages, and documentation must be in **English**.
   - Never use Portuguese or any other language in the application.

2. **No Code Comments**:
   - Maintain the codebase completely clean without single-line (`//`), multi-line (`/* */`), or HTML (`<!-- -->`) comments in frontend or backend source files.

3. **No Automated Tests in Code**:
   - **NEVER** write automated unit tests, integration tests, or test modules (`#[cfg(test)]`, `mod tests`, etc.) into the codebase during current development.
   - The user tests manually during development. Automated testing will be configured separately later.

4. **Continuous Knowledge Recording**:
   - Every time a development task or change is requested and executed, update this skill with the newly acquired architectural patterns, endpoint behaviors, and implementation choices.

5. **Annotation & Details Modal UI Specifications**:
   - In Editor.js modal, hide only hover block handle icons (`+` plus tool and `::` drag handle) via `.ce-toolbar__plus, .ce-toolbar__settings-btn { display: none !important; }`.
   - Ensure the toolbar container and `.ce-popover` remain active so typing `/` triggers the block menu.
   - **Header**: Contains only Title, status badge ("Saved" / "Unsaved changes"), Maximize button, and Close (`X`) button.
   - **Footer**: Contains only keyboard hint (`Press ⌘S to save | Esc to close`) and primary **Save** button.
   - **Theme Support**: Fully adheres to dynamic theme changes (`data-theme`), updating modal window, canvas background, Editor.js text, popovers, inline toolbars, code blocks, tables, checklists, and footer. Multi-block selections (`.ce-block--selected .ce-block__content`) and inline selections (`::selection`) use translucent accent highlights (`rgba(59, 130, 246, 0.28)` in dark mode, `0.15` in light mode) preventing bright white block clashes with dark mode text.
   - **Discard Confirmation Modal**: Never use blocking browser `confirm()` or `alert()` dialogs, as native dialogs glitch macOS window management and un-maximize/minimize fullscreen Chrome windows. Use the custom in-app confirmation modal (`.confirm_modal_backdrop`, `.confirm_modal_window`) with 'Keep Editing' and 'Discard' buttons, properly capturing and preventing `Escape` event bubbling.
   - **Never Revert User Removals**: Never re-create elements, buttons, or layouts that the user has removed.


6. **Configuration / Settings Modal UI Specifications**:
   - Triggered via settings gear button (`#main-settings` / `.main_settings`) located on the top right corner.
   - **Appearance Section**: 3 preview cards for "Light", "Dark", and "System" themes. Themes are persisted in `localStorage` (`app_theme`), support OS `prefers-color-scheme` change listeners in "System" mode, and apply `[data-theme="dark"]` CSS variables.
   - **Backup Section**: Displays last backup datetime (`Backup Generated in {datetime}`), "Download" button to export a JSON backup, "Import" button to upload and restore JSON backup into SQLite in a transaction, and "Generate new backup" button to timestamp the backup.
   - **Token Section**: "Create new token" button which calls `/tokens` for a stateless encrypted token with user ID and expiration, displaying a security notice and copy-to-clipboard button.
   - **Account Section**: "Logout" button which deletes session cookie and redirects to login page (`/`).

7. **Login Page Always Dark Mode**:
   - The login interface (`login.html` and `login.css`) is permanently set to dark mode (`data-theme="dark"`), using dark backgrounds, dark card styling, and dark input fields.

8. **Data Table Dark Theme Specifications**:
   - In dark mode, `.table_new_row` uses `hsla(220, 18%, 18%, 0.4)` and hover `hsla(220, 18%, 22%, 0.5)` to seamlessly blend with the table.
   - Row hover uses `hsla(220, 14%, 26%, 0.4)` instead of light semi-transparent overlays.

---



## 2. System Architecture

### Backend (Rust / Axum / SQLite)
- **Framework**: Axum 0.8 on Tokio multi-thread runtime.
- **Database**: SQLite (`my_database.db`) using `rusqlite` bundled with mutex sharing (`Arc<Mutex<rusqlite::Connection>>`).
- **Static Assets**: Embedded into binary via `rust-embed` from `public/`.
- **Default Binary**: `default-run = "Project_tables"` in `Cargo.toml`.
- **CLI Utilities**: `src/bin/new_users.rs` (`cargo run --bin new_users`).

#### Database Schema:
- `users (id INTEGER PRIMARY KEY, name TEXT, password TEXT)`
- `tables (id INTEGER PRIMARY KEY, description TEXT, user_id INTEGER, position INTEGER DEFAULT 0)`
- `table_details (id INTEGER PRIMARY KEY, table_id INTEGER, annotation TEXT, name TEXT, link TEXT, creation_date TEXT, position INTEGER DEFAULT 0)`
- `backups (id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE, created_at TEXT, file_path TEXT)`

#### Cryptography & Authentication:
- `CryptoService` uses AES-256-GCM (`aes-gcm` crate) with 12-byte random nonce and Base64 output.
- `Keys::Login` (`LOGIN_KEY` in `.env`): Used for encrypting and decrypting user passwords in the `users` table.
- `Keys::Token` (`TOKEN_KEY` in `.env`): Used for stateless token encryption/decryption containing `user_id` and `expired_at`. Tokens do not require database persistence.
- `auth_middleware` (`src/handlers/auth.rs`): Applied to protected routes (`/home`, `/tables`, `/table_details`, `/backup/*`, `/tokens`) via `axum::middleware::from_fn`. Extracts session token from `Cookie` header (with `Authorization` header fallback) and validates expiration/signature. For unauthorized page navigations (`/home`), returns `Redirect::to("/")`; for unauthorized API requests, returns `401 Unauthorized`. Injects `AuthUser { user_id }` into request extensions for handlers.

#### Background Services:
- **Hourly Automated Backups**: Tokio background worker running at a 1-hour interval that iterates through all registered users and updates their `./backups/{user_id}/backup.json` and database records without user intervention.

#### REST API Endpoints:
- `GET /`: Serves login page (`login.html`).
- `POST /login`: Authenticates username & password, decrypts password via `Keys::Login`, returns `{ "token": "..." }` encrypted with `Keys::Token`.
- `GET /home`: Serves home dashboard (`home.html`) through `auth_middleware` (redirects unauthenticated sessions to `/`).
- `GET /tables`: Fetches tables for the authenticated user (`Extension<AuthUser>`) ordered by `position ASC, id ASC`.
- `POST /tables`, `PUT /tables`, `DELETE /tables`: Manage table cards for authenticated user.
- `PUT /tables/reorder`: Reorders table cards in an SQLite transaction.
- `GET /:table_id/table_details`: Fetches details rows ordered by `position ASC, id ASC`.
- `GET /:table_id/table_details/check`: Returns `{ "count": ..., "max_id": ... }` using a lightweight SQLite aggregation query for real-time change detection.
- `POST /table_details`, `PUT /table_details`, `DELETE /table_details`: Manage detail rows.
- `PUT /table_details/reorder`: Reorders detail rows in an SQLite transaction.
- `GET /backup/info`: Returns latest backup timestamp `{ "last_backup": "..." }` for authenticated user.
- `POST /backup/generate`: Overwrites/saves `./backups/{user_id}/backup.json` and updates SQLite record.
- `GET /backup/download`: Returns user's stored backup JSON file or 404 with error message if no backup exists on the server.
- `POST /backup/import`: Wipes/replaces existing tables and details in an SQLite transaction with imported backup payload data, and extracts/restores embedded base64 images to `./uploads/{user_id}/` (with frontend confirmation modal before execution).
- `POST /tokens`: Creates a new stateless encrypted token for authenticated user.
- `POST /upload/image`: Receives multipart image data, compresses on client, saves to `./uploads/{user_id}/`, and returns `{ "success": 1, "file": { "url": "/uploads/{user_id}/{filename}" } }`.
- `GET /uploads/:user_id/:filename`: Serves user-uploaded images through `auth_middleware`, validating user ownership (`auth_user.user_id == user_id`) with content type and cache headers.


---

### Frontend (TypeScript / Vanilla CSS)
- **Source**: `frontend/src/`
- **Output**: `public/js/` (compiled with `npx tsc`)
- **Modules**:
  - `login.ts`: Login form validation, async sign-in request, user session storage, error messaging.
  - `cookies.ts`: Reusable cookie management utility (`setCookie`, `getCookie`, `deleteCookie`).
  - `home.ts`: Layout initialization, sidebar toggle, resize handle, theme loading, config modal binding, and table loading.
  - `sidebar.ts`: Table card creation, inline renaming, deletion, drag-and-drop table reordering.
  - `tableDetails.ts`: Fixed columns (`Details`, `Name`, `Link`), row drag-and-drop reordering, inline cell editing, 3-dots row options. Long links exceeding 100 characters are truncated with an ellipsis and expand to full length on hover (tracked via `dataset.fullLink` to prevent polling re-renders). Keyed in-place DOM reconciliation (`syncTableDetails`) and real-time auto-checking (`checkForNewRows`) listening to window focus, document visibilitychange, and periodic polling (3.5s) to display new extension-added rows without losing active inline inputs, cursor positions, bottom new item drafts, or open modals.
  - `annotationModal.ts`: Resizable & maximizable rich text modal for notes using Editor.js, client-side canvas image downscaling/compression to WebP, and asynchronous image uploading. State getters (`isAnnotationModalOpen`, `getCurrentAnnotationDetailId`) protect ongoing note editing during table sync.
  - `blockEditor.ts`: Slash command / block editor module.
  - `configModal.ts`: Settings/Configuration modal handling theme selection, backup operations (info, generate, download, import with replacement confirmation dialog), token generation & copying, and user logout.

---

### Chrome Extension (Manifest V3)
- **Source**: `extension/`
- **Files**:
  - `manifest.json`: Manifest V3 configuration with `storage`, `activeTab`, `tabs` permissions and `<all_urls>` host permissions.
  - `popup.html`: Popup interface using FontAwesome 6 icons (`all.min.css`), containing theme switcher (`fa-sun`/`fa-moon`), settings modal trigger (`fa-gear`), custom DOM dropdown component for table selection (avoiding macOS native select coordinate misalignment), name annotation input, duplicate warning badge (`fa-triangle-exclamation`), primary add button (`fa-plus`), and modal close button (`fa-xmark`).
  - `popup.css`: CSS variables adapted from `public/style/variables.css` for both light and dark themes, with blur backdrop modal. Enforces strict 350px width constraints on `html`, `body`, and `.extension_container` with `overflow-x: hidden`, custom dropdown menu and option styles, and uses margin-auto centering (`left: 16px; right: 16px; margin: 0 auto; width: fit-content; max-width: calc(100% - 32px)`) with dedicated `toastFadeIn` animation to prevent Chrome popup window expansion.
  - `popup.js`: Pure async/await logic for token authentication with `credentials: "omit"` on all requests, custom dropdown menu controller, fetching tables and details, real-time duplicate name detection against existing rows in the selected table, tab URL & title capture, settings persistence, clearing input with duplicate badge reset and `fa-check` button feedback on addition.
  - `icons/`: High-resolution PNG icons (16px, 48px, 128px).
- **Backend CORS & Authentication Middleware**:
  - `cors_middleware` in `src/main.rs`: Responds to preflight `OPTIONS` requests with `204 No Content` and appropriate `Access-Control-Allow-*` headers, and attaches `Access-Control-Allow-Origin: *` to responses to enable external extension requests.
  - `auth_middleware` in `src/handlers/auth.rs`: Evaluates `token_from_header` (`Authorization: Bearer <token>`) with precedence over `token_from_cookie`. Explicit `Authorization` headers are validated directly against `token::verify_token` without ambient cookie fallback, rejecting invalid tokens with `401 Unauthorized`.

---

## 3. Development Workflow & Commands

- **Compile TypeScript**: `npx tsc`
- **Check Rust Code**: `cargo check`
- **Build Rust Binary**: `cargo build`
- **Run Server**: `cargo run` (listens on `http://0.0.0.0:3000`)
- **Create User CLI**: `cargo run --bin new_users -- <username> <password>`
- **Zed Task**: Run task configured as `(kill -9 $(lsof -t -i:3000) 2>/dev/null || true); npx tsc && cargo run`
- **Docker Compose (Build & Run)**: `docker compose up --build -d`
- **Docker Compose (Stop)**: `docker compose down`
- **Docker Create User CLI**: `docker compose exec app /app/new_users <username> <password>`
- **Load Extension in Chrome**: Open `chrome://extensions` -> enable Developer mode -> click "Load unpacked" -> select `extension/` directory.

---

## 4. Running in Termux (Android)

- **Source of Termux**: Install Termux from F-Droid or GitHub releases (never Google Play Store, as Play Store builds are deprecated and fail package updates).
- **Embedded Frontend**: `public/js/` is tracked in git and pre-compiled. Node.js is NOT required on Android devices when running or building the server.
- **Dependencies in Termux**: `pkg update && pkg install -y git rust clang binutils`.
- **Preventing OOM on Budget Devices**: Budget Android phones (1GB - 3GB RAM) trigger Android Low Memory Killer (LMK `SIGKILL`) if multiple rustc threads spawn. Must build with constrained threads: `CARGO_BUILD_JOBS=1 cargo build --release` (or `-j 1`).
- **Android Wake-Lock**: Run `termux-wake-lock` and disable battery optimization for Termux in Android Settings to prevent the operating system from suspending CPU or network during compilation or server hosting.
- **Port and Access**: Axum listens on `0.0.0.0:3000`. Accessible locally via `http://localhost:3000` or across LAN via `http://<device-ip>:3000`.

