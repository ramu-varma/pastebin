# 🚀 Pastebin-Lite
A minimal Pastebin-like application that allows users to create text pastes and share a link to view them.  
Pastes can automatically expire based on **time (TTL)** or **view count**.
This project was built as a take-home assignment with a focus on **backend correctness, persistence, and clean API design**, rather than UI styling.
---
## ✨ Features
- Create a text paste
- Receive a shareable URL
- View paste via browser (HTML)
- Fetch paste via API (JSON)
- Optional constraints:
  - Time-based expiry (TTL)
  - View-count limit
- Deterministic expiry testing support
- Persistent storage (serverless-safe)
---
## 🛠 Tech Stack

- **Node.js**
- **Express.js**
- **Redis (Upstash)** for persistence
- Plain HTML for minimal UI
---
## 📡 API Endpoints
### Health Check
GET /api/healthz
Response:
json
{ "ok": true }
---
Create Paste
POST /api/pastes
Request body:

{
  "content": "Hello world",
  "ttl_seconds": 60,
  "max_views": 5
}

Response:
{
  "id": "abc123",
  "url": "http://localhost:5000/p/abc123"
}

Invalid input returns 4xx with a JSON error.
Fetch Paste (API – counts views)
GET /api/pastes/:id

Response:
{
  "content": "Hello world",
  "remaining_views": 4,
  "expires_at": "2026-01-01T00:00:00.000Z"
}

Unavailable pastes return HTTP 404.

View Paste (HTML)

GET /p/:id
Returns HTML
Content is rendered safely
Returns 404 if unavailable

🌐 Minimal UI

GET / — Simple HTML form to create a paste

GET /p/:id — View paste via shared link

The UI is intentionally minimal. The focus is on backend behavior and correctness.

💾 Persistence Layer
----
This application uses Redis (Upstash) as its persistence layer.
Why Redis?
Data survives across serverless requests
Supports atomic updates for view counting
No schema or migrations required
Well-suited for TTL and counter-based systems
▶️ Run Locally
1. Install dependencies
npm install
2. Create .env
REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379
(Optional for testing)
TEST_MODE=1
3. Start the server
npm start
Server runs at:
http://localhost:5000