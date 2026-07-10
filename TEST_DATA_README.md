# Bathroom Pro - Test Data Documentation

This document describes the comprehensive test data added to the Bathroom Pro application for proper feature testing.

## Overview

Extensive realistic test data has been added to properly test all features of the Bathroom Pro application. The data is located in `/src/app/data/testData.ts` and is automatically imported into the relevant components.

## Test Data Summary

### Builders (8 total)
All builders have UK names, realistic contact details, specialties, and calendar colors:

1. **Mike Wilson** - Microcement, Tiling, Waterproofing (Blue)
2. **Tom Richards** - Plumbing, Bathroom Fitting, Tiling (Green)
3. **Dave Collins** - Carpentry, Tiling, General Building (Amber)
4. **Steve Parker** - Microcement, Luxury Bathrooms, Wetrooms (Purple)
5. **Chris Morgan** - Tiling, Plumbing, Electrical (Pink)
6. **Gary Thompson** - Waterproofing, Tiling, General Building (Orange)
7. **Mark Stevens** - Microcement, Polished Concrete, Modern Finishes (Cyan)
8. **Paul Henderson** - Traditional Bathrooms, Tiling, Plumbing (Lime)

Each builder has:
- Unique ID (B001-B008)
- Email and phone number
- Specialties array
- Default payment type (price_work or day_rate)
- Day rate amount
- Active status
- Join date
- Unique calendar color

### Customers (15 total)
Realistic UK customers with proper addresses and postcodes:

1. Emma Clarke - Birmingham, B4 7SL
2. Daniel White - Sheffield, S10 3GE
3. Sarah Johnson - London, SW15 2TQ
4. James Wilson - Manchester, M1 4BT
5. Sophie Anderson - Edinburgh, EH1 2ND
6. Michael Brown - Newcastle upon Tyne, NE1 3DX
7. Robert Davis - Liverpool, L1 1RG
8. Lisa Taylor - Sheffield, S1 2GH
9. Olivia Martin - Cardiff, CF10 3BH
10. Amanda Peterson - Bristol, BS8 2PL
11. Thomas Mitchell - Brighton, BN1 2PF
12. Rachel Hughes - Cambridge, CB1 1DG
13. Christopher Lee - Nottingham, NG1 6HX
14. Jennifer Moore - Oxford, OX2 6JQ
15. Peter Walker - Leicester, LE1 3WS

Each customer has:
- Unique ID (C001-C015)
- Full UK address with postcode
- Email and phone (07xxx format)
- Status (lead/quoted/won/lost)
- Created date
- Realistic notes

### Staff Members

#### Sales Staff (6 total)
1. Emily Roberts
2. Jack Thompson
3. Hannah Wilson
4. Oliver Davies
5. Charlotte Evans
6. George Harris

#### Managers (3 total)
1. John Smith - Sales Manager
2. Victoria Palmer - Operations Manager
3. Andrew Clarke - Projects Manager

#### Recruitment Staff (2 total)
1. Rebecca Martinez
2. David Anderson

All staff have:
- Unique IDs (S001-S006, M001-M003, R001-R002)
- Email (@bathroompo.com)
- Phone numbers
- Department
- Join dates
- Active status

### Projects (20 total)

#### Completed Projects (5)
- **P001** - Sarah Johnson (Sarah Johnson, London) - Metro tiles, chrome fixtures - £5,600
- **P002** - Thomas Mitchell (Brighton) - Victorian bathroom, sage microcement, clawfoot bath - £12,900
- **P003** - Rachel Hughes (Cambridge) - Wetroom with polished concrete, underfloor heating - £16,200
- **P004** - Peter Walker (Leicester) - Small bathroom, blue patterned tiles - £4,400
- **P005** - Daniel White (Sheffield) - Luxury bathroom, grey marble, freestanding bath - £15,800

All completed projects include:
- Full payment history (all stages paid)
- 6-10 messages showing project journey
- Multiple progress photos
- Complete invoices (paid status)
- Builder payments (marked as paid)

#### In Progress Projects (7)
- **P006** - Emma Clarke (Birmingham) - White microcement - £7,225
- **P007** - James Wilson (Manchester) - Black hexagon tiles, matte black - £9,850
- **P008** - Sophie Anderson (Edinburgh) - Grey microcement, walk-in shower - £12,400
- **P009** - Lisa Taylor (Sheffield) - Metro tiles - £6,420
- **P010** - Amanda Peterson (Bristol) - Pearl microcement, gold fixtures - £10,850
- **P011** - Christopher Lee (Nottingham) - Charcoal microcement, large shower - £17,200
- **P012** - Jennifer Moore (Oxford) - Beige stone tiles, ensuite conversion - £8,500

In progress projects include:
- Active messaging history (4-7 messages)
- Some payments received, some due
- Builder payments in "approved" status
- 2-3 progress photos
- Current work status

