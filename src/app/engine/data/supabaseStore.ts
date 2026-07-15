import { getSupabase, isSupabaseConfigured, getOrgId } from '../../../lib/supabase/client';
import type { UnifiedProject } from '../project/types';
import type { CustomerContact } from '../project/types';
import { getHomeOrgId, isOrgUuid, sanitizeOrgId } from '../platform/homeOrg';
import { getActiveOrgId } from '../platform/orgContext';

async function resolveOrg(): Promise<string | null> {
  const active = sanitizeOrgId(getActiveOrgId());
  if (active) return active;
  const orgId = sanitizeOrgId(await getOrgId());
  if (orgId) return orgId;
  const home = getHomeOrgId();
  return isOrgUuid(home) ? home : null;
}

// ── Projects ──

export async function loadProjectsFromSupabase(): Promise<UnifiedProject[]> {
  if (!isSupabaseConfigured()) return [];
  const orgId = await resolveOrg();
  if (!orgId) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('projects')
    .select('id, status, customer_id, quote_id, portal_token, data')
    .eq('org_id', orgId);
  if (error || !data) return [];
  return data.map(row => ({
    id: row.id,
    status: row.status,
    customerId: row.customer_id,
    quoteId: row.quote_id,
    portalToken: row.portal_token,
    ...(row.data as Record<string, unknown>),
  })) as UnifiedProject[];
}

export async function saveProjectToSupabase(project: UnifiedProject): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const orgId = await resolveOrg();
  if (!orgId) return;
  const supabase = getSupabase();
  const { id, status, customerId, quoteId, portalToken, ...rest } = project as UnifiedProject & Record<string, unknown>;
  await supabase.from('projects').upsert({
    id: String(id),
    org_id: orgId,
    status: status ? String(status) : null,
    customer_id: customerId ? String(customerId) : null,
    quote_id: quoteId ? String(quoteId) : null,
    portal_token: portalToken ? String(portalToken) : null,
    data: rest,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id,id' });
}

export async function saveAllProjectsToSupabase(projects: UnifiedProject[]): Promise<void> {
  for (const p of projects) {
    await saveProjectToSupabase(p);
  }
}

export function subscribeProjects(callback: (projects: UnifiedProject[]) => void): () => void {
  if (!isSupabaseConfigured()) return () => {};
  const supabase = getSupabase();
  const channel = supabase
    .channel('projects-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
      void loadProjectsFromSupabase().then(callback);
    })
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

// ── Generic JSONB entity helpers ──

async function loadEntities<T>(table: string): Promise<T[]> {
  if (!isSupabaseConfigured()) return [];
  const orgId = await resolveOrg();
  if (!orgId) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).select('id, data').eq('org_id', orgId);
  if (error || !data) return [];
  return data.map(r => ({ id: r.id, ...(r.data as Record<string, unknown>) })) as T[];
}

async function saveEntities(table: string, items: Array<Record<string, unknown>>): Promise<void> {
  if (!isSupabaseConfigured() || !items.length) return;
  const orgId = await resolveOrg();
  if (!orgId) return;
  const supabase = getSupabase();
  const payload = items.map(item => {
    const { id, ...rest } = item;
    return { id: String(id), org_id: orgId, data: rest, updated_at: new Date().toISOString() };
  });
  await supabase.from(table).upsert(payload, { onConflict: 'org_id,id' });
}

export const loadCustomersFromSupabase = () => loadEntities<Record<string, unknown>>('customers');
export const saveCustomersToSupabase = (items: Record<string, unknown>[]) => saveEntities('customers', items);
export const loadQuotesFromSupabase = () => loadEntities<Record<string, unknown>>('quotes');
export const saveQuotesToSupabase = (items: Record<string, unknown>[]) => saveEntities('quotes', items);
export const loadContactsFromSupabase = () => loadEntities<CustomerContact>('contacts');
export const saveContactsToSupabase = (items: CustomerContact[]) => saveEntities('contacts', items as unknown as Record<string, unknown>[]);
export const loadBuildersFromSupabase = () => loadEntities<Record<string, unknown>>('builders');
export const saveBuildersToSupabase = (items: Record<string, unknown>[]) => saveEntities('builders', items);
export const loadProductsFromSupabase = () => loadEntities<Record<string, unknown>>('products');
export const saveProductsToSupabase = (items: Record<string, unknown>[]) => saveEntities('products', items);
export const loadPricingRulesFromSupabase = () => loadEntities<Record<string, unknown>>('pricing_rules');
export const savePricingRulesToSupabase = (items: Record<string, unknown>[]) => saveEntities('pricing_rules', items);

