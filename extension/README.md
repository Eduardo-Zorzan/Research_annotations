# Research Annotations — Chrome Extension

A Manifest V3 Chrome Extension to quickly save webpage titles, URLs, and annotations directly into your Research Annotations tables.

## Features

- **Token-Based Authentication**: Seamlessly authenticates with your self-hosted or local instance using an encrypted user token.
- **Theme Switching**: Dark and Light mode toggle with state persistence.
- **Automatic Metadata Capture**: Automatically captures the active tab's title for the annotation name and URL for the link column.
- **Live Duplicate Detection**: Dynamically notifies you if an annotation with the same name already exists in the selected table (while still allowing you to add it if desired).
- **Dynamic Tables List**: Loads all tables registered in your account into a select dropdown, showing an empty placeholder when no tables exist.

## How to Install in Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `extension` folder located inside this project directory:
   `/Users/eduardobottonzorzan/Documents/projetos/Research_annotations/extension`
5. The **Research Annotations** extension will now appear in your extensions list and toolbar.

## First-Time Setup

1. Start your backend server (e.g., `cargo run` on `http://localhost:3000`).
2. Log in to the Research Annotations web application.
3. Open the application Settings (gear icon in the top right) and navigate to the **Tokens** section.
4. Click **Create new token** and copy the generated token.
5. Click the Research Annotations extension icon in Chrome.
6. Click the gear icon (`⚙`) in the extension popup header to open the Settings modal.
7. Enter your **App Url** (e.g., `http://localhost:3000`) and paste your **Token**.
8. Click **Load**. The extension will test the connection, load your tables, and close the settings modal.

## How to Use

1. Navigate to any webpage you want to annotate.
2. Click the Research Annotations extension icon.
3. Select your target table from the **Tables** dropdown.
4. The **Name Annotation** field will be pre-filled with the page title. Edit it if desired.
5. If the name already exists in the selected table, a warning badge **Already registered** will appear.
6. Click **Add** to insert the new row. The page URL is automatically stored in the `link` column.
