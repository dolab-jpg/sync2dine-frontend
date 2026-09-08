---
name: sync2dine-runtime-tool
description: Add or change an LLM/Vapi/orchestrator runtime tool end-to-end.
---

# Sync2Dine runtime tool

## When

Adding, renaming, or gating a callable AI tool (phone, Sally web, Cynthia orch).

## Procedure

1. Read `../sync2dine-backend/docs/TOOL_REGISTRY.md` + ADR 005
2. Add schema in the correct catalog (phone catalog / phone-brain / sally-sales-phone / sally/tools / tool-catalog-* / gap)
3. Wire executor (phone execute, vapi-routes branch, orch handler, or FE toolRuntime)
4. Wire selector / mode / PIN gate � **not prompt-only** for money/auth/destructive
5. Add/adjust tests
6. Update TOOL_REGISTRY + CHANGE_IMPACT; run `extract:registries` and refresh baseline if fingerprints change
7. `npm run check:agent-maps`

## Do not

- Add allowlist entries without schemas
- Put Vapi-only tools only in `sally/tools.ts` full pack and claim phone
- Paste full JSON schemas into markdown registries

## Evidence before done

- Schema file + executor path cited
- Persona/channel listed
- Enforcement location stated (not �prompt only� for sensitive tools)
