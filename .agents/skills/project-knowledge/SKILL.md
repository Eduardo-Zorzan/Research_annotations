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
   - **Never Revert User Removals**: Never re-create elements, buttons, or layouts that the user has removed.

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
- `tokens (id INTEGER PRIMARY KEY, token TEXT, user_id INTEGER, expiration_date TEXT)`
- `tables (id INTEGER PRIMARY KEY, description TEXT, user_id INTEGER, position INTEGER DEFAULT 0)`
- `table_details (id INTEGER PRIMARY KEY, table_id INTEGER, annotation TEXT, name TEXT, link TEXT, creation_date TEXT, position INTEGER DEFAULT 0)`

#### Cryptography & Authentication:
- `CryptoService` uses AES-256-GCM (`aes-gcm` crate) with 12-byte random nonce and Base64 output.
- `Keys::Login` (`LOGIN_KEY` in `.env`): Used for encrypting and decrypting user passwords in the `users` table.
- `auth_middleware` (`src/handlers/auth.rs`): Applied to protected routes (`/home`, `/tables`, `/table_details`) via `axum::middleware::from_fn`. Extracts session token from `Cookie` header (with `Authorization` header fallback) and validates expiration/signature. For unauthorized page navigations (`/home`), returns `Redirect::to("/")`; for unauthorized API requests, returns `401 Unauthorized`. Injects `AuthUser { user_id }` into request extensions for handlers.

#### REST API Endpoints:
- `GET /`: Serves login page (`login.html`).
- `POST /login`: Authenticates username & password, decrypts password via `Keys::Login`, returns `{ "token": "..." }` encrypted with `Keys::Token`.
- `GET /home`: Serves home dashboard (`home.html`) through `auth_middleware` (redirects unauthenticated sessions to `/`).
- `GET /tables`: Fetches tables for the authenticated user (`Extension<AuthUser>`) ordered by `position ASC, id ASC`.
- `POST /tables`, `PUT /tables`, `DELETE /tables`: Manage table cards for authenticated user.
- `PUT /tables/reorder`: Reorders table cards in an SQLite transaction.
- `GET /:table_id/table_details`: Fetches details rows ordered by `position ASC, id ASC`.
- `POST /table_details`, `PUT /table_details`, `DELETE /table_details`: Manage detail rows.
- `PUT /table_details/reorder`: Reorders detail rows in an SQLite transaction.

---

### Frontend (TypeScript / Vanilla CSS)
- **Source**: `frontend/src/`
- **Output**: `public/js/` (compiled with `npx tsc`)
- **Modules**:
  - `login.ts`: Login form validation, async sign-in request, user session storage, error messaging.
  - `cookies.ts`: Reusable cookie management utility (`setCookie`, `getCookie`, `deleteCookie`).
  - `home.ts`: Layout initialization, sidebar toggle, resize handle, and table loading.
  - `sidebar.ts`: Table card creation, inline renaming, deletion, drag-and-drop table reordering.
  - `tableDetails.ts`: Fixed columns (`Details`, `Name`, `Link`), row drag-and-drop reordering, inline cell editing, 3-dots row options.
  - `annotationModal.ts`: Resizable & maximizable rich text modal for notes using Editor.js.
  - `blockEditor.ts`: Slash command / block editor module.

---

## 3. Development Workflow & Commands

- **Compile TypeScript**: `npx tsc`
- **Check Rust Code**: `cargo check`
- **Build Rust Binary**: `cargo build`
- **Run Server**: `cargo run` (listens on `http://0.0.0.0:3000`)
- **Create User CLI**: `cargo run --bin new_users -- <username> <password>`
- **Zed Task**: Run task configured as `(kill -9 $(lsof -t -i:3000) 2>/dev/null || true); npx tsc && cargo run`
