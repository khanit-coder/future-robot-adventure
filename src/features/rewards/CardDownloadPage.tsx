import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Download, Share2, Sparkles, Home, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { currentLang } from '@/i18n/config';
import {
  COLLEGE_NAME_TH,
  FACULTY_NAME_TH,
  parseCardParams,
  renderShareCardToDataUrl,
} from './cardCanvas';

export function CardDownloadPage() {
  const location = useLocation();
  const uiLang = currentLang();
  const cardData = useMemo(() => {
    const parsed = parseCardParams(location.search);
    return { ...parsed, lang: uiLang };
  }, [location.search, uiLang]);

  const [dataUrl, setDataUrl] = useState<string>('');
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    let active = true;
    const render = () => {
      if (!active) return;
      const url = renderShareCardToDataUrl(cardData);
      setDataUrl(url);
    };
    render();
    if (typeof document !== 'undefined' && 'fonts' in document) {
      void document.fonts.ready.then(() => {
        if (active) render();
      });
    }
    return () => {
      active = false;
    };
  }, [cardData]);

  const fileName = `future-robot-${cardData.name.replace(/\s+/g, '-') || 'coder'}.png`;

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloaded(true);
  };

  const handleNativeShare = async () => {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Future Robot Adventure — P-TECH KKT',
          text: `${cardData.name} (${cardData.school}) พิชิตภารกิจเขียนโค้ดหุ่นยนต์ที่ ${COLLEGE_NAME_TH} ${FACULTY_NAME_TH}!`,
          files: [file],
        });
        return;
      }
    } catch {
      // Fallback to direct download if share dialog is cancelled or unsupported
    }
    handleDownload();
  };

  const isTh = uiLang === 'th';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white px-4 py-6">
      <header className="mx-auto flex max-w-lg items-center justify-between pb-4">
        <div>
          <p className="text-xs font-extrabold text-amber-300">{COLLEGE_NAME_TH}</p>
          <p className="text-xs font-bold text-sky-300">{FACULTY_NAME_TH}</p>
        </div>
        <LanguageSwitcher dark />
      </header>

      <main className="mx-auto max-w-lg space-y-5 pb-12">
        <Card className="border-slate-800 bg-slate-900/95 text-white shadow-2xl">
          <CardContent className="space-y-5 p-5 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3.5 py-1 text-xs font-extrabold text-amber-300">
              <Sparkles className="h-4 w-4" />
              {isTh ? 'การ์ดผู้พิชิตภารกิจพร้อมดาวน์โหลด!' : 'Your Achievement Card is Ready!'}
            </div>

            {dataUrl && (
              <div className="overflow-hidden rounded-2xl border-2 border-sky-400/50 shadow-xl">
                <img
                  src={dataUrl}
                  alt={cardData.name}
                  className="w-full h-auto block"
                  data-testid="share-card-image"
                />
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              <Button
                variant="success"
                size="lg"
                className="w-full text-base font-extrabold py-6 shadow-lg"
                onClick={handleDownload}
                data-testid="download-card-btn"
              >
                <Download className="h-5 w-5" />
                {isTh ? 'บันทึกรูปภาพการ์ดลงเครื่อง (PNG)' : 'Download Card Image (PNG)'}
              </Button>

              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full text-base font-extrabold"
                  onClick={() => void handleNativeShare()}
                >
                  <Share2 className="h-5 w-5" />
                  {isTh
                    ? 'แชร์ไปยังโซเชียลมีเดีย / บันทึกรูป'
                    : 'Share to Social Media / Save Photo'}
                </Button>
              )}

              {downloaded && (
                <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400 pt-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {isTh
                    ? 'ดาวน์โหลดสำเร็จ! นำภาพไปโพสต์ลง Facebook, IG, TikTok ได้เลย'
                    : 'Downloaded! Ready to share on Facebook, IG, or TikTok.'}
                </p>
              )}

              <p className="text-xs text-slate-400 pt-1">
                {isTh
                  ? '💡 เคล็ดลับ: บนมือถือสามารถกดค้างที่รูปภาพด้านบน แล้วเลือก "บันทึกรูปภาพ" ลงอัลบั้มได้ทันที'
                  : '💡 Tip: On mobile, you can also long-press the card image above and tap "Save Image".'}
              </p>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <Link to="/play">
                <Button variant="outline" size="sm" className="text-slate-200 border-slate-700 hover:bg-slate-800">
                  <Home className="h-4 w-4" />
                  {isTh ? 'กลับไปยังหน้าหลักเกม' : 'Go to Game Home'}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
