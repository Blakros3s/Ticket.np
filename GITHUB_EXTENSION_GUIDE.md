# Guide: Building a TicketHub GitHub Extension

Yes, you can absolutely build a GitHub extension! This guide outlines the architecture and steps to create a browser extension that allows you to log in and create tickets directly from GitHub.

---

## 🏗️ Architecture Overview

The extension will act as a "sidekick" to your TicketHub web app. It will interact with your existing Django API.

1.  **UI Injection**: A Content Script adds a "TicketHub" button to GitHub Issue/PR sidebars.
2.  **Authentication**: Uses the existing `/api/auth/login/` to get a JWT.
3.  **Data Flow**:
    *   Fetch projects via `GET /api/projects/`.
    *   Submit tickets via `POST /api/tickets/`.

---

## 🛠️ Step-by-Step Implementation

### 1. Preparation (Backend Changes)
You need to allow the extension to talk to your backend.
- **CORS**: Update `settings.py` or your `.env` to include your extension's ID.
  ```python
  CORS_ALLOWED_ORIGINS = [
      "http://localhost:3000",
      "chrome-extension://[YOUR_EXTENSION_ID]"
  ]
  ```

### 2. Extension Boilerplate Structure
Create a new directory (e.g., `tickethub-extension/`) with the following files:

#### `manifest.json` (The Brain)
```json
{
  "manifest_version": 3,
  "name": "TicketHub GitHub Link",
  "version": "1.0",
  "permissions": ["storage"],
  "host_permissions": ["http://localhost:8000/*", "https://github.com/*"],
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": ["https://github.com/*/*/issues/*", "https://github.com/*/*/pull/*"],
      "js": ["content.js"]
    }
  ]
}
```

#### `popup.html` & `popup.js` (Login & Selection)
This is the UI that appears when you click the extension icon.
- **Login Form**: Ask for username/password, hit `/api/auth/login/`, and save the JWT in `chrome.storage.local`.
- **Project Selection**: Once logged in, fetch projects and show them in a dropdown.

#### `content.js` (GitHub Integration)
This script runs directly on GitHub pages.
- **Button Injection**: Locate the "sidebar" div on a GitHub issue and append a "Create TicketHub Ticket" button.
- **Action**: When clicked, it can scrape the Issue Title and Description and send it to your API using the saved JWT.

---

## 💡 Pro Tips for a Premium Experience

1.  **Auto-Populate**: Automatically grab the Hub Issue title and URL to put into the TicketHub description.
2.  **Status Sync**: (Advanced) Use GitHub Webhooks to update the TicketHub ticket status when the GitHub issue is closed.
3.  **Link Back**: In the TicketHub ticket, add a link back to the GitHub Issue for easy navigation.

## 🚀 Getting Started
1. Create the files above.
2. Go to `chrome://extensions`.
3. Enable **Developer Mode**.
4. Click **Load unpacked** and select your folder.
