# Trae + Cursor on this repo

Project: **sync2dine-frontend**

Cursor and Trae share this Git working tree and existing env files.

## Open in Trae

```powershell
cd "c:\Users\dolab\Downloads\sync2dine-frontend"
trae .
```

## Layout

- Rules: `.trae/rules/shared.md`
- Product env: existing project env files only (no Trae-only secrets)
- MCP: `.trae/mcp.json` (Supabase URL; authenticate in Trae Settings → MCP)

## Shared Git

Save before editing the same file in the other IDE. Use one `git status` / `git diff`.
