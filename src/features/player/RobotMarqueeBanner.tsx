import { useMemo } from 'react';
import type { Lang, RobotConfig } from '@engine';
import { RobotIllustration, type RobotVisualState } from '@/components/common/RobotIllustration';
import { BUILTIN_ROBOT_STYLES, SPECIAL_ROBOT_GRADIENTS } from '@/game-engine/animations/robotStyles';
import { pickLocalized } from '@/utils/localize';
import { cn } from '@/utils/cn';
import { Sparkles, Bot } from 'lucide-react';

interface RobotMarqueeBannerProps {
  robots?: RobotConfig[] | null;
  lang: Lang;
  fallbackLang?: Lang;
  className?: string;
}

interface DisplayRobotItem {
  id: string;
  name: { th: string; en: string };
  style: string;
  color: string;
  badge: string;
  state: RobotVisualState;
  robot?: Partial<RobotConfig>;
}

const FALLBACK_BUILTIN_ROBOTS: DisplayRobotItem[] = [
  { id: 'b1', name: { th: 'โบลต์', en: 'Bolt' }, style: 'bolt', color: '#38bdf8', badge: '🤖 คลาสสิก', state: 'walk' },
  { id: 'b2', name: { th: 'โนวา', en: 'Nova' }, style: 'nova', color: '#f472b6', badge: '🚀 นักสำรวจ', state: 'idle' },
  { id: 'b3', name: { th: 'กิซโม่', en: 'Gizmo' }, style: 'gizmo', color: '#4ade80', badge: '🛸 ไอพ่น', state: 'celebrate' },
  { id: 'b4', name: { th: 'ไททัน', en: 'Titan' }, style: 'titan', color: '#eab308', badge: '🛡️ เกราะหนัก', state: 'walk' },
  { id: 'b5', name: { th: 'ไซเบอร์', en: 'Cyber' }, style: 'cyber', color: '#06b6d4', badge: '🕶️ ไซเบอร์', state: 'wave' },
  { id: 'b6', name: { th: 'เอคโค่', en: 'Echo' }, style: 'echo', color: '#8b5cf6', badge: '✨ แคปซูลชิบิ', state: 'jump' },
  { id: 'b7', name: { th: 'สปาร์ค', en: 'Spark' }, style: 'spark', color: '#10b981', badge: '⚡ สายฟ้า', state: 'walk' },
  { id: 'b8', name: { th: 'ชาโดว์', en: 'Shadow' }, style: 'shadow', color: '#f97316', badge: '🥷 นินจา', state: 'run' },
  { id: 'b9', name: { th: 'แอสโตร', en: 'Astro' }, style: 'astro', color: '#ec4899', badge: '👨‍🚀 อวกาศ', state: 'walk' },
  { id: 'b10', name: { th: 'เรโทร', en: 'Retro' }, style: 'retro', color: '#a78bfa', badge: '📻 วินเทจ', state: 'turn' },
];

const ANIM_CYCLE: RobotVisualState[] = ['walk', 'idle', 'celebrate', 'wave', 'jump', 'run'];

