import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Download, Share2, Sparkles, Home, CheckCircle2, Palette, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { currentLang } from '@/i18n/config';
import { cn } from '@/utils/cn';
import {
  CARD_FONTS,
  CARD_THEMES,
  COLLEGE_NAME_TH,
  COLLEGE_NAME_EN,
  FACULTY_NAME_TH,
  FACULTY_NAME_EN,
  parseCardParams,
  renderShareCardToDataUrl,
  type CardFontId,
  type CardThemeId,
} from './cardCanvas';

export function CardDownloadPage() {
  const location = useLocation();
  const uiLang = currentLang();
  const baseParsed = useMemo(() => parseCardParams(location.search), [location.search]);

  const [selectedTheme, setSelectedTheme] = useState<CardThemeId>(baseParsed.theme ?? 'cyber');
  const [selectedFont, setSelectedFont] = useState<CardFontId>(baseParsed.fontStyle ?? 'modern');

  const cardData = useMemo(
    () => ({
      ...baseParsed,
      lang: uiLang,
      theme: selectedTheme,
      fontStyle: selectedFont,
    }),
    [baseParsed, uiLang, selectedTheme, selectedFont],
  );

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
          title: 'Future Robot Adventure',
          text: `${cardData.name} (${cardData.school}) พิชิตภารกิจเขียนโค้ดหุ่นยนต์ที่ ${cardData.collegeNameTh || cardData.collegeName || COLLEGE_NAME_TH} ${cardData.facultyNameTh || cardData.facultyName || FACULTY_NAME_TH}!`,
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
          <p className="text-xs font-extrabold text-amber-300">
            {isTh
              ? cardData.collegeNameTh || cardData.collegeName || COLLEGE_NAME_TH
              : cardData.collegeNameEn || cardData.collegeName || COLLEGE_NAME_EN}
          </p>
          <p className="text-xs font-bold text-sky-300">
            {isTh
              ? cardData.facultyNameTh || cardData.facultyName || FACULTY_NAME_TH
              : cardData.facultyNameEn || cardData.facultyName || FACULTY_NAME_EN}
          </p>
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

            {dataUrl ? (
              <div className="overflow-hidden rounded-2xl border-2 border-sky-400/50 shadow-xl">
                <img
                  src={dataUrl}
                  alt={cardData.name}
                  className="w-full h-auto block"
                  data-testid="share-card-image"
                />
              </div>
            ) : (
              <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-6">
                <LoadingSpinner
                  size="lg"
                  message={isTh ? 'กำลังสร้างการ์ดผลงาน...' : 'Generating Achievement Card...'}
                  dark
                />
              </div>
            )}

            {/* Mobile Theme & Font Switcher */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-3 text-left">
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-sky-300">
                  <Palette className="h-3.5 w-3.5" />
                  {isTh ? 'เปลี่ยนธีมการ์ด' : 'Card Theme'}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {CARD_THEMES.map((thm) => (
                    <button
                      key={thm.id}
                      type="button"
                      onClick={() => setSelectedTheme(thm.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition-all cursor-pointer',
                        selectedTheme === thm.id
                          ? 'border-sky-400 bg-sky-500/20 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-300',
                      )}
                    >
                      <span className={cn('h-3 w-3 rounded-full bg-gradient-to-br shrink-0', thm.swatch)} />
                      <span className="truncate">{isTh ? thm.labelTh : thm.labelEn}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                  <Type className="h-3.5 w-3.5" />
                  {isTh ? 'เปลี่ยนฟอนต์ตัวอักษร' : 'Font Style'}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {CARD_FONTS.map((fnt) => (
                    <button
                      key={fnt.id}
                      type="button"
                      onClick={() => setSelectedFont(fnt.id)}
                      className={cn(
                        'rounded-xl border px-2 py-1.5 text-[11px] font-extrabold transition-all cursor-pointer text-center',
                        selectedFont === fnt.id
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-slate-800 bg-slate-900 text-slate-300',
                      )}
                    >
                      {isTh ? fnt.labelTh : fnt.labelEn}
                    </button>
                  ))}
                </div>
              </div>
            </div>

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
