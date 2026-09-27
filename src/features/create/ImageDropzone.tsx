import React, { useRef, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { UploadCloud, Image as ImageIcon, X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSound } from '../../lib/sound';
import { triggerHaptic } from '../../lib/haptics';

export const ImageDropzone: React.FC = () => {
  const { uploadedImage, setUploadedImage, addToast } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { play } = useSound();

  const MAX_FILE_SIZE_MB = 20;
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  const processFile = (file: File) => {
    setErrorMessage(null);

    // Validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMessage('Unsupported file format. Please upload PNG, JPEG, or WEBP.');
      play('error');
      triggerHaptic('error');
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`File exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      play('error');
      triggerHaptic('error');
      return;
    }

    setIsValidating(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        try {
          const { uploadAsset } = await import('../../lib/api/assets');
          const serverAsset = await uploadAsset(file);

          setUploadedImage({
            id: serverAsset.id,
            assetId: serverAsset.id,
            name: file.name,
            previewUrl: serverAsset.url || dataUrl,
            fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            width: img.width,
            height: img.height,
          });
          setIsValidating(false);
          play('toggle');
          triggerHaptic('success');
          addToast({
            type: 'success',
            title: 'Image Uploaded & Ready',
            message: `${file.name} saved to studio storage.`,
          });
        } catch (uploadErr: any) {
          console.warn('Backend upload fallback:', uploadErr);
          // Fallback to local data URL if offline
          setUploadedImage({
            id: 'upload-' + Date.now(),
            name: file.name,
            previewUrl: dataUrl,
            fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            width: img.width,
            height: img.height,
          });
          setIsValidating(false);
        }
      };
      img.onerror = () => {
        setIsValidating(false);
        setErrorMessage('Failed to decode image data.');
      };
      img.src = dataUrl;
    };

    reader.onerror = () => {
      setIsValidating(false);
      setErrorMessage('Failed to read file from disk.');
    };

    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    play('click');
    setUploadedImage(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
          Reference / Source Image
        </label>
        {uploadedImage && (
          <span className="text-[11px] text-slate-400 font-mono-numbers">
            {uploadedImage.width}×{uploadedImage.height} px · {uploadedImage.fileSize}
          </span>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
      />

      {uploadedImage ? (
        // Selected Image Preview State
        <div className="relative w-full rounded-2xl border border-white/15 bg-[#10121A] p-3 flex flex-col sm:flex-row items-center gap-4 overflow-hidden group">
          <div className="relative w-full sm:w-28 h-28 rounded-xl overflow-hidden bg-black/50 shrink-0 border border-white/10">
            <img
              src={uploadedImage.previewUrl}
              alt="Source preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-emerald-500 text-slate-950 shadow-md">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 text-center sm:text-left">
            <h4 className="text-sm font-semibold text-white truncate max-w-xs">{uploadedImage.name}</h4>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-400">
              <span>Ready for generation</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-numbers">{uploadedImage.fileSize}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Replace</span>
            </button>
            <button
              onClick={handleRemove}
              className="p-2 rounded-xl text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              aria-label="Remove image"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        // Dropzone Idle / Dragging State
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-2 select-none ${
            isDragging
              ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
              : 'border-white/10 hover:border-white/20 bg-[#10121A]/60 hover:bg-[#131622]/80'
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-200 ${
            isDragging ? 'scale-110 bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-400'
          }`}>
            {isValidating ? (
              <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            ) : isDragging ? (
              <UploadCloud className="w-6 h-6 text-amber-400" />
            ) : (
              <ImageIcon className="w-6 h-6" />
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-white">
              {isDragging ? 'Drop your image here' : 'Drop reference image or click to browse'}
            </span>
            <span className="text-xs text-slate-400">
              PNG, JPEG, WEBP up to 20MB
            </span>
          </div>

          {errorMessage && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
