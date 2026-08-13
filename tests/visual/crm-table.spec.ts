import { test, expect } from '@playwright/test';

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);
}

/** Loads app Tailwind, then mounts the CRM table markup (no auth / Supabase). */
async function mountCrmTable(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const rows = Array.from({ length: 8 }, (_, i) => `
      <tr class="hover:bg-muted/50 border-b cursor-pointer">
        <td class="p-2 align-middle max-w-[10rem] sm:max-w-[14rem] overflow-hidden">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-2 h-2 shrink-0 rounded-full bg-gray-400"></span>
            <span class="font-medium truncate">The Golden Chippy ${i + 1}</span>
          </div>
        </td>
        <td class="p-2 align-middle whitespace-nowrap">+44 1983 717300</td>
        <td class="p-2 align-middle hidden md:table-cell max-w-[18rem] overflow-hidden">
          <span class="block truncate">18 High St, Newport, Isle of Wight PO30 1SS</span>
        </td>
        <td class="p-2 align-middle">
          <span class="inline-flex rounded-md bg-slate-100 px-1.5 py-0 text-[10px]">lead</span>
        </td>
        <td class="p-2 align-middle hidden lg:table-cell text-xs text-slate-600">ù</td>
        <td class="p-2 align-middle hidden lg:table-cell whitespace-nowrap text-xs text-slate-600">13/08/2026</td>
      </tr>
    `).join('');

    document.body.innerHTML = `
      <div class="bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-6 min-w-0">
        <div class="max-w-7xl mx-auto min-w-0">
          <div data-testid="crm-leads-table" class="rounded-2xl border-0 overflow-hidden min-w-0 bg-white shadow-lg">
            <div class="relative w-full overflow-x-auto">
              <table class="w-full caption-bottom text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="h-10 px-2 text-left font-medium whitespace-nowrap">Name</th>
                    <th class="h-10 px-2 text-left font-medium whitespace-nowrap">Phone</th>
                    <th class="h-10 px-2 text-left font-medium whitespace-nowrap hidden md:table-cell min-w-[12rem]">Address</th>
                    <th class="h-10 px-2 text-left font-medium whitespace-nowrap">Status</th>
                    <th class="h-10 px-2 text-left font-medium whitespace-nowrap hidden lg:table-cell">Last call</th>
                    <th class="h-10 px-2 text-left font-medium whitespace-nowrap hidden lg:table-cell">Added</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 border-t bg-slate-50 text-sm text-slate-600">
              <p>Showing 1ù8 of 8</p>
              <div class="flex items-center gap-2">
                <button type="button" class="min-h-9 px-3 border rounded-md">Previous</button>
                <span class="text-xs">1 / 1</span>
                <button type="button" class="min-h-9 px-3 border rounded-md">Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  });
}

test.describe('CRM dense table ù responsive', () => {
  test('no page-level horizontal overflow', async ({ page }, testInfo) => {
    await mountCrmTable(page);
    await expect(page.getByTestId('crm-leads-table')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: `test-results/crm-table-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test('columns match breakpoint', async ({ page, viewport }) => {
    await mountCrmTable(page);
    const table = page.locator('[data-testid="crm-leads-table"] table');
    await expect(table.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Phone' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Status' })).toBeVisible();

    const width = viewport?.width ?? 1280;
    if (width < 768) {
      await expect(table.getByRole('columnheader', { name: 'Address' })).toBeHidden();
      await expect(table.getByRole('columnheader', { name: 'Last call' })).toBeHidden();
      await expect(table.getByRole('columnheader', { name: 'Added' })).toBeHidden();
    } else if (width < 1024) {
      await expect(table.getByRole('columnheader', { name: 'Address' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Last call' })).toBeHidden();
      await expect(table.getByRole('columnheader', { name: 'Added' })).toBeHidden();
    } else {
      await expect(table.getByRole('columnheader', { name: 'Address' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Last call' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Added' })).toBeVisible();
    }
    await assertNoHorizontalOverflow(page);
  });
});
