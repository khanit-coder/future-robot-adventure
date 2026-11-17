import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  Info,
  Pause,
  Play,
  Sparkles,
  Terminal,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { Progress, Select } from '@/components/ui/progress';
import { toast } from '@/stores/toastStore';
import { adminApi, type AdminPlayerJoined } from '@/services/api/adminApi';
import type { AdminWorkspaceData } from '@/features/admin/adminTypes';

interface StudentSimulatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
  existingPlayers?: AdminPlayerJoined[];
}

interface LogEntry {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'step';
  text: string;
}

const THAI_FIRST_NAMES = [
  'ธนภัทร', 'กัญญาณัฐ', 'ชนกันต์', 'วรินทร', 'ภัทรพล', 'ภัทรภร', 'ณภัทร', 'รินรดา',
  'จิรภัทร', 'ปพิชญา', 'ศุภกิตติ์', 'พิชชาภา', 'วชิรวิชญ์', 'ฐิติรัตน์', 'ภูริช', 'ปัณฑิตา',
  'รัชชานนท์', 'มินตรา', 'ฐาปกรณ์', 'กัญญาวีร์', 'อัครเดช', 'ชุติมา', 'กิตติศักดิ์', 'พรนภัส',
  'พงศกร', 'นภัสสร', 'ปุณณภพ', 'สุพิชชา', 'ธนดล', 'ชญานิศ', 'ก้องภพ', 'พิมพ์มาดา',
  'ชลธร', 'อารียา', 'ภาณุวิชญ์', 'ธัญชนก', 'กิตติธัช', 'นันทิกานต์', 'เตชินท์', 'รวิสรา',
];

const THAI_NICKNAMES = [
  'กัปตัน', 'พิม', 'โอ๊ค', 'แพรวา', 'นิว', 'ใบหม่อน', 'ตินติน', 'มิลค์',
  'ก้อง', 'ครีม', 'พีช', 'เนย', 'ไบรท์', 'พลอย', 'มาร์ค', 'เกรซ',
  'อาร์ม', 'มิน', 'เตเต้', 'ไอซ์', 'ฟลุ๊ค', 'พั้นช์', 'กาย', 'โมบาย',
  'เจมส์', 'ฟ้าใส', 'บอส', 'มิ้นท์', 'อั่งเปา', 'แพรว', 'คอปเตอร์', 'พราว',
];

const SCHOOLS = [
  'โรงเรียนขอนแก่นวิทยายน',
  'โรงเรียนกัลยาณวัตร',
  'โรงเรียนแก่นนครวิทยาลัย',
  'โรงเรียนสาธิตมหาวิทยาลัยขอนแก่น (มอดินแดง)',
  'โรงเรียนสาธิตมหาวิทยาลัยขอนแก่น (ศึกษาศาสตร์)',
  'โรงเรียนศรีกระนวนวิทยาคม',
  'โรงเรียนน้ำพองศึกษา',
  'โรงเรียนชุมแพศึกษา',
  'โรงเรียนบ้านไผ่',
  'โรงเรียนเมืองพลพิทยาคม',
  'วิทยาลัยเทคโนโลยีขอนแก่น P-TECH',
  'โรงเรียนมัญจาคริสเตียน',
  'โรงเรียนพล',
  'โรงเรียนอุบลรัตน์พิทยาคม',
  'โรงเรียนหนองเรือวิทยา',
];

const GRADES = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6', 'ปวช.1', 'ปวช.2'];

