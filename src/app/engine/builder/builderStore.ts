import { testBuilders } from '../../data/testData';

const BUILDERS_KEY = 'managedBuilders';

export type BuilderStatus = 'active' | 'inactive' | 'on_leave';
export type BuilderPaymentType = 'price_work' | 'day_rate';

export interface BuilderRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsappOptIn: boolean;
  specialties: string[];
  status: BuilderStatus;
  joinedDate: string;
  defaultPaymentType: BuilderPaymentType;
  dayRate?: number;
  hourlyRate?: number;
  color?: string;
}

function isBuilderStatus(value: unknown): value is BuilderStatus {
  return value === 'active' || value === 'inactive' || value === 'on_leave';
}

function isBuilderPaymentType(value: unknown): value is BuilderPaymentType {
  return value === 'price_work' || value === 'day_rate';
}

function toBuilderRecord(raw: Record<string, unknown>, index: number): BuilderRecord {
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : `B${String(index + 1).padStart(3, '0')}`;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name : `Builder ${index + 1}`;
  const email = typeof raw.email === 'string' ? raw.email : '';
  const phone = typeof raw.phone === 'string' ? raw.phone : '';
  const specialties = Array.isArray(raw.specialties)
    ? raw.specialties.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  return {
    id,
    name,
    email,
    phone,
    whatsappOptIn: typeof raw.whatsappOptIn === 'boolean' ? raw.whatsappOptIn : true,
    specialties,
    status: isBuilderStatus(raw.status) ? raw.status : 'active',
    joinedDate: typeof raw.joinedDate === 'string' ? raw.joinedDate : new Date().toISOString().split('T')[0],
    defaultPaymentType: isBuilderPaymentType(raw.defaultPaymentType) ? raw.defaultPaymentType : 'price_work',
    dayRate: typeof raw.dayRate === 'number' ? raw.dayRate : undefined,
    hourlyRate: typeof raw.hourlyRate === 'number' ? raw.hourlyRate : undefined,
    color: typeof raw.color === 'string' ? raw.color : undefined,
  };
}

function parseStoredBuilders(rawValue: string | null): BuilderRecord[] {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((value, index) => toBuilderRecord((value ?? {}) as Record<string, unknown>, index));
  } catch {
    return [];
  }
}

function getSeedBuilders(): BuilderRecord[] {
  if (!Array.isArray(testBuilders)) return [];
  return testBuilders.map((builder, index) => toBuilderRecord(builder as unknown as Record<string, unknown>, index));
}

export function loadBuilders(): BuilderRecord[] {
  const stored = parseStoredBuilders(localStorage.getItem(BUILDERS_KEY));
  if (stored.length > 0) return stored;

  const seeded = getSeedBuilders();
  if (seeded.length > 0) saveBuilders(seeded);
  return seeded;
}

export function saveBuilders(builders: BuilderRecord[]): void {
  localStorage.setItem(BUILDERS_KEY, JSON.stringify(builders));
}

export function upsertBuilder(builder: BuilderRecord): BuilderRecord {
  const builders = loadBuilders();
  const normalized = toBuilderRecord(builder as unknown as Record<string, unknown>, builders.length);
  const index = builders.findIndex(existing => existing.id === normalized.id);
  if (index >= 0) builders[index] = normalized;
  else builders.push(normalized);
  saveBuilders(builders);
  return normalized;
}

export function removeBuilder(builderId: string): void {
  const builders = loadBuilders().filter(builder => builder.id !== builderId);
  saveBuilders(builders);
}
