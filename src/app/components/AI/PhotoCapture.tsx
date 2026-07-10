import { useRef, useState } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { Button } from '../ui/button';

interface PhotoCaptureProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
  photoGuidance?: string[];
  showGuidance?: boolean;
}

export function PhotoCapture({ photos, onChange, maxPhotos = 5, photoGuidance, showGuidance = false }: PhotoCaptureProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [guidanceFromClick, setGuidanceFromClick] = useState(false);
  const showHints = showGuidance || guidanceFromClick || photos.length > 0;

  const openUpload = () => {
    setGuidanceFromClick(true);
    fileRef.current?.click();
  };

  const openCamera = () => {
    setGuidanceFromClick(true);
    cameraRef.current?.click();
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, maxPhotos - photos.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const url = e.target?.result as string;
        onChange([...photos, url].slice(0, maxPhotos));
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={openUpload}>
          <Upload className="w-4 h-4 mr-1" /> Upload
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={openCamera}>
          <Camera className="w-4 h-4 mr-1" /> Camera
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => addFiles(e.target.files)} />
      </div>
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((p, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
              <img src={p} alt={`Site ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">{photos.length}/{maxPhotos} photos</p>
      {showHints && photoGuidance && photoGuidance.length > 0 && (
        <ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">
          {photoGuidance.map((hint, i) => (
            <li key={i}>{hint}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
