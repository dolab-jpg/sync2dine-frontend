# Test Data Summary - Bathroom Pro Application

## What Was Added

Extensive realistic test data has been added to properly test all features of the Bathroom Pro application.

## Quick Stats

- **8 Builders** with different specialties and calendar colors
- **15 Customers** with realistic UK addresses and postcodes
- **6 Sales Staff** members
- **3 Managers**
- **2 Recruitment Staff**
- **20 Projects** with full details:
  - 5 Completed projects (full payment history, messages, photos)
  - 7 In Progress projects (active work, partial payments, ongoing messaging)
  - 5 Upcoming projects (scheduled, deposits paid)
  - 3 On Hold projects (with hold reasons in messages)

## Files Modified

1. **`/src/app/data/testData.ts`** - NEW FILE
   - Contains all test data exports
   - 20 fully detailed projects
   - 8 builders with specialties
   - 15 customers
   - 11 staff members

2. **`/src/app/components/BuilderProjectManagement.tsx`**
   - Now imports `testBuilders` and `testProjects`
   - Removed ~800 lines of hardcoded data
   - Cleaner, more maintainable code

3. **`/src/app/components/BuilderManagement.tsx`**
   - Now imports `testBuilders`
   - Uses centralized builder data

4. **`/src/app/components/TeamManagement.tsx`**
   - Now imports `testSalesStaff` and `testManagers`
   - Uses centralized staff data

5. **`/src/app/App.tsx`**
   - Now imports `testCustomers`
   - Uses centralized customer data

## Key Features of Test Data

### Each Project Includes:
- Customer details (name, email, address with UK postcode)
- Full UK address with proper postcode
- Start and finish dates (April-June 2026)
- Status (completed/in_progress/upcoming/on_hold)
- **5-10 design items** with categories (tile/fixture/finish/accessory)
- **5-10 realistic messages** showing communication history
- **Builder payment details** (price work or day rate)
- **Customer payment stages** (booking, start, mid, final)
- **Invoices** matching payment amounts
- **Progress photos** (0-10 per project depending on status)
- Assigned builder

### Realistic Details:
- UK phone numbers (07xxx format)
- UK addresses with proper postcodes
- British supplier names
- Realistic pricing in GBP (£3,900 - £17,200)
- Proper payment stage percentages (sum to 100%)
- Chronological message timestamps
- Email sent flags on messages
- Varied bathroom types (ensuite, main, wetroom, small)
- Different finishes (microcement, marble, tiles)

### Builder Variety:
- Mike Wilson (Blue) - Microcement specialist
- Tom Richards (Green) - Plumbing expert
- Dave Collins (Amber) - Carpentry specialist
- Steve Parker (Purple) - Luxury bathrooms
- Chris Morgan (Pink) - Electrical & plumbing
- Gary Thompson (Orange) - Waterproofing expert
- Mark Stevens (Cyan) - Modern finishes
- Paul Henderson (Lime) - Traditional bathrooms

### Projects Are Spread Across:
- Different builders (good calendar variety)
- Different dates (April-June 2026)
- Different price points (£3,900 - £17,200)
- Different statuses (completed/active/upcoming/hold)
- Different bathroom types and styles

## Testing Now Possible

With this data, you can now properly test:

✅ Calendar view with multiple overlapping projects  
✅ Builder color coding and assignment  
✅ Project filtering by status  
✅ Customer payment tracking  
✅ Builder payment tracking (price work vs day rate)  
✅ Message system (customer/builder/office)  
✅ Email notifications  
✅ Invoice management  
✅ Progress photo tracking  
✅ Design item management  
✅ Builder reassignment  
✅ Multiple projects per customer  
✅ Project hold/resume  
✅ Payment reminders  
✅ Role-based views (customer/builder/staff/admin)  
✅ Builder management features  
✅ Team management features  
✅ Customer management features  

## How to Use

The test data is automatically loaded when the application starts. If you've already used the application, clear your browser's localStorage to see the new test data:

1. Open browser DevTools (F12)
2. Go to Application/Storage tab
3. Clear localStorage
4. Refresh the page

The test data will now be loaded from `/src/app/data/testData.ts`.

## Documentation

See `TEST_DATA_README.md` for complete details about all test data, including:
- Full list of all 20 projects
- Complete builder profiles
- All customer details
- Staff member information
- Payment structures
- Message examples
