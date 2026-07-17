import { useState } from 'react';
import { Check, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../components/ui/button';

export const SEED_PASSWORD = 'Sync2DineDemo1!';

export const SEED_ACCOUNTS = [
  { role: 'platform_owner', label: 'Platform Owner', username: 'owner', email: 'owner@sync2dine.io', name: 'Platform Owner' },
  { role: 'super_admin', label: 'Restaurant Owner', username: 'maya.nguyen', email: 'maya@demo.sync2dine.io', name: 'Maya Nguyen' },
  { role: 'manager', label: 'Manager', username: 'leo.martinez', email: 'leo@demo.sync2dine.io', name: 'Leo Martinez' },
  { role: 'staff', label: 'Front of House', username: 'priya.patel', email: 'priya@demo.sync2dine.io', name: 'Priya Patel' },
  { role: 'builder', label: 'Kitchen / Ops', username: 'kai.brooks', email: 'kai@demo.sync2dine.io', name: 'Kai Brooks' },
  { role: 'recruitment', label: 'Hiring', username: 'nina.ross', email: 'nina@demo.sync2dine.io', name: 'Nina Ross' },
] as const;

export type SeedAccount = (typeof SEED_ACCOUNTS)[number];

interface SeedAccountsPanelProps {
  onFill: (account: SeedAccount) => void;
  defaultOpen?: boolean;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      title={`Copy ${label}`}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-amber-800 hover:bg-amber-100"
      onClick={async (e) => {
        e.stopPropagation();
        const copied = await copyText(value);
        if (copied) {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        }
      }}
    >
      {ok ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="font-mono select-all">{value}</span>
    </button>
  );
}

export function SeedAccountsPanel({ onFill, defaultOpen = true }: SeedAccountsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [passwordCopied, setPasswordCopied] = useState(false);

  return (
    <div className="mt-6 rounded-2xl border border-amber-400/40 bg-white/95 shadow-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-left"
      >
        <div>
          <p className="font-semibold">Demo accounts — click to fill or copy</p>
          <p className="text-xs text-amber-50/90">Real Supabase users · shared password below</p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Password (all)</span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1 font-mono text-sm text-slate-900 hover:bg-amber-50"
              onClick={async () => {
                const copied = await copyText(SEED_PASSWORD);
                if (copied) {
                  setPasswordCopied(true);
                  setTimeout(() => setPasswordCopied(false), 1200);
                }
              }}
            >
              {passwordCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {SEED_PASSWORD}
            </button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={async () => {
                const lines = [
                  `Password (all): ${SEED_PASSWORD}`,
                  ...SEED_ACCOUNTS.map(
                    (a) => `${a.label}\t${a.username}\t${a.email}\t${SEED_PASSWORD}`,
                  ),
                ];
                await copyText(lines.join('\n'));
              }}
            >
              Copy all
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Username</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {SEED_ACCOUNTS.map((account) => (
                  <tr
                    key={account.email}
                    className="border-t border-slate-100 hover:bg-amber-50/60 cursor-pointer"
                    onClick={() => onFill(account)}
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-slate-900">{account.label}</span>
                      <p className="text-xs text-slate-500">{account.name}</p>
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <CopyBtn value={account.username} label="username" />
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <CopyBtn value={account.email} label="email" />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFill(account);
                        }}
                      >
                        Use
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Tip: click a row or <strong>Use</strong> to fill the form, then Sign in. Click username/email/password chips to copy.
          </p>
        </div>
      )}
    </div>
  );
}
