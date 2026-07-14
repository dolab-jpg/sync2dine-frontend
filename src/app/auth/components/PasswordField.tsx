import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';

interface PasswordFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = 'Enter password',
  autoComplete = 'current-password',
  disabled,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div>
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="relative mt-1">
        <Input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 text-slate-500 hover:text-slate-800"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
