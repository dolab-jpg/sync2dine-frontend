import { useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Eye, EyeOff } from 'lucide-react';
import type { IntegrationFieldDef } from '../../config/integrations/types';

interface IntegrationFieldFormProps {
  fields: IntegrationFieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}

export function IntegrationFieldForm({ fields, values, onChange, disabled }: IntegrationFieldFormProps) {
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      {fields.map(field => (
        <div key={field.key}>
          <Label className="text-sm font-medium">{field.label}</Label>
          {field.type === 'select' && field.options ? (
            <Select
              value={values[field.key] ?? ''}
              onValueChange={v => onChange(field.key, v)}
              disabled={disabled}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {field.options.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field.type === 'readonly' ? (
            <Input
              className="mt-1 bg-gray-50"
              value={values[field.key] ?? field.placeholder ?? ''}
              readOnly
            />
          ) : field.type === 'password' ? (
            <div className="relative mt-1">
              <Input
                type={visible[field.key] ? 'text' : 'password'}
                value={values[field.key] ?? ''}
                onChange={e => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                disabled={disabled}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setVisible(v => ({ ...v, [field.key]: !v[field.key] }))}
              >
                {visible[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <Input
              className="mt-1"
              type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
              value={values[field.key] ?? ''}
              onChange={e => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              disabled={disabled}
            />
          )}
        </div>
      ))}
    </div>
  );
}
