import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { toast } from '@/stores/toastStore';
import { adminApi } from '@/services/api/adminApi';

interface ImageUploaderProps {
  folder: 'logos' | 'robots' | 'scenes' | 'lessons' | 'rewards' | 'dashboard';
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}

export function ImageUploader({ folder, value, onChange, label }: ImageUploaderProps) {
  const { t } = useTranslation('admin');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await adminApi.uploadAsset(folder, file);
      onChange(url);
      toast('success', t('common.saved'));
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'TYPE') toast('error', t('common.invalidImageType'));
      else if (code === 'SIZE') toast('error', t('common.imageTooLarge'));
      else toast('error', t('common.saveFailed'), code);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-semibold text-slate-700">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {value && (
          <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img src={value} alt="" className="h-full w-full object-contain" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute right-0.5 top-0.5 rounded-full bg-slate-900/75 p-0.5 text-white hover:bg-rose-600 cursor-pointer"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFile}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {uploading ? t('common.uploading') : t('common.uploadImage')}
        </Button>
      </div>
    </div>
  );
}
