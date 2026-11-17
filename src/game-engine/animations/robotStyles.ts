/**
 * Builtin robot styles, special solid colors, and multi-color gradient editions.
 * Shared between Admin panel, React SVG illustrations, and Phaser procedural animations.
 */

export interface BuiltinRobotStyleMeta {
  id: string;
  name: { th: string; en: string };
  desc: { th: string; en: string };
  badge: string;
}

export interface SpecialColorMeta {
  id: string;
  name: { th: string; en: string };
  hex: string;
  visor: string;
  badge: string;
}

export interface SpecialGradientMeta {
  id: string;
  name: { th: string; en: string };
  desc: { th: string; en: string };
  gradient: string; // CSS linear-gradient string
  stops: string[];
  hex: string; // 6-digit hex code compliant with database constraint check (primary_color ~ '^#[0-9a-fA-F]{6}$')
  badge: string;
  accent: string;
}

export const BUILTIN_ROBOT_STYLES: BuiltinRobotStyleMeta[] = [
  {
    id: 'bolt',
    name: { th: 'โบลต์ (Bolt - คลาสสิก)', en: 'Bolt (Classic)' },
    desc: { th: 'หุ่นยนต์มิตรภาพ เสาอากาศกลม ทรงคลาสสิกขวัญใจทุกคน', en: 'Friendly classic robot with single antenna' },
    badge: '🤖',
  },
  {
    id: 'nova',
    name: { th: 'โนวา (Nova - นักสำรวจ)', en: 'Nova (Explorer)' },
    desc: { th: 'เสาอากาศคู่เรืองแสง ทรงมนสไตล์นักสำรวจอวกาศ', en: 'Dual glowing antennas, sleek astro-explorer' },
    badge: '🚀',
  },
  {
    id: 'gizmo',
    name: { th: 'กิซโม่ (Gizmo - ไอพ่นลอยตัว)', en: 'Gizmo (Hover Thruster)' },
    desc: { th: 'ฐานไอพ่นลอยฟ้าไฮเทค เคลื่อนที่นุ่มนวลไร้เสียง', en: 'High-tech hover thruster base, smooth floating' },
    badge: '🛸',
  },
  {
    id: 'titan',
    name: { th: 'ไททัน (Titan - เกราะหนัก Mecha)', en: 'Titan (Heavy Mecha)' },
    desc: { th: 'เกราะเหล็กหนา ไหล่บึกบึน ฐานตีนตะขาบทรงพลัง', en: 'Heavy armored shoulders with rugged tank treads' },
    badge: '🛡️',
  },
  {
    id: 'cyber',
    name: { th: 'ไซเบอร์ (Cyber - ไซเบอร์พังก์)', en: 'Cyber (Cyberpunk Visor)' },
    desc: { th: 'แว่นตาเรืองแสง VR Visor และหูฟังครอบหูไซเบอร์ล้ำยุค', en: 'Neon VR visor and cyber headphones' },
    badge: '🕶️',
  },
  {
    id: 'echo',
    name: { th: 'เอคโค่ (Echo - ทรงกลมสุดน่ารัก)', en: 'Echo (Cute Capsule Bot)' },
    desc: { th: 'หุ่นยนต์แคปซูลทรงกลม ตากลมโตแป๋ว ลอยตัวด้วยสนามแม่เหล็ก', en: 'Ultra-cute spherical bot with huge anime eyes' },
    badge: '✨',
  },
  {
    id: 'spark',
    name: { th: 'สปาร์ค (Spark - พลังสายฟ้า)', en: 'Spark (Energy Core)' },
    desc: { th: 'เขาพลังงานสายฟ้าคู่ พร้อมคอร์พลังงานสว่างสดใสที่หน้าอก', en: 'Dual lightning horns and bright energy chest core' },
    badge: '⚡',
  },
  {
    id: 'shadow',
    name: { th: 'ชาโดว์ (Shadow - นินจาสเตลธ์)', en: 'Shadow (Stealth Ninja)' },
    desc: { th: 'หน้ากากนินจาไซเบอร์ แถบเซนเซอร์ตาเฉี่ยว สไตล์สายลับลับเฉพาะ', en: 'Stealth ninja mask and sharp slit sensor visor' },
    badge: '🥷',
  },
  {
    id: 'astro',
    name: { th: 'แอสโตร (Astro - หมวกอวกาศ)', en: 'Astro (Space Helmet)' },
    desc: { th: 'หมวกอวกาศฟองน้ำกลมใหญ่ กระจกสะท้อนดวงดาว และถังออกซิเจน', en: 'Big bubble astronaut dome helmet' },
    badge: '👨‍🚀',
  },
  {
    id: 'retro',
    name: { th: 'เรโทร (Retro - วินเทจ 80s)', en: 'Retro (Vintage 80s)' },
    desc: { th: 'เสาอากาศสปริงขดลวด ตัวเหลี่ยมสังกะสี และมาตรวัดเข็มมิเตอร์', en: 'Vintage 80s tin box robot with spring antenna' },
    badge: '📻',
  },
];

