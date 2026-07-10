# Test Data Directory

This directory contains centralized test data for the Bathroom Pro application.

## Files

### `testData.ts`

Comprehensive realistic test data for development and testing purposes.

#### Exports

- `testBuilders` - 8 builders with specialties, contact info, and calendar colors
- `testCustomers` - 15 customers with UK addresses and postcodes
- `testSalesStaff` - 6 sales staff members
- `testManagers` - 3 managers
- `testRecruitmentStaff` - 2 recruitment staff
- `testProjects` - 20 fully detailed projects (5 completed, 7 in progress, 5 upcoming, 3 on hold)

#### Usage

Import the test data in your components:

```typescript
import { testBuilders, testProjects, testCustomers } from '../data/testData';
```

#### Project Data

Each project includes:
- Customer and builder information
- 3-8 design items (tiles, fixtures, finishes, accessories)
- 5-10 realistic messages with timestamps
- Builder payment details (price work or day rate)
- Customer payment stages (booking, start, mid, final)
- Invoices
- Progress photos (0-10 depending on status)
- UK addresses with proper postcodes
- Realistic pricing (£3,900 - £17,200)

#### Dates

All dates are set in 2026 (April-June) to ensure test data doesn't become stale.

## Used By

- `/src/app/App.tsx` - Customers
- `/src/app/components/BuilderProjectManagement.tsx` - Projects and Builders
- `/src/app/components/BuilderManagement.tsx` - Builders
- `/src/app/components/TeamManagement.tsx` - Staff and Managers

## Modifying Test Data

When adding or modifying test data:

1. Keep data realistic and representative of actual use
2. Maintain UK-specific details (postcodes, phone formats)
3. Ensure dates are in the future (2026+)
4. Keep payment stages totaling 100%
5. Match invoice amounts to payment totals
6. Use chronological message timestamps
7. Assign projects to different builders for calendar variety

## Resetting Data

Users' browsers cache the data in localStorage. To see updated test data:

1. Clear browser localStorage
2. Refresh the application

The data from this file will reload.
