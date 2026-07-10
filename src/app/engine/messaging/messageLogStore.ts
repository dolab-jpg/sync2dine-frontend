import type { MessageLogEntry } from './types';

const STORAGE_KEY = 'messageLogs';

export function loadMessageLogs(): MessageLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function appendMessageLog(entry: Omit<MessageLogEntry, 'id' | 'sentAt'>): MessageLogEntry {
  const logs = loadMessageLogs();
  const full: MessageLogEntry = {
    ...entry,
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    sentAt: new Date().toISOString(),
  };
  logs.unshift(full);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 500)));
  return full;
}