export const SPECIAL_ROBOT_COLORS: SpecialColorMeta[] = [
  { id: 'gold', name: { th: 'ทองคำพรีเมียม', en: 'Royal Gold' }, hex: '#eab308', visor: '#fef08a', badge: '👑' },
  { id: 'ice', name: { th: 'ไดมอนด์ไอซ์', en: 'Diamond Ice' }, hex: '#e2e8f0', visor: '#38bdf8', badge: '💎' },
  { id: 'cyan', name: { th: 'ไซเบอร์ไซแอน', en: 'Cyber Cyan' }, hex: '#06b6d4', visor: '#67e8f9', badge: '⚡' },
  { id: 'sakura', name: { th: 'ซากุระนีออน', en: 'Neon Sakura' }, hex: '#ec4899', visor: '#f472b6', badge: '🌸' },
  { id: 'amethyst', name: { th: 'อเมทิสต์กาแล็กซี', en: 'Void Amethyst' }, hex: '#8b5cf6', visor: '#c084fc', badge: '🟣' },
  { id: 'emerald', name: { th: 'มรกตไซเบอร์', en: 'Matrix Emerald' }, hex: '#10b981', visor: '#4ade80', badge: '🟢' },
  { id: 'solar', name: { th: 'ส้มเพลิงสุริยะ', en: 'Solar Flare' }, hex: '#f97316', visor: '#fbbf24', badge: '🔥' },
  { id: 'obsidian', name: { th: 'ดำออบซิเดียนสเตลธ์', en: 'Stealth Obsidian' }, hex: '#334155', visor: '#ef4444', badge: '🖤' },
  { id: 'ruby', name: { th: 'ทับทิมเลือดมังกร', en: 'Crimson Ruby' }, hex: '#ef4444', visor: '#fca5a5', badge: '🔴' },
  { id: 'amber', name: { th: 'อำพันสายฟ้า', en: 'Electric Amber' }, hex: '#f59e0b', visor: '#fde047', badge: '🟡' },
];

