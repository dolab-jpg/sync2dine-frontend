import { useState } from 'react';
import { Camera, Headphones, Plus, Square, Upload } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../ui/utils';

interface ComposerAttachMenuProps {
  disabled?: boolean;
  onUpload: () => void;
  onCamera: () => void;
  handsFreeSupported?: boolean;
  handsFreeActive?: boolean;
  onToggleHandsFree?: () => void;
}

export function ComposerAttachMenu({
  disabled = false,
  onUpload,
  onCamera,
  handsFreeSupported = false,
  handsFreeActive = false,
  onToggleHandsFree,
}: ComposerAttachMenuProps) {
  const [open, setOpen] = useState(false);

  const runAndClose = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="Attachments"
          aria-label="Attachments"
          className={cn(
            'inline-flex items-center justify-center size-9 rounded-full',
            'text-slate-500 hover:bg-slate-200/70 hover:text-slate-700 transition-colors',
            'disabled:opacity-50 disabled:pointer-events-none',
          )}
        >
          <Plus className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-52 p-1.5" sideOffset={8}>
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100 text-left"
            onClick={() => runAndClose(onUpload)}
          >
            <Upload className="w-4 h-4 text-slate-500 shrink-0" />
            Upload photo
          </button>
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100 text-left"
            onClick={() => runAndClose(onCamera)}
          >
            <Camera className="w-4 h-4 text-slate-500 shrink-0" />
            Take photo
          </button>
          {handsFreeSupported && onToggleHandsFree ? (
            <button
              type="button"
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left',
                handsFreeActive
                  ? 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                  : 'text-slate-700 hover:bg-slate-100',
              )}
              onClick={() => runAndClose(onToggleHandsFree)}
            >
              {handsFreeActive ? (
                <Square className="w-4 h-4 shrink-0" />
              ) : (
                <Headphones className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              {handsFreeActive ? 'Stop hands-free' : 'Hands-free voice'}
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