export function StudentSimulatorModal({
  open,
  onOpenChange,
  data,
  onReload,
  existingPlayers = [],
}: StudentSimulatorModalProps) {
  const [studentCount, setStudentCount] = useState<number>(10);
  const [concurrency, setConcurrency] = useState<number>(5);
  const [scenario, setScenario] = useState<'mix' | 'all_pass' | 'register_only'>('mix');
  const [schoolChoice, setSchoolChoice] = useState<string>('random');

  // Simulation execution state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [throughput, setThroughput] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);

  const abortControllerRef = useRef<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const latenciesRef = useRef<number[]>([]);

  // Count existing simulated bots
  const simulatedPlayers = existingPlayers.filter(
    (p) => p.player.display_name.startsWith('[SIM]') || p.player.display_name.includes('[SIM]'),
  );

  const appendLog = useCallback((type: LogEntry['type'], text: string) => {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    setLogs((prev) => [...prev.slice(-300), { id: crypto.randomUUID(), time, type, text }]);
  }, []);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const activeSession = data.sessions.find((s) => s.status === 'ACTIVE') ?? data.sessions[0];

  const handleStartSimulation = async () => {
    if (!activeSession) {
      toast('error', 'ไม่พบรอบกิจกรรมที่เปิดใช้งาน (No Active Session)');
      return;
    }

    setIsRunning(true);
    abortControllerRef.current = false;
    setProgress(0);
    setSuccessCount(0);
    setErrorCount(0);
    setAvgLatency(0);
    setThroughput(0);
    setLogs([]);
    latenciesRef.current = [];

    const total = Math.max(1, Math.min(100, studentCount));
    const batchSize = Math.max(1, Math.min(20, concurrency));
    const startTime = performance.now();

    appendLog('info', `🚀 เริ่มต้นจำลองนักเรียน ${total} คน (ยิงพร้อมกันรอบละ ${batchSize} คน)...`);
    appendLog('info', `📌 รอบกิจกรรม: "${activeSession.name}" (${activeSession.status})`);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Generate pool of student profiles
    const students = Array.from({ length: total }, (_, i) => {
      const first = THAI_FIRST_NAMES[Math.floor(Math.random() * THAI_FIRST_NAMES.length)];
      const nick = THAI_NICKNAMES[Math.floor(Math.random() * THAI_NICKNAMES.length)];
      const school =
        schoolChoice === 'random'
          ? SCHOOLS[Math.floor(Math.random() * SCHOOLS.length)]
          : schoolChoice;
      const grade = GRADES[Math.floor(Math.random() * GRADES.length)];
      return {
        index: i + 1,
        name: `[SIM] ${first} (${nick})`,
        school,
        grade,
      };
    });

    let completedTotal = 0;
    let localSuccess = 0;
    let localError = 0;

    // Run in concurrency chunks
    for (let i = 0; i < students.length; i += batchSize) {
      if (abortControllerRef.current) {
        appendLog('warn', '⏹️ ผู้ดูแลระบบสั่งหยุดการจำลอง (Simulation stopped by admin)');
        break;
      }

      const chunk = students.slice(i, i + batchSize);

      await Promise.all(
        chunk.map(async (st) => {
          if (abortControllerRef.current) return;
          const t0 = performance.now();

          try {
            // 1. Create independent client instance for this virtual student
            const studentClient = createClient(supabaseUrl, anonKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            });

            // 2. Anonymous sign-in
            const { data: authData, error: authErr } = await studentClient.auth.signInAnonymously();
            if (authErr || !authData.session?.access_token) {
              throw new Error(`Auth failed: ${authErr?.message || 'No token'}`);
            }
            const token = authData.session.access_token;

            // 3. Register Player
            const regRes = await fetch(`${supabaseUrl}/functions/v1/register-player`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: anonKey,
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                display_name: st.name,
                school: st.school,
                grade: st.grade,
                lang: 'th',
              }),
            });

            const regJson = await regRes.json();
            if (!regRes.ok || !regJson.player) {
              throw new Error(regJson.message || `HTTP ${regRes.status}`);
            }

            const latency = Math.round(performance.now() - t0);
            latenciesRef.current.push(latency);

            appendLog(
              'success',
              `👤 [คนทึ่ ${st.index}] ${st.name} (${st.school} ${st.grade}) ลงทะเบียนสำเร็จ (${latency}ms)`,
            );

            // 4. Start Game (if scenario is not register_only)
            if (scenario !== 'register_only') {
              const startRes = await fetch(`${supabaseUrl}/functions/v1/player-action`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  apikey: anonKey,
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ action: 'start_game', skip: true }),
              });
              if (!startRes.ok) {
                appendLog('warn', `⚠️ [คนทึ่ ${st.index}] เข้าสู่เกมไม่สำเร็จ (${startRes.status})`);
              } else {
                // Determine simulated progress based on scenario
                let levelsPassed = 1;
                let simulatedScore = 500;

                if (scenario === 'all_pass') {
                  levelsPassed = 5;
                  simulatedScore = Math.floor(Math.random() * 800 + 2400); // 2400 - 3200
                } else if (scenario === 'mix') {
                  // Distribution: 25% pass 1, 35% pass 2-3, 40% pass 4-5
                  const r = Math.random();
                  if (r < 0.25) {
                    levelsPassed = 1;
                    simulatedScore = Math.floor(Math.random() * 200 + 400);
                  } else if (r < 0.6) {
                    levelsPassed = Math.floor(Math.random() * 2 + 2); // 2 or 3
                    simulatedScore = Math.floor(Math.random() * 600 + 1000);
                  } else {
                    levelsPassed = Math.floor(Math.random() * 2 + 4); // 4 or 5
                    simulatedScore = Math.floor(Math.random() * 800 + 2200);
                  }
                }

                // Adjust score via adminApi to populate Leaderboard and Dashboard
                if (regJson.player_session?.id && simulatedScore > 0) {
                  await adminApi
                    .adjustScore(
                      regJson.player_session.id,
                      simulatedScore,
                      `จำลองการผ่าน ${levelsPassed} ด่าน (Stress test bot)`,
                    )
                    .catch(() => {});
                }

                appendLog(
                  'step',
                  `🎮 [คนทึ่ ${st.index}] เล่นผ่าน ${levelsPassed} ด่าน ได้คะแนนสะสม ${simulatedScore.toLocaleString()} แต้ม 🌟`,
                );
              }
            }

            localSuccess++;
            setSuccessCount(localSuccess);
          } catch (err: unknown) {
            localError++;
            setErrorCount(localError);
            const msg = err instanceof Error ? err.message : String(err);
            appendLog('error', `❌ [คนทึ่ ${st.index}] ${st.name} เกิดข้อผิดพลาด: ${msg}`);
            if (msg.toLowerCase().includes('rate limit')) {
              appendLog(
                'warn',
                `💡 แจ้งเตือน: ติดขีดจำกัด Supabase Auth (30 คน/ชม./IP) กรุณาเข้าไปปรับ Rate Limit ใน Supabase Dashboard > Authentication > Rate Limits เป็น 500-1000 คน`,
              );
            }
          } finally {
            completedTotal++;
            const pct = Math.round((completedTotal / total) * 100);
            setProgress(pct);

            const elapsedSec = (performance.now() - startTime) / 1000;
            if (elapsedSec > 0) {
              setThroughput(Number((completedTotal / elapsedSec).toFixed(1)));
            }
            if (latenciesRef.current.length > 0) {
              const avg = Math.round(
                latenciesRef.current.reduce((a, b) => a + b, 0) / latenciesRef.current.length,
              );
              setAvgLatency(avg);
            }
          }
        }),
      );

      // Brief pause between concurrency chunks (80ms) for socket reuse
      await new Promise((r) => setTimeout(r, 80));
    }

    const totalElapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    appendLog(
      'info',
      `🏁 การจำลองเสร็จสิ้น! สำเร็จ ${localSuccess}/${total} คน (ใช้เวลารวม ${totalElapsed} วินาที)`,
    );

    setIsRunning(false);
    await onReload();
    toast('success', `จำลองนักเรียนสำเร็จ ${localSuccess} คน (ใช้เวลา ${totalElapsed}s)`);
  };

  const handleStop = () => {
    abortControllerRef.current = true;
    appendLog('warn', '🛑 ได้รับคำสั่งยกเลิก กำลังหยุดการทำงาน...');
  };

  const handleClearSimulated = async () => {
    if (simulatedPlayers.length === 0) {
      toast('info', 'ไม่มีข้อมูลนักเรียนจำลองในระบบ');
      return;
    }
    if (
      !window.confirm(
        `คุณต้องการลบข้อมูลนักเรียนจำลองทั้งหมด (${simulatedPlayers.length} คน) หรือไม่?\n(ข้อมูลนักเรียนจริงจะไม่ได้รับผลกระทบ)`,
      )
    ) {
      return;
    }

    try {
      appendLog('info', `🧹 กำลังลบข้อมูลนักเรียนจำลอง ${simulatedPlayers.length} คน...`);
      // Delete in parallel batches of 10
      for (let i = 0; i < simulatedPlayers.length; i += 10) {
        const batch = simulatedPlayers.slice(i, i + 10);
        await Promise.all(batch.map((p) => adminApi.deletePlayer(p.player.id)));
      }
      appendLog('success', `✨ ลบข้อมูลนักเรียนจำลอง ${simulatedPlayers.length} คนเรียบร้อยแล้ว`);
      await onReload();
      toast('success', `ล้างข้อมูลนักเรียนจำลอง ${simulatedPlayers.length} คนเรียบร้อยแล้ว`);
    } catch (e) {
      toast('error', 'เกิดข้อผิดพลาดในการลบข้อมูลจำลอง', e instanceof Error ? e.message : undefined);
    }
  };

  const handleCopyLog = () => {
    const text = logs.map((l) => `[${l.time}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(text);
    toast('success', 'คัดลอกข้อความ Log เรียบร้อยแล้ว');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                <Flame className="h-5 w-5" />
              </span>
              ระบบทดสอบจำลองนักเรียนใช้งานพร้อมกัน (Concurrent Stress Test)
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="border-indigo-400 bg-indigo-50 text-indigo-700 font-bold dark:bg-indigo-950/40">
                <Users className="h-3 w-3 mr-1" /> บอทจำลองในระบบ: {simulatedPlayers.length} คน
              </Badge>
              <a
                href="/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                title="เปิดดูหน้าจอแดชบอร์ด 100 คนในแท็บใหม่"
              >
                <ExternalLink className="h-3 w-3" /> เปิดแดชบอร์ด
              </a>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            จำลองการสมัครและเข้าเล่นพร้อมกันของนักเรียนเพื่อทดสอบการรับโหลดของเซิร์ฟเวอร์, ความเร็ว Latency,
            และการแสดงผลบนแดชบอร์ดจอใหญ่ 100 คนแบบ Realtime
          </p>
        </DialogHeader>

        {/* Supabase Rate Limit Notice Banner */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2.5">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-bold">
              💡 ข้อควรรู้สำหรับงาน Open House (Wi-Fi ร่วมกัน):
            </p>
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              Supabase Auth มีระบบ Rate Limit ค่าเริ่มต้นที่ <strong>30 คน/ชั่วโมง/IP</strong> หากนักเรียนในงานเชื่อมต่อ Wi-Fi เดียวกัน หรือจำลองเกิน 30 คนจะติดข้อจำกัดนี้ แนะนำให้เข้าไปที่ <strong>Supabase Dashboard &gt; Authentication &gt; Rate Limits &gt; Anonymous Sign-ins</strong> แล้วปรับเป็น <strong>500–1000 คน/ชั่วโมง</strong> เพื่อรองรับนักเรียนทุกคนในวันงานจริง
            </p>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="space-y-5 py-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            {/* 1. Student Count */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                จำนวนนักเรียน (คน)
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={studentCount}
                onChange={(e) => setStudentCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                disabled={isRunning}
                className="font-bold text-indigo-600 dark:text-indigo-400"
              />
              <div className="flex flex-wrap gap-1">
                {[5, 10, 20, 50, 100].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStudentCount(n)}
                    disabled={isRunning}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
                      studentCount === n
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Concurrency Level */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                ความพร้อมกัน (Concurrency)
              </Label>
              <Select
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                disabled={isRunning}
              >
                <option value={2}>2 คนพร้อมกัน (เบา)</option>
                <option value={5}>5 คนพร้อมกัน (มาตรฐาน)</option>
                <option value={10}>10 คนพร้อมกัน (โหลดหนัก)</option>
                <option value={20}>20 คนพร้อมกัน (สเตรสเทสต์สูงสุด)</option>
              </Select>
              <p className="text-[10px] text-slate-400">ยิง Request แบบ Parallel เป็นชุด</p>
            </div>

            {/* 3. Scenario */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                รูปแบบการจำลอง (Scenario)
              </Label>
              <Select
                value={scenario}
                onChange={(e) =>
                  setScenario(e.target.value as 'mix' | 'all_pass' | 'register_only')
                }
                disabled={isRunning}
              >
                <option value="mix">🌟 สมจริง (ผ่าน 1-5 ด่าน สลับกัน)</option>
                <option value="all_pass">🏆 ตัวท็อป (ผ่านครบ 5 ด่านทุกคน)</option>
                <option value="register_only">📝 สมัครอย่างเดียว (ทดสอบเปิดห้อง)</option>
              </Select>
              <p className="text-[10px] text-slate-400">กำหนดระดับความเก่งและการเก็บแต้ม</p>
            </div>

            {/* 4. School Pool */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                โรงเรียน / สังกัด
              </Label>
              <Select
                value={schoolChoice}
                onChange={(e) => setSchoolChoice(e.target.value)}
                disabled={isRunning}
              >
                <option value="random">🎲 สุ่มจาก 15 โรงเรียนในขอนแก่น</option>
                <option value="โรงเรียนขอนแก่นวิทยายน">ขอนแก่นวิทยายน</option>
                <option value="โรงเรียนกัลยาณวัตร">กัลยาณวัตร</option>
                <option value="โรงเรียนสาธิตมหาวิทยาลัยขอนแก่น (มอดินแดง)">สาธิต มข. (มอดินแดง)</option>
                <option value="วิทยาลัยเทคโนโลยีขอนแก่น P-TECH">วิทยาลัยเทคโนโลยีขอนแก่น P-TECH</option>
              </Select>
              <p className="text-[10px] text-slate-400">ชื่อโรงเรียนสำหรับขึ้นบอร์ด</p>
            </div>
          </div>

          {/* Real-time Metrics Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>ความคืบหน้า</span>
                <Users className="h-4 w-4 text-indigo-500" />
              </div>
              <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">
                {successCount + errorCount} / {studentCount}
              </p>
              <div className="mt-2">
                <Progress value={progress} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Throughput</span>
                <Zap className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">
                {throughput} <span className="text-xs font-normal text-slate-500">คน/วิ</span>
              </p>
              <p className="mt-2 text-[10px] text-slate-400">อัตราการประมวลผลเซิร์ฟเวอร์</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>ความเร็วตอบสนอง</span>
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">
                {avgLatency} <span className="text-xs font-normal text-slate-500">ms</span>
              </p>
              <p className="mt-2 text-[10px] text-slate-400">Latency เฉลี่ยต่อคน</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>สถานะสำเร็จ</span>
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {successCount}{' '}
                {errorCount > 0 && <span className="text-xs font-bold text-red-500">({errorCount} ผิดพลาด)</span>}
              </p>
              <p className="mt-2 text-[10px] text-slate-400">
                {successCount + errorCount > 0
                  ? `อัตราสำเร็จ ${Math.round((successCount / (successCount + errorCount)) * 100)}%`
                  : 'พร้อมเริ่มต้น'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {!isRunning ? (
                <Button
                  onClick={() => void handleStartSimulation()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md"
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  เริ่มทดสอบจำลอง ({studentCount} คน)
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={handleStop}
                  className="font-bold text-sm animate-pulse shadow-md"
                >
                  <Pause className="h-4 w-4 mr-1.5" />
                  หยุดการจำลอง (Stop)
                </Button>
              )}

              {simulatedPlayers.length > 0 && !isRunning && (
                <Button
                  variant="outline"
                  onClick={() => void handleClearSimulated()}
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold text-xs dark:border-red-900/50 dark:hover:bg-red-950/40"
                  title="ลบเฉพาะนักเรียนที่มีแท็ก [SIM] โดยไม่แตะต้องนักเรียนจริง"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  ล้างข้อมูลจำลองทั้งหมด ({simulatedPlayers.length} คน)
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                เลื่อนจออัตโนมัติ
              </label>
              {logs.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleCopyLog} className="text-xs h-7">
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  คัดลอก Log
                </Button>
              )}
            </div>
          </div>

          {/* Live Activity Feed / Terminal */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-inner font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-slate-300">Live Simulation Terminal</span>
                {isRunning && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">{logs.length} บรรทัด</span>
            </div>

            <div
              ref={logContainerRef}
              className="h-64 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin scrollbar-thumb-slate-800"
            >
              {logs.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-slate-500 text-center space-y-2">
                  <Sparkles className="h-6 w-6 text-indigo-400 opacity-60" />
                  <p>กดปุ่ม &quot;เริ่มทดสอบจำลอง&quot; เพื่อจำลองการเชื่อมต่อของนักเรียนแบบเรียลไทม์</p>
                  <p className="text-[11px] text-slate-600">
                    ข้อมูลจะถูกส่งเข้า Supabase จริง และอัปเดตขึ้นหน้าจอแดชบอร์ด 100 คนทันที
                  </p>
                </div>
              ) : (
                logs.map((l) => (
                  <div key={l.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="shrink-0 text-slate-500 select-none">[{l.time}]</span>
                    <span
                      className={`break-all ${
                        l.type === 'success'
                          ? 'text-emerald-400'
                          : l.type === 'error'
                            ? 'text-rose-400 font-bold'
                            : l.type === 'warn'
                              ? 'text-amber-400'
                              : l.type === 'step'
                                ? 'text-cyan-300'
                                : 'text-slate-300'
                      }`}
                    >
                      {l.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