export const loadClientReceiptsFromSupabase = () => loadEntities<Record<string, unknown>>('client_receipts');
export const saveClientReceiptsToSupabase = (items: Record<string, unknown>[]) => saveEntities('client_receipts', items);

export const loadBankAccountsFromSupabase = () => loadEntities<Record<string, unknown>>('bank_accounts');
export const saveBankAccountsToSupabase = (items: Record<string, unknown>[]) => saveEntities('bank_accounts', items);

export const loadBankTransactionsFromSupabase = () => loadEntities<Record<string, unknown>>('bank_transactions');
export const saveBankTransactionsToSupabase = (items: Record<string, unknown>[]) => saveEntities('bank_transactions', items);

async function deleteEntity(table: string, id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const orgId = await resolveOrg();
  if (!orgId) return;
  const supabase = getSupabase();
  await supabase.from(table).delete().eq('org_id', orgId).eq('id', String(id));
}

export async function deleteCustomerFromSupabase(id: string): Promise<void> {
  await deleteEntity('customers', id);
}

export async function deleteQuoteFromSupabase(id: string): Promise<void> {
  await deleteEntity('quotes', id);
}

export async function deleteProductFromSupabase(id: string): Promise<void> {
  await deleteEntity('products', id);
}

export async function deletePricingRuleFromSupabase(id: string): Promise<void> {
  await deleteEntity('pricing_rules', id);
}

export async function deleteProjectFromSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const orgId = await resolveOrg();
  if (!orgId) return;
  const supabase = getSupabase();
  await supabase.from('projects').delete().eq('org_id', orgId).eq('id', String(id));
}

// ── Storage ──

export async function uploadFileToStorage(
  bucket: string,
  path: string,
  file: File | Blob,
  contentType?: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const orgId = await resolveOrg();
  if (!orgId) return null;
  const supabase = getSupabase();
  const fullPath = `${orgId}/${path}`;
  const { error } = await supabase.storage.from(bucket).upload(fullPath, file, {
    upsert: true,
    contentType: contentType ?? file.type,
  });
  if (error) {
    console.warn('Storage upload failed:', error.message);
    return null;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath);
  return data.publicUrl;
}

export async function getSignedFileUrl(bucket: string, path: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const orgId = await resolveOrg();
  if (!orgId) return null;
  const supabase = getSupabase();
  const fullPath = `${orgId}/${path}`;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(fullPath, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function saveProjectFileMetadata(
  projectId: string,
  file: { id: string; storagePath: string; filename: string; mimeType: string; source?: string; uploadedBy?: string; caption?: string; takenAt?: string; messageId?: string; taskId?: string; bucket?: string },
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const orgId = await resolveOrg();
  if (!orgId) return;
  const supabase = getSupabase();
  await supabase.from('project_files').upsert({
    id: file.id,
    org_id: orgId,
    project_id: projectId,
    storage_path: file.storagePath,
    filename: file.filename,
    mime_type: file.mimeType,
    source: file.source ?? null,
    uploaded_by: file.uploadedBy ?? null,
    caption: file.caption ?? null,
    taken_at: file.takenAt ?? new Date().toISOString(),
    message_id: file.messageId ?? null,
    task_id: file.taskId ?? null,
    bucket: file.bucket ?? 'project-files',
  }, { onConflict: 'org_id,id' });
}

export { isSupabaseConfigured };