export function RobotMarqueeBanner({
  robots,
  lang,
  fallbackLang = 'en',
  className,
}: RobotMarqueeBannerProps) {
  const isTh = lang === 'th';

  const items: DisplayRobotItem[] = useMemo(() => {
    if (robots && robots.length > 0) {
      return robots.map((r, i) => {
        const styleMeta = BUILTIN_ROBOT_STYLES.find((s) => s.id === r.builtin_style);
        const nameTh = r.name?.th || r.name?.en || styleMeta?.name.th || `หุ่นยนต์ ${i + 1}`;
        const nameEn = r.name?.en || r.name?.th || styleMeta?.name.en || `Robot ${i + 1}`;

        // Find gradient badge if gradient exists in name or primary_color
        const gradKey = typeof r.name === 'object' && r.name && 'gradient' in r.name ? (r.name as { gradient?: string }).gradient : null;
        const gradMeta = gradKey ? SPECIAL_ROBOT_GRADIENTS.find((g: { id: string }) => g.id === gradKey) : null;
        const badge = gradMeta ? `${gradMeta.badge} ${isTh ? gradMeta.name.th : gradMeta.name.en}` : (styleMeta?.badge ? `${styleMeta.badge} ${isTh ? styleMeta.name.th.split(' ')[0] : styleMeta.name.en.split(' ')[0]}` : '🤖 Companion');

        return {
          id: r.id,
          name: { th: nameTh, en: nameEn },
          style: r.builtin_style || 'bolt',
          color: r.primary_color || '#38bdf8',
          badge,
          state: ANIM_CYCLE[i % ANIM_CYCLE.length],
          robot: r,
        };
      });
    }
    return FALLBACK_BUILTIN_ROBOTS;
  }, [robots, isTh]);

  return (
    <div
      className={cn(
        'w-full shrink-0 border-t border-slate-800/90 bg-slate-950/75 backdrop-blur-md py-3.5 select-none overflow-hidden shadow-2xl',
        className,
      )}
    >
      <div className="max-w-7xl mx-auto px-6 mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold tracking-wide text-sky-300">
          <Sparkles className="h-4 w-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>
            {isTh
              ? 'กองทัพหุ่นยนต์ทั้งหมด • ระบบจะสุ่มเลือกให้เป็นคู่หูประจำตัวของคุณ!'
              : 'Robot Roster • A unique companion bot is assigned to each student!'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
          <Bot className="h-3.5 w-3.5 text-sky-400" />
          <span>
            {isTh
              ? `${items.length} แบบ พร้อมลุยภารกิจ`
              : `${items.length} robot models ready`}
          </span>
        </div>
      </div>

      {/* 1 Row Infinite Marquee flowing from Right to Left */}
      <div
        className="relative w-full overflow-hidden flex [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]"
        title={isTh ? 'หุ่นยนต์ทั้งหมดในเกม (เลื่อนอัตโนมัติจากขวาไปซ้าย)' : 'All available robots'}
      >
        <div className="flex shrink-0 items-center gap-3 animate-fra-marquee-rtl pr-3">
          {items.map((item, idx) => (
            <RobotMarqueePill
              key={`r1-${item.id}-${idx}`}
              item={item}
              lang={lang}
              fallbackLang={fallbackLang}
            />
          ))}
        </div>

        {/* Duplicate clone for seamless infinite loop */}
        <div className="flex shrink-0 items-center gap-3 animate-fra-marquee-rtl pr-3" aria-hidden="true">
          {items.map((item, idx) => (
            <RobotMarqueePill
              key={`r2-${item.id}-${idx}`}
              item={item}
              lang={lang}
              fallbackLang={fallbackLang}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RobotMarqueePill({
  item,
  lang,
  fallbackLang,
}: {
  item: DisplayRobotItem;
  lang: Lang;
  fallbackLang: Lang;
}) {
  const title = pickLocalized(item.name, lang, fallbackLang);

  return (
    <div
      className={cn(
        'group flex items-center gap-2.5 rounded-2xl border border-slate-700/70 bg-gradient-to-r from-slate-900/90 to-slate-950/90 px-3.5 py-2 shrink-0 shadow-md transition-all duration-300',
        'hover:border-sky-400 hover:scale-[1.04] hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] hover:from-slate-800/95 hover:to-slate-900/95 cursor-default',
      )}
      style={{ minWidth: '170px' }}
    >
      <div className="flex items-center justify-center shrink-0">
        <RobotIllustration
          robot={item.robot}
          styleName={item.style}
          color={item.color}
          size={46}
          state={item.state}
        />
      </div>

      <div className="flex flex-col min-w-0 pr-1">
        <p className="truncate text-xs sm:text-sm font-black text-white group-hover:text-sky-200 transition-colors">
          {title}
        </p>
        <span className="mt-0.5 inline-block truncate rounded-md bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 border border-slate-700/60 max-w-[130px]">
          {item.badge}
        </span>
      </div>
    </div>
  );
}
