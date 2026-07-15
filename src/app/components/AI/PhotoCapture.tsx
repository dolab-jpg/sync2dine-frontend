import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { Button } from '../ui/button';
import { isNativeBridgeAvailable, nativeTakePhoto } from '../../bridge/nativeBridge';

interface PhotoCaptureProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
  photoGuidance?: string[];
  showGuidance?: boolean;
  /** When false, hide Upload/Camera buttons (actions live in ComposerAttachMenu). */
  showActions?: boolean;
  /** Imperative handle so a parent + menu can trigger upload/camera. */
  actionRef?: MutableRefObject<PhotoCaptureActions | null>;
  /** When true, render nothing unless there are photos (or guidance to show). */
  compact?: boolean;
}

export interface PhotoCaptureActions {
  openUpload: () => void;
  openCamera: () => void;
}

export function PhotoCapture({
  photos,
  onChange,
  maxPhotos = 5,
  photoGuidance,
  showGuidance = false,
  showActions = true,
  actionRef,
  compact = false,
}: PhotoCaptureProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [guidanceFromClick, setGuidanceFromClick] = useState(false);
  const showHints = showGuidance || guidanceFromClick || photos.length > 0;

  const openCamera = async () => {
    setGuidanceFromClick(true);
    if (isNativeBridgeAvailable()) {
      const result = await nativeTakePhoto(true);
      if (result?.ok && result.dataUrl) {
        onChange([...photos, result.dataUrl].slice(0, maxPhotos));
        return;
      }
    }
    cameraRef.current?.click();
  };

  const openUpload = async () => {
    setGuidanceFromClick(true);
    if (isNativeBridgeAvailable()) {
      const result = await nativeTakePhoto(false);
      if (result?.ok && result.dataUrl) {
        onChange([...photos, result.dataUrl].slice(0, maxPhotos));
        return;
      }
    }
    fileRef.current?.click();
  };

  useEffect(() => {
    if (!actionRef) return;
    actionRef.current = { openUpload, openCamera };
  });

  useEffect(() => {
    return () => {
      if (actionRef) actionRef.current = null;
    };
  }, [actionRef]);
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

  const hasContent =
    showActions ||
    photos.length > 0 ||
    (showHints && photoGuidance && photoGuidance.length > 0);

  if (compact && !hasContent) {
    return (
      <>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => addFiles(e.target.files)} />
      </>
    );
  }

  return (
    <div className="space-y-2">
      {showActions && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openUpload}>
            <Upload className="w-4 h-4 mr-1" /> Upload
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={openCamera}>
            <Camera className="w-4 h-4 mr-1" /> Camera
          </Button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => addFiles(e.target.files)} />
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((p, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border">
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
      {(showActions || photos.length > 0) && (
        <p className="text-xs text-gray-500">{photos.length}/{maxPhotos} photos</p>
      )}
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
