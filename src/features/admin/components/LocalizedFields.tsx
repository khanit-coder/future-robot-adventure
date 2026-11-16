import type { Localized } from '@engine';
import { useTranslation } from 'react-i18next';
import { Input, Label, Textarea } from '@/components/ui/input';

interface LocalizedFieldsProps {
  label: string;
  value: Localized;
  onChange: (next: Localized) => void;
  multiline?: boolean;
}

export function LocalizedFields({ label, value, onChange, multiline = false }: LocalizedFieldsProps) {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('common.thai')} (TH)</Label>
          {multiline ? (
            <Textarea value={value.th ?? ''} onChange={(e) => onChange({ ...value, th: e.target.value })} />
          ) : (
            <Input value={value.th ?? ''} onChange={(e) => onChange({ ...value, th: e.target.value })} />
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('common.english')} (EN)</Label>
          {multiline ? (
            <Textarea value={value.en ?? ''} onChange={(e) => onChange({ ...value, en: e.target.value })} />
          ) : (
            <Input value={value.en ?? ''} onChange={(e) => onChange({ ...value, en: e.target.value })} />
          )}
        </div>
      </div>
    </div>
  );
}