#### Upcoming Projects (5)
- **P013** - Michael Brown (Newcastle) - Wood effect tiles, traditional suite - £8,650
- **P014** - Robert Davis (Liverpool) - Beige microcement, freestanding bath - £16,800
- **P015** - Olivia Martin (Cardiff) - Industrial concrete effect - £14,200
- **P016** - Emma Clarke (Birmingham) - Second bathroom, large grey tiles - £9,900
- **P017** - James Wilson (Manchester) - White marble, gold fixtures - £12,300

Upcoming projects include:
- Initial deposit paid
- 1-2 messages (confirmation/scheduling)
- Builder assigned
- No progress photos yet
- Future start dates (May-June 2026)

#### On Hold Projects (3)
- **P018** - Sophie Anderson (Edinburgh) - Blue feature tiles - £3,900 (Family emergency)
- **P019** - Robert Davis (Liverpool) - Terracotta tiles - £5,900 (Other building work)
- **P020** - Christopher Lee (Nottingham) - Wetroom screen - £6,000 (Material supplier issues)

On hold projects include:
- Messages explaining the hold reason
- Deposit paid
- No work started
- Builder assigned but not started

## Project Details

Every project includes:

### Design Items (3-8 items per project)
Each design item has:
- Category (tile/fixture/finish/accessory)
- Name and description
- Photo reference
- Supplier name
- Cost (shown to staff only)

### Messages (5-10 per project)
- From customer, builder, office, or admin
- Realistic conversation flow
- Email sent flags
- Timestamps (April-May 2026)
- Shows project progression

### Builder Payments
- Payment type (price_work or day_rate)
- Agreed amount or day rate
- Days worked (for day rate)
- Total earned
- Status (pending/approved/paid)

### Customer Payment Stages
- Multiple payment stages (2-4 per project)
- Booking deposit (10-20%)
- Start payment (35-45%)
- Mid-project payment (25-30%) - for larger projects
- Final payment (20-45%)
- Each with due dates and paid dates
- Status (pending/due/paid)

### Invoices
- Customer invoices with proper amounts
- Issue dates, due dates, paid dates
- Status (draft/sent/paid)

### Photos
- Realistic photo filenames
- Progress photos (demo, waterproofing, tiling, etc.)
- Final completion photos
- 0-10 photos per project depending on status

## Date Distribution

Projects are spread across April, May, and June 2026:
- Completed: March-April 2026
- In Progress: May 2026 (ongoing)
- Upcoming: Late May - June 2026
- On Hold: April-May 2026

## Realistic Features

### UK-Specific Details
- Proper UK addresses with postcodes
- UK phone numbers (07xxx format)
- UK pricing (£ GBP)
- UK supplier names
- British naming conventions

### Project Variety
- Different bathroom types (ensuite, main, wetroom, small bathroom)
- Various finishes (microcement, tiles, marble)
- Different fixture styles (modern, traditional, industrial, luxury)
- Price ranges from £3,900 to £17,200
- Different payment structures

### Communication History
- Realistic customer-builder conversations
- Office notifications
- Payment reminders
- Progress updates
- Problem resolution
- Completion confirmations

### Builder Assignment
- Projects distributed across all 8 builders
- Calendar shows good variety
- Each builder has different workload
- Realistic payment types for each builder

## Usage

The test data is automatically imported and used in:
- `/src/app/components/BuilderProjectManagement.tsx` - Projects and builders
- `/src/app/components/BuilderManagement.tsx` - Builders
- `/src/app/components/TeamManagement.tsx` - Staff and managers
- `/src/app/App.tsx` - Customers

To reset test data:
1. Clear browser localStorage
2. Refresh the application
3. Test data will reload from `/src/app/data/testData.ts`

## Testing Checklist

With this test data, you can now properly test:

- ✅ Calendar view with multiple projects across different builders
- ✅ Builder color coding
- ✅ Project status filtering (completed/in_progress/upcoming/on_hold)
- ✅ Customer payment stages and tracking
- ✅ Builder payment tracking (price work vs day rate)
- ✅ Message system between customer/builder/office
- ✅ Email notifications
- ✅ Invoice generation and tracking
- ✅ Progress photos
- ✅ Design item management
- ✅ Builder assignment and reassignment
- ✅ Multiple projects for same customer
- ✅ Project hold functionality
- ✅ Payment reminders
- ✅ Customer view (limited to their projects)
- ✅ Builder view (limited to their projects)
- ✅ Staff/Admin view (all projects)
- ✅ Builder management
- ✅ Team management
- ✅ Customer management

## Notes

- All dates use 2026 as the reference year
- Projects are intentionally overlapping to test calendar congestion
- Message timestamps are realistic and chronological
- Payment amounts match invoice totals
- Builder earnings calculations are accurate
- Customer payment stages sum to 100%
- All UK postcodes are properly formatted
- Phone numbers follow UK mobile format