export const SPECIAL_ROBOT_GRADIENTS: SpecialGradientMeta[] = [
  {
    id: 'rainbow',
    name: { th: 'โฮโลแกรมสายรุ้ง', en: 'Rainbow Hologram' },
    desc: { th: 'การไล่สีสเปกตรัมแสงรุ้งประกายโฮโลแกรมสะท้อนแสง', en: 'Prismatic rainbow hologram gradient' },
    gradient: 'linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899, #f59e0b)',
    stops: ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'],
    hex: '#06b6d4',
    badge: '🌈',
    accent: '#00f0ff',
  },
  {
    id: 'sunset',
    name: { th: 'ซันเซ็ตไซเบอร์', en: 'Cyber Sunset' },
    desc: { th: 'การไล่สีพระอาทิตย์ตกดิน จากชมพูมาเจนต้า ส้ม ไปจนถึงเหลืองทอง', en: 'Vibrant sunset from magenta to orange gold' },
    gradient: 'linear-gradient(135deg, #f43f5e, #f97316, #eab308)',
    stops: ['#f43f5e', '#f97316', '#eab308'],
    hex: '#f43f5e',
    badge: '🌅',
    accent: '#fef08a',
  },
  {
    id: 'aurora',
    name: { th: 'ออโรร่ากาแล็กซี', en: 'Cosmic Aurora' },
    desc: { th: 'แสงเหนือออโรร่ากลางอวกาศ จากม่วงไวโอเล็ต น้ำเงิน สู่ฟ้านีออน', en: 'Space aurora from deep violet to electric cyan' },
    gradient: 'linear-gradient(135deg, #8b5cf6, #3b82f6, #06b6d4)',
    stops: ['#8b5cf6', '#3b82f6', '#06b6d4'],
    hex: '#8b5cf6',
    badge: '🌌',
    accent: '#67e8f9',
  },
  {
    id: 'toxic',
    name: { th: 'ท็อกซิกแมทริกซ์', en: 'Toxic Matrix' },
    desc: { th: 'การไล่สีเขียวมะนาวนีออนตัดกับเขียวมรกตและฟ้าไซเบอร์', en: 'Electric lime to cyber emerald matrix' },
    gradient: 'linear-gradient(135deg, #10b981, #84cc16, #06b6d4)',
    stops: ['#10b981', '#84cc16', '#06b6d4'],
    hex: '#10b981',
    badge: '⚡',
    accent: '#22c55e',
  },
  {
    id: 'magma',
    name: { th: 'แมกม่าเพลิงลาวา', en: 'Magma Flare' },
    desc: { th: 'ความร้อนแรงของหินลาวาหลอมเหลว จากแดงเลือดนก ส้ม สู่เหลืองสว่าง', en: 'Molten volcanic magma fire' },
    gradient: 'linear-gradient(135deg, #b91c1c, #ea580c, #facc15)',
    stops: ['#b91c1c', '#ea580c', '#facc15'],
    hex: '#b91c1c',
    badge: '🔥',
    accent: '#fef08a',
  },
  {
    id: 'sakura_dream',
    name: { th: 'ซากุระดรีม', en: 'Sakura Dream' },
    desc: { th: 'เฉดสีพาสเทลหวานละมุน จากชมพูซากุระ ม่วงลาเวนเดอร์ สู่ฟ้าคราม', en: 'Sweet pastel sakura petals and lavender' },
    gradient: 'linear-gradient(135deg, #f472b6, #c084fc, #38bdf8)',
    stops: ['#f472b6', '#c084fc', '#38bdf8'],
    hex: '#f472b6',
    badge: '🌸',
    accent: '#ffffff',
  },
  {
    id: 'gold_carbon',
    name: { th: 'ทองคำตัดคาร์บอนดำ', en: 'Gold & Carbon' },
    desc: { th: 'ทองคำหรูหราพรีเมียมตัดสลับกับคาร์บอนไฟเบอร์ดำด้าน', en: 'Royal gold luxury paired with sleek carbon' },
    gradient: 'linear-gradient(135deg, #eab308, #ca8a04, #334155, #0f172a)',
    stops: ['#eab308', '#ca8a04', '#334155', '#0f172a'],
    hex: '#eab308',
    badge: '👑',
    accent: '#fef08a',
  },
  {
    id: 'diamond_crystal',
    name: { th: 'คริสตัลไดมอนด์', en: 'Crystal Diamond' },
    desc: { th: 'ประกายเพชรผลึกน้ำแข็ง ไทเทเนียมขาวสะท้อนฟ้าไอซ์บลู', en: 'Sparkling ice diamond crystal reflections' },
    gradient: 'linear-gradient(135deg, #f8fafc, #93c5fd, #38bdf8)',
    stops: ['#f8fafc', '#93c5fd', '#38bdf8'],
    hex: '#e2e8f0',
    badge: '💎',
    accent: '#00f0ff',
  },
  {
    id: 'synthwave',
    name: { th: 'ซินธ์เวฟ 80s', en: 'Retro Synthwave' },
    desc: { th: 'สไตล์ยุค 80s สุดไอคอนิก จากชมพูฟูเชียม่วงนีออน สู่ฟ้านีออนไซเบอร์', en: 'Iconic 80s fuchsia neon to bright cyan' },
    gradient: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)',
    stops: ['#ec4899', '#8b5cf6', '#06b6d4'],
    hex: '#ec4899',
    badge: '🎸',
    accent: '#00f0ff',
  },
  {
    id: 'shadow_blood',
    name: { th: 'ชาโดว์บลัด', en: 'Shadow Blood' },
    desc: { th: 'ดำด้านสเตลธ์ลึกลับ ไล่ระดับเฉดสู่แดงทับทิมนีออนดุดัน', en: 'Stealth obsidian black with crimson ruby bleed' },
    gradient: 'linear-gradient(135deg, #1e293b, #0f172a, #ef4444)',
    stops: ['#1e293b', '#0f172a', '#ef4444'],
    hex: '#1e293b',
    badge: '🩸',
    accent: '#ef4444',
  },
];

