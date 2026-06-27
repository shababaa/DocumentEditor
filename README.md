# DocuEdit

DocuEdit is a collaborative Markdown editor with a VS Code extension that can turn the current source file (or selected code) into an editable document. Documents are stored in MySQL, autosaved from the React editor, and synchronized between open browser tabs with Yjs CRDT updates over WebSockets.

## Project structure

- `client/` — React + Vite web app with `/documents` and `/doc/:id` routes.
- `server/` — Express API, MySQL repository, document-generation service, and WebSocket server.
- `extension/` — TypeScript VS Code extension that sends the current file or selection to the backend.

## Prerequisites

- Node.js 20 or newer
- npm
- MySQL 8 or a compatible MySQL server
- VS Code (for extension development)

## Database setup

Create a database and the existing documents table if they are not already present:

```sql
CREATE DATABASE document_editor;
USE document_editor;

CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE documents (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  owner_user_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE document_members (
  document_id VARCHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('owner', 'editor', 'viewer') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id, user_id)
);

CREATE TABLE sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_yjs_states (
  document_id VARCHAR(36) NOT NULL PRIMARY KEY,
  state LONGBLOB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

The backend creates the auth and collaboration tables automatically when possible. Existing installations can instead run `server/migrations/001_add_document_yjs_states.sql` and `server/migrations/002_add_auth_permissions.sql` with a database account that can alter the schema.

On an upgraded installation, the first account created becomes the owner of existing documents whose `owner_user_id` is still null. Later users only see documents they create or documents explicitly shared with them.

## Environment setup

Copy the example files and update the MySQL values for your machine:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

The backend uses its deterministic local Markdown generator when `OPENAI_API_KEY` is blank. To use AI generation, set `OPENAI_API_KEY` only in `server/.env`; you can also change `OPENAI_MODEL` and `OPENAI_BASE_URL` there. The extension never receives or stores an API key.

Authentication uses opaque server-side sessions. Passwords are bcrypt-hashed, only a SHA-256 digest of each random session token is stored in MySQL, and the browser receives an HTTP-only `SameSite=Lax` cookie. Set `COOKIE_SECURE=true` behind HTTPS in production; it defaults to false in the local HTTP example.

## Authentication and permissions

The available auth endpoints are:

- `POST /auth/signup` with `{ "email": "...", "password": "..." }`
- `POST /auth/login` with `{ "email": "...", "password": "..." }`
- `POST /auth/logout`
- `GET /auth/me`

All `/documents` routes require authentication. Document roles are:

- `owner` — read, edit, and add members
- `editor` — read and edit
- `viewer` — read-only

Owners can add an existing registered user from the sharing form above the editor, or with `POST /documents/:id/members` and `{ "email": "member@example.com", "role": "editor" }`.

## Install dependencies

```bash
npm install
npm --prefix server install
npm --prefix client install
npm --prefix extension install
```

## Run the backend and frontend

From the repository root, start both applications:

```bash
npm run dev
```

Or start them separately:

```bash
npm --prefix server run dev
npm --prefix client run dev
```

The defaults are:

- Backend API: `http://localhost:5001`
- Web app: `http://localhost:5173`
- WebSocket endpoint: `ws://localhost:5001/ws`

## Run the VS Code extension

1. Install extension dependencies with `npm --prefix extension install`.
2. Open this repository root in VS Code.
3. Press `F5` and choose **Run DocuEdit Extension** if prompted.
4. In the Extension Development Host, open a source file.
5. Optionally select only the code you want documented.
6. Open the Command Palette and run **DocuEdit: Generate Documentation from Current File**.

The command sends the filename, VS Code language id, and selected code (or the complete active file) to `POST /documents/generate-from-code`. That endpoint now requires authentication and creates the generated document for the authenticated owner.

TODO: add a device-code or personal-access-token flow for the VS Code extension. Browser session cookies are intentionally not copied into the extension process, and no unauthenticated local-development bypass is provided. Until that flow exists, direct extension generation receives a clear authentication error; the backend generation endpoint can still be tested with an authenticated HTTP cookie.

## Extension settings

These settings can be changed in VS Code Settings:

- `docuedit.backendApiBaseUrl` — defaults to `http://localhost:5001`
- `docuedit.webAppBaseUrl` — defaults to `http://localhost:5173`

## Manual end-to-end test

1. Start MySQL, run the migrations if the application DB user cannot alter tables, and leave `OPENAI_API_KEY` blank for free local generation.
2. Run `npm run dev` and open `http://localhost:5173/signup`.
3. Sign up as `owner@example.com`, create a document, and confirm it opens and saves.
4. Copy its `/doc/<id>` URL, log out, and sign up as `member@example.com`.
5. Paste the copied URL and confirm the second user cannot fetch or join the document.
6. Log back in as the owner, open the document, and add `member@example.com` as an editor using the sharing form.
7. Log in as the member and confirm the document now appears on `/documents` and can be edited.
8. Open the same document as the owner in another browser profile. Type simultaneously in both editors and confirm both Yjs edits remain.
9. Add another registered user as a viewer and confirm CodeMirror is read-only for that user.
10. Wait for `saved`, refresh both editors, and restart the backend to confirm text and CRDT state persist.
11. In browser developer tools, try opening `/ws?docId=<id>` while logged out or as a non-member and confirm the connection is rejected.

## API example

```bash
curl -c owner.cookies -X POST http://localhost:5001/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"correct-horse-battery-staple"}'

curl -X POST http://localhost:5001/documents/generate-from-code \
  -b owner.cookies \
  -H 'Content-Type: application/json' \
  -d '{"filename":"hello.js","language":"javascript","code":"export function hello(name) { return `Hello ${name}`; }"}'
```

A successful response has this shape:

```json
{
  "ok": true,
  "doc": {
    "id": "...",
    "title": "Documentation: hello.js",
    "content": "# hello.js\n...",
    "created_at": "...",
    "updated_at": "..."
  }
}
```
