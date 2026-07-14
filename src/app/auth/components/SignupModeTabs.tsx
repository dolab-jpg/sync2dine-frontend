type SignupMode = 'company' | 'invite';

interface SignupModeTabsProps {
  mode: SignupMode;
  onChange: (mode: SignupMode) => void;
}

export function SignupModeTabs({ mode, onChange }: SignupModeTabsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100" role="tablist" aria-label="Signup mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'company'}
        onClick={() => onChange('company')}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
          mode === 'company' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        New company
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'invite'}
        onClick={() => onChange('invite')}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
          mode === 'invite' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        Join with invite
      </button>
    </div>
  );
}

export type { SignupMode };
