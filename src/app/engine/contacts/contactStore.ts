import type { Customer } from '../../App';
import type { ContactRole, CustomerContact } from '../project/types';
import { normalizeUkPhone } from '../messaging/whatsappProvider';

const CONTACTS_KEY = 'customerContacts';

export function loadContacts(): CustomerContact[] {
  try {
    return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveContacts(contacts: CustomerContact[]): void {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export function seedContactsFromCustomers(customers: Customer[]): void {
  const existing = loadContacts();
  if (existing.length > 0) return;
  const seeded: CustomerContact[] = customers
    .filter(c => c.phone)
    .map(c => ({
      id: `CT${c.id}`,
      customerId: c.id,
      name: c.name,
      phone: normalizeUkPhone(c.phone),
      role: 'primary' as ContactRole,
      whatsappOptIn: c.whatsappOptIn ?? true,
      isPrimary: true,
    }));
  saveContacts(seeded);
}

export function getContactsForCustomer(customerId: string): CustomerContact[] {
  return loadContacts().filter(c => c.customerId === customerId);
}

export function addContact(contact: Omit<CustomerContact, 'id'>): CustomerContact {
  const contacts = loadContacts();
  const newContact: CustomerContact = { ...contact, id: `CT${Date.now()}` };
  if (contact.isPrimary) {
    contacts.forEach(c => {
      if (c.customerId === contact.customerId) c.isPrimary = false;
    });
  }
  contacts.push(newContact);
  saveContacts(contacts);
  return newContact;
}

export function updateContact(id: string, updates: Partial<CustomerContact>): void {
  const contacts = loadContacts();
  const idx = contacts.findIndex(c => c.id === id);
  if (idx < 0) return;
  if (updates.isPrimary) {
    contacts.forEach(c => {
      if (c.customerId === contacts[idx].customerId) c.isPrimary = false;
    });
  }
  contacts[idx] = { ...contacts[idx], ...updates };
  saveContacts(contacts);
}

export function deleteContact(id: string): void {
  saveContacts(loadContacts().filter(c => c.id !== id));
}

export interface ResolvedContact {
  contact: CustomerContact | null;
  customerId: string | null;
  customerName: string;
  contactName: string;
  contactRole: ContactRole | 'guest';
  phone: string;
}

export function resolveContactByPhone(
  phone: string,
  customers: Customer[]
): ResolvedContact {
  const normalized = normalizeUkPhone(phone).replace(/\D/g, '');
  const contacts = loadContacts();
  const match = contacts.find(c => c.phone.replace(/\D/g, '') === normalized);
  if (match) {
    const customer = customers.find(c => c.id === match.customerId);
    return {
      contact: match,
      customerId: match.customerId,
      customerName: customer?.name ?? 'Unknown',
      contactName: match.name,
      contactRole: match.role,
      phone: match.phone,
    };
  }
  const customer = customers.find(c => c.phone.replace(/\D/g, '') === normalized);
  if (customer) {
    return {
      contact: null,
      customerId: customer.id,
      customerName: customer.name,
      contactName: customer.name,
      contactRole: 'primary',
      phone: normalizeUkPhone(customer.phone),
    };
  }
  return {
    contact: null,
    customerId: null,
    customerName: 'Guest',
    contactName: 'Guest',
    contactRole: 'guest',
    phone: normalizeUkPhone(phone),
  };
}
