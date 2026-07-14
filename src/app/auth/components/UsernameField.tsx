import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string): string | null {
  const normalized = normalizeUsername(value);
  if (!normalized) return 'Username is required.';
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'Username must be 3–30 characters: lowercase letters, numbers, dots, underscores, or hyphens.';
  }
  return null;
}

interface UsernameFieldProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
}

export function UsernameField({
  id = 'username',
  label = 'Username',
  value,
  onChange,
  placeholder = 'jane.smith',
  disabled,
  hint,
}: UsernameFieldProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        autoComplete="username"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1"
      />
      {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </div>
  );
}
