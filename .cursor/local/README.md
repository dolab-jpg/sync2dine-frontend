# Local deploy secrets (this folder is gitignored)

## Preferred: browser paste popup (no terminal)

1. Agent runs `npm run dev` (app on **http://localhost:5174**)
2. Open **http://localhost:5174/cursor-paste** in your browser (popup or tab)
3. Paste **Supabase Access Token** + **Project Reference ID** → **Save for Cursor**
4. Tell the agent: **credentials saved**

The app writes `.cursor/local/deploy.env` on your PC. The agent reads that file — do not paste tokens in chat.

Get token: Supabase Dashboard → Account → Access Tokens  
Project ref: optional — click **Connect account & load projects** on the paste page, or create a new project there.

## Alternative: Supabase OAuth in Cursor

1. Open **Cursor Settings** → **Tools & MCP**
2. Click **Connect** on the **supabase** server
3. Log in in the browser and authorize Cursor
4. When the dot turns green, tell the agent to push migrations via MCP

Project config: `.cursor/mcp.json` in the repo root.

## Manual CLI token file

Only if the popup is unavailable:

1. Copy `deploy.env.example` → `deploy.env`
2. Add Supabase access token + project ref from the dashboard

GitHub is already in Windows Credential Manager — nothing to add for git.