export function isGradient(color?: string | null): boolean {
  if (!color) return false;
  return color.includes('gradient') || color.includes(',');
}

export function parseGradientStops(color?: string | null): string[] {
  if (!color) return ['#38bdf8'];
  const preset = SPECIAL_ROBOT_GRADIENTS.find((g) => g.gradient === color || g.id === color);
  if (preset) return preset.stops;

  const hexes = color.match(/#[0-9a-fA-F]{3,8}/g);
  if (hexes && hexes.length > 0) return hexes;

  return [color];
}

export function getPrimaryColorFallback(color?: string | null): string {
  if (!color) return '#38bdf8';
  if (!isGradient(color)) return color;
  const stops = parseGradientStops(color);
  return stops[0] || '#38bdf8';
}

/**
 * Resolves full color/gradient configuration for a robot.
 * Works seamlessly whether stored as a hex in primary_color,
 * a gradient ID in name.gradient, or direct linear-gradient string.
 */
export function resolveRobotColor(
  robotOrColor?: { primary_color?: string | null; name?: unknown } | string | null,
): {
  color: string;
  isGradient: boolean;
  gradientId: string | null;
  stops: string[];
  gradientCss: string | null;
} {
  if (!robotOrColor) {
    return {
      color: '#38bdf8',
      isGradient: false,
      gradientId: null,
      stops: ['#38bdf8'],
      gradientCss: null,
    };
  }

  // If string passed
  if (typeof robotOrColor === 'string') {
    if (isGradient(robotOrColor)) {
      const preset = SPECIAL_ROBOT_GRADIENTS.find((g) => g.gradient === robotOrColor || g.id === robotOrColor);
      const stops = preset ? preset.stops : parseGradientStops(robotOrColor);
      return {
        color: preset ? preset.hex : stops[0] || '#38bdf8',
        isGradient: true,
        gradientId: preset?.id ?? null,
        stops,
        gradientCss: preset ? preset.gradient : robotOrColor,
      };
    }
    const preset = SPECIAL_ROBOT_GRADIENTS.find((g) => g.id === robotOrColor);
    if (preset) {
      return {
        color: preset.hex,
        isGradient: true,
        gradientId: preset.id,
        stops: preset.stops,
        gradientCss: preset.gradient,
      };
    }
    return {
      color: robotOrColor,
      isGradient: false,
      gradientId: null,
      stops: [robotOrColor],
      gradientCss: null,
    };
  }

  // If object passed
  const r = robotOrColor;
  const gradId =
    r.name && typeof r.name === 'object' && 'gradient' in r.name && typeof r.name.gradient === 'string'
      ? r.name.gradient
      : null;

  if (gradId) {
    const preset = SPECIAL_ROBOT_GRADIENTS.find((g) => g.id === gradId);
    if (preset) {
      return {
        color: preset.hex,
        isGradient: true,
        gradientId: preset.id,
        stops: preset.stops,
        gradientCss: preset.gradient,
      };
    }
  }

  const prim = r.primary_color;
  if (prim && isGradient(prim)) {
    const preset = SPECIAL_ROBOT_GRADIENTS.find((g) => g.gradient === prim || g.id === prim);
    const stops = preset ? preset.stops : parseGradientStops(prim);
    return {
      color: preset ? preset.hex : stops[0] || '#38bdf8',
      isGradient: true,
      gradientId: preset?.id ?? null,
      stops,
      gradientCss: preset ? preset.gradient : prim,
    };
  }

  const defaultHex = prim || '#38bdf8';
  return {
    color: defaultHex,
    isGradient: false,
    gradientId: null,
    stops: [defaultHex],
    gradientCss: null,
  };
}

export const RANDOM_ROBOT_NAMES = [
  { en: 'Vortex', th: 'วอร์เท็กซ์' },
  { en: 'Cosmo', th: 'คอสโม' },
  { en: 'Zephyr', th: 'เซเฟอร์' },
  { en: 'Nebula', th: 'เนบิวลา' },
  { en: 'Circuit', th: 'เซอร์กิต' },
  { en: 'Blitz', th: 'บลิตซ์' },
  { en: 'Apex', th: 'เอเปกซ์' },
  { en: 'Pulse', th: 'พัลส์' },
  { en: 'Quantum', th: 'ควอนตัม' },
  { en: 'Aero', th: 'แอโร่' },
  { en: 'Pixel', th: 'พิกเซล' },
  { en: 'Cybertron', th: 'ไซเบอร์ตรอน' },
  { en: 'Helios', th: 'เฮลิออส' },
  { en: 'Polaris', th: 'โพลาริส' },
  { en: 'Eclipse', th: 'เอคลิปส์' },
  { en: 'Titanium', th: 'ไททาเนียม' },
  { en: 'Orion', th: 'โอไรออน' },
  { en: 'Zenith', th: 'ซีนิธ' },
  { en: 'Sparky', th: 'สปาร์คกี้' },
  { en: 'Echo Prime', th: 'เอคโค่ไพรม์' },
  { en: 'Astro X', th: 'แอสโตรเอ็กซ์' },
  { en: 'Shadow Unit', th: 'ยูนิตชาโดว์' },
];

export type RobotColorMetaInput = {
  builtin_style?: string | null;
  primary_color?: string | null;
  name?: { th?: string; en?: string; gradient?: string; [key: string]: unknown } | string | null;
};

/**
 * Generates a truly unique robot that is dissimilar from existing robots:
 * - Selects an unused builtin style (or least used).
 * - Selects an unused multi-color gradient or special color.
 * - Stores gradient in name.gradient while keeping primary_color as a valid 6-hex code
 *   so it strictly adheres to PostgreSQL check constraint: check (primary_color ~ '^#[0-9a-fA-F]{6}$')
 */
export function generateUniqueRandomRobot(existingRobots: RobotColorMetaInput[]) {
  // 1. Determine used styles
  const styleUsageCount: Record<string, number> = {};
  for (const s of BUILTIN_ROBOT_STYLES) {
    styleUsageCount[s.id] = 0;
  }
  for (const r of existingRobots) {
    if (r.builtin_style && r.builtin_style in styleUsageCount) {
      styleUsageCount[r.builtin_style]++;
    }
  }

  // Pick styles with minimum usage count
  const minCount = Math.min(...Object.values(styleUsageCount));
  const candidateStyles = BUILTIN_ROBOT_STYLES.filter((s) => styleUsageCount[s.id] === minCount);
  const chosenStyle = candidateStyles[Math.floor(Math.random() * candidateStyles.length)] ?? BUILTIN_ROBOT_STYLES[0];

  // 2. Determine used colors/gradients
  const existingGradients = new Set(
    existingRobots
      .map((r) =>
        r.name && typeof r.name === 'object' && 'gradient' in r.name
          ? (r.name as Record<string, unknown>).gradient
          : null,
      )
      .filter(Boolean),
  );
  const existingColors = new Set(
    existingRobots.map((r) => r.primary_color?.toLowerCase()).filter(Boolean),
  );

  // Pool of candidate gradients and colors
  const candidateGradients = SPECIAL_ROBOT_GRADIENTS.filter(
    (g) => !existingGradients.has(g.id) && !existingColors.has(g.hex.toLowerCase()),
  );
  const candidateColors = SPECIAL_ROBOT_COLORS.filter(
    (c) => !existingColors.has(c.hex.toLowerCase()),
  );

  let chosenHex: string;
  let gradientId: string | null = null;

  if (candidateGradients.length > 0) {
    const g = candidateGradients[Math.floor(Math.random() * candidateGradients.length)];
    chosenHex = g.hex;
    gradientId = g.id;
  } else if (candidateColors.length > 0) {
    chosenHex = candidateColors[Math.floor(Math.random() * candidateColors.length)].hex;
  } else {
    // If all used, pick any gradient
    const g = SPECIAL_ROBOT_GRADIENTS[Math.floor(Math.random() * SPECIAL_ROBOT_GRADIENTS.length)];
    chosenHex = g.hex;
    gradientId = g.id;
  }

  // 3. Determine unique name
  const existingNames = new Set(
    existingRobots
      .map((r) => {
        if (!r.name) return '';
        if (typeof r.name === 'string') return r.name.toLowerCase();
        return `${r.name.en || ''} ${r.name.th || ''}`.toLowerCase();
      })
      .filter(Boolean),
  );

  const candidateNames = RANDOM_ROBOT_NAMES.filter(
    (n) => !existingNames.has(n.en.toLowerCase()) && !existingNames.has(n.th.toLowerCase()),
  );
  const chosenName =
    candidateNames.length > 0
      ? candidateNames[Math.floor(Math.random() * candidateNames.length)]
      : {
          en: `${chosenStyle.name.en.split(' ')[0]} ${Math.floor(Math.random() * 90 + 10)}`,
          th: `${chosenStyle.name.th.split(' ')[0]} ${Math.floor(Math.random() * 90 + 10)}`,
        };

  // 4. Slightly randomized speed
  const speeds = [400, 420, 450, 480, 500];
  const chosenSpeed = speeds[Math.floor(Math.random() * speeds.length)];

  const nameObj = {
    ...chosenName,
    ...(gradientId ? { gradient: gradientId } : {}),
  };

  if (!/^#[0-9a-fA-F]{6}$/i.test(chosenHex)) {
    chosenHex = '#38bdf8';
  }

  return {
    name: nameObj,
    kind: 'builtin' as const,
    builtin_style: chosenStyle.id,
    sprite_url: null,
    frame_width: null,
    frame_height: null,
    animations: {},
    primary_color: chosenHex, // Guaranteed valid 6-hex code like '#06b6d4'!
    scale: 1,
    move_speed_ms: chosenSpeed,
    is_default: existingRobots.length === 0,
    is_active: true,
  };
}

/**
 * Batch generates N unique robots in one call.
 */
export function generateUniqueRandomRobots(
  count: number,
  existingRobots: RobotColorMetaInput[],
) {
  const robots = [];
  const currentList: RobotColorMetaInput[] = [...existingRobots];
  const totalExisting = existingRobots.length;

  for (let i = 0; i < count; i++) {
    const isFirstOverall = totalExisting === 0 && i === 0;
    const robot = generateUniqueRandomRobot(currentList);
    robot.is_default = isFirstOverall;
    robots.push(robot);
    currentList.push(robot);
  }

  return robots;
}
