/**
 * Minimal staff phone PIN helpers for Settings → Staff phone registration.
 * Runtime PIN verify/unlock for Aria lives in tradepro-backend phone-auth (other owner).
 */
import { randomBytes, scryptSync } from 'crypto';

const PIN_LEN = 4;

export function normalizePhonePin(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

export function isValidPhonePin(raw: string): boolean {
  const pin = normalizePhonePin(raw);
  return pin.length === PIN_LEN;
}

export function hashPhonePin(pin: string): string {
  const normalized = normalizePhonePin(pin);
  if (!isValidPhonePin(normalized)) {
    throw new Error(`Phone PIN must be exactly ${PIN_LEN} digits`);
  }
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(normalized, salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}
