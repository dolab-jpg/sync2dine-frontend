# Responsive QA Audit Report

**Date:** 2026-06-26T18:37:12.772Z
**Base URL:** http://localhost:5174

## Summary

| Metric | Count |
|--------|-------|
| Total route checks | 33 |
| Passed | 33 |
| Issues | 0 |
| Errors | 0 |

## AI Panel Behavior

| Breakpoint | Width | Mode | Expected | Status |
|------------|-------|------|----------|--------|
| mobile | 375px | bottom-sheet | bottom-sheet | Pass |
| tablet | 768px | bottom-sheet | bottom-sheet | Pass |
| desktop | 1440px | docked-inline | docked-inline | Pass |

## Table Spot-Checks (Mobile 375px)

| Route | Status | Notes |
|-------|--------|-------|
| CostingDashboard | Pass | OK |
| AccountsHub | Pass | OK |
| SalesManagement | Pass | OK |

## Route × Breakpoint Matrix

| Route | Mobile (375) | Tablet (768) | Desktop (1440) |
|-------|--------------|--------------|----------------|
| Dashboard | Pass | Pass | Pass |
| CRM | Pass | Pass | Pass |
| Quotes | Pass | Pass | Pass |
| QuoteBuilder | Pass | Pass | Pass |
| PriceJob | Pass | Pass | Pass |
| Contracts | Pass | Pass | Pass |
| Costing | Pass | Pass | Pass |
| Accounts | Pass | Pass | Pass |
| Sales | Pass | Pass | Pass |
| Communications | Pass | Pass | Pass |
| Settings | Pass | Pass | Pass |

## Issues Detail

No issues found.

## Conclusions

The Builder Diddies platform **passes responsive QA** across all tested routes and breakpoints.

**Navigation**
- Mobile (375px): Hamburger menu visible; slide-out sheet navigation works.
- Tablet/Desktop (768px+): Collapsible icon rail sidebar visible and functional.

**Layout**
- No horizontal page overflow detected on any tested route at any breakpoint.
- Grids reflow correctly (e.g. Dashboard stats stack on mobile, expand on desktop).
- Touch targets meet minimum size (`min-h-11`) on interactive controls.

**AI Assistant**
- Mobile & tablet (<1024px): Opens as bottom sheet overlay (~85vh).
- Desktop (>=1024px): Docks inline as right-side panel (~320px wide).

**Tables**
- Costing, Accounts, and Sales pages handle mobile width without unwrapped table overflow.

**Screenshots:** 33 route screenshots saved under `docs/responsive-audit/screenshots/`.

**Re-run audit:** `node scripts/responsive-audit.cjs http://localhost:5174`

**Note:** [ContractSignPage.tsx](src/app/components/Contracts/ContractSignPage.tsx) was not tested — it requires a valid contract token URL.
