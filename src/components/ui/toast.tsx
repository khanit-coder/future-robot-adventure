import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useToastStore } from '@/stores/toastStore';

export function Toaster() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 max-w-[92vw] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'flex items-start gap-3 rounded-2xl border p-3.5 shadow-lg bg-white',
            t.kind === 'success' && 'border-emerald-200',
            t.kind === 'error' && 'border-rose-200',
            t.kind === 'info' && 'border-sky-200',
          )}
        >
          {t.kind === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />}
          {t.kind === 'error' && <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />}
          {t.kind === 'info' && <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />}
          <div className="flex-1 text-sm">
            <p className="font-semibold text-slate-900">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs text-slate-600">{t.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
