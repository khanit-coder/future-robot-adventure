import type { Command, Lang } from '@engine';

export type CodeLanguageId = 'python' | 'javascript' | 'cpp' | 'java';

export interface GeneratedCodeSample {
  id: CodeLanguageId;
  name: string;
  badge: string;
  description: { th: string; en: string };
  code: string;
}

function indent(level: number, spaces = 4): string {
  return ' '.repeat(level * spaces);
}

function toPythonLines(cmds: Command[], depth: number, lang: Lang): string[] {
  const lines: string[] = [];
  const pad = indent(depth, 4);
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    switch (c.type) {
      case 'MOVE_FORWARD':
        lines.push(`${pad}robot.move_forward(${c.steps ?? 1})`);
        break;
      case 'MOVE_BACKWARD':
        lines.push(`${pad}robot.move_backward(${c.steps ?? 1})`);
        break;
      case 'TURN_LEFT':
        lines.push(`${pad}robot.turn_left()`);
        break;
      case 'TURN_RIGHT':
        lines.push(`${pad}robot.turn_right()`);
        break;
      case 'JUMP':
        lines.push(`${pad}robot.jump()`);
        break;
      case 'WAVE':
        lines.push(`${pad}robot.wave()`);
        break;
      case 'PICK_UP':
        lines.push(`${pad}robot.pick_up()`);
        break;
      case 'ACTIVATE':
        lines.push(`${pad}robot.activate()`);
        break;
      case 'CELEBRATE':
        lines.push(`${pad}robot.celebrate()`);
        break;
      case 'WAIT':
        lines.push(`${pad}robot.wait(${c.seconds ?? 1})`);
        break;
      case 'REPEAT': {
        const varName = depth === 0 ? 'i' : depth === 1 ? 'j' : `k${depth}`;
        lines.push(`${pad}for ${varName} in range(${c.times ?? 2}):`);
        const body = c.body && c.body.length > 0 ? toPythonLines(c.body, depth + 1, lang) : [`${indent(depth + 1, 4)}pass`];
        lines.push(...body);
        break;
      }
    }
  }
  if (lines.length === 0) {
    lines.push(`${pad}# ${lang === 'th' ? 'ยังไม่มีคำสั่ง' : 'No commands'}`);
  }
  return lines;
}

function toJavaScriptLines(cmds: Command[], depth: number): string[] {
  const lines: string[] = [];
  const pad = indent(depth, 2);
  for (const c of cmds) {
    switch (c.type) {
      case 'MOVE_FORWARD':
        lines.push(`${pad}await robot.moveForward(${c.steps ?? 1});`);
        break;
      case 'MOVE_BACKWARD':
        lines.push(`${pad}await robot.moveBackward(${c.steps ?? 1});`);
        break;
      case 'TURN_LEFT':
        lines.push(`${pad}await robot.turnLeft();`);
        break;
      case 'TURN_RIGHT':
        lines.push(`${pad}await robot.turnRight();`);
        break;
      case 'JUMP':
        lines.push(`${pad}await robot.jump();`);
        break;
      case 'WAVE':
        lines.push(`${pad}await robot.wave();`);
        break;
      case 'PICK_UP':
        lines.push(`${pad}await robot.pickUp();`);
        break;
      case 'ACTIVATE':
        lines.push(`${pad}await robot.activate();`);
        break;
      case 'CELEBRATE':
        lines.push(`${pad}await robot.celebrate();`);
        break;
      case 'WAIT':
        lines.push(`${pad}await robot.wait(${c.seconds ?? 1});`);
        break;
      case 'REPEAT': {
        const varName = depth <= 1 ? 'i' : depth === 2 ? 'j' : `k${depth}`;
        lines.push(`${pad}for (let ${varName} = 0; ${varName} < ${c.times ?? 2}; ${varName}++) {`);
        if (c.body && c.body.length > 0) {
          lines.push(...toJavaScriptLines(c.body, depth + 1));
        }
        lines.push(`${pad}}`);
        break;
      }
    }
  }
  return lines;
}

function toCppLines(cmds: Command[], depth: number): string[] {
  const lines: string[] = [];
  const pad = indent(depth, 2);
  for (const c of cmds) {
    switch (c.type) {
      case 'MOVE_FORWARD':
        lines.push(`${pad}robot.moveForward(${c.steps ?? 1});`);
        break;
      case 'MOVE_BACKWARD':
        lines.push(`${pad}robot.moveBackward(${c.steps ?? 1});`);
        break;
      case 'TURN_LEFT':
        lines.push(`${pad}robot.turnLeft();`);
        break;
      case 'TURN_RIGHT':
        lines.push(`${pad}robot.turnRight();`);
        break;
      case 'JUMP':
        lines.push(`${pad}robot.jump();`);
        break;
      case 'WAVE':
        lines.push(`${pad}robot.wave();`);
        break;
      case 'PICK_UP':
        lines.push(`${pad}robot.pickUp();`);
        break;
      case 'ACTIVATE':
        lines.push(`${pad}robot.activate();`);
        break;
      case 'CELEBRATE':
        lines.push(`${pad}robot.celebrate();`);
        break;
      case 'WAIT':
        lines.push(`${pad}delay(${(c.seconds ?? 1) * 1000});`);
        break;
      case 'REPEAT': {
        const varName = depth <= 1 ? 'i' : depth === 2 ? 'j' : `k${depth}`;
        lines.push(`${pad}for (int ${varName} = 0; ${varName} < ${c.times ?? 2}; ${varName}++) {`);
        if (c.body && c.body.length > 0) {
          lines.push(...toCppLines(c.body, depth + 1));
        }
        lines.push(`${pad}}`);
        break;
      }
    }
  }
  return lines;
}

function toJavaLines(cmds: Command[], depth: number): string[] {
  const lines: string[] = [];
  const pad = indent(depth, 4);
  for (const c of cmds) {
    switch (c.type) {
      case 'MOVE_FORWARD':
        lines.push(`${pad}robot.moveForward(${c.steps ?? 1});`);
        break;
      case 'MOVE_BACKWARD':
        lines.push(`${pad}robot.moveBackward(${c.steps ?? 1});`);
        break;
      case 'TURN_LEFT':
        lines.push(`${pad}robot.turnLeft();`);
        break;
      case 'TURN_RIGHT':
        lines.push(`${pad}robot.turnRight();`);
        break;
      case 'JUMP':
        lines.push(`${pad}robot.jump();`);
        break;
      case 'WAVE':
        lines.push(`${pad}robot.wave();`);
        break;
      case 'PICK_UP':
        lines.push(`${pad}robot.pickUp();`);
        break;
      case 'ACTIVATE':
        lines.push(`${pad}robot.activate();`);
        break;
      case 'CELEBRATE':
        lines.push(`${pad}robot.celebrate();`);
        break;
      case 'WAIT':
        lines.push(`${pad}robot.waitSeconds(${c.seconds ?? 1});`);
        break;
      case 'REPEAT': {
        const varName = depth <= 2 ? 'i' : depth === 3 ? 'j' : `k${depth}`;
        lines.push(`${pad}for (int ${varName} = 0; ${varName} < ${c.times ?? 2}; ${varName}++) {`);
        if (c.body && c.body.length > 0) {
          lines.push(...toJavaLines(c.body, depth + 1));
        }
        lines.push(`${pad}}`);
        break;
      }
    }
  }
  return lines;
}

export function generateRealCodeSamples(
  commands: Command[],
  levelCode: string,
  lang: Lang,
): GeneratedCodeSample[] {
  const headerCommentTh = `โปรแกรมสั่งการหุ่นยนต์ — ด่าน ${levelCode}`;
  const headerCommentEn = `Robot Control Program — Mission ${levelCode}`;
  const comment = lang === 'th' ? headerCommentTh : headerCommentEn;

  const pyCode = [
    `# ${comment}`,
    `from future_robot import Robot`,
    ``,
    `robot = Robot()`,
    ...toPythonLines(commands, 0, lang),
  ].join('\n');

  const jsCode = [
    `// ${comment}`,
    `async function runMission(robot) {`,
    ...toJavaScriptLines(commands, 1),
    `}`,
    ``,
    `runMission(robot);`,
  ].join('\n');

  const cppCode = [
    `// ${comment}`,
    `#include <RobotController.h>`,
    ``,
    `RobotController robot;`,
    ``,
    `void setup() {`,
    `  robot.begin();`,
    ...toCppLines(commands, 1),
    `}`,
    ``,
    `void loop() {}`,
  ].join('\n');

  const javaCode = [
    `// ${comment}`,
    `public class RobotMission {`,
    `    public static void main(String[] args) {`,
    `        Robot robot = new Robot();`,
    ...toJavaLines(commands, 2),
    `    }`,
    `}`,
  ].join('\n');

  return [
    {
      id: 'python',
      name: 'Python',
      badge: '🐍 Python',
      description: {
        th: 'ภาษาที่อ่านเข้าใจง่าย นิยมใช้ในงาน AI, Data Science และการเขียนโปรแกรมหุ่นยนต์ยุคใหม่',
        en: 'Clean and readable syntax, widely used in AI, Data Science, and modern robotics.',
      },
      code: pyCode,
    },
    {
      id: 'javascript',
      name: 'JavaScript',
      badge: '⚡ JavaScript',
      description: {
        th: 'ภาษาหลักสำหรับสร้างเว็บไซต์ แอปพลิเคชัน และควบคุมหุ่นยนต์ผ่านระบบออนไลน์',
        en: 'The language of the web, interactive apps, and async IoT robot control.',
      },
      code: jsCode,
    },
    {
      id: 'cpp',
      name: 'C / C++ (Arduino)',
      badge: '🤖 C++ (Arduino)',
      description: {
        th: 'ภาษาที่ใช้เขียนลงบอร์ดสมองกลฝังตัว (Arduino / ESP32) เพื่อสั่งมอเตอร์และเซนเซอร์หุ่นยนต์จริง',
        en: 'Used to program real microcontrollers (Arduino / ESP32) that drive motors and sensors.',
      },
      code: cppCode,
    },
    {
      id: 'java',
      name: 'Java',
      badge: '☕ Java',
      description: {
        th: 'ภาษาเชิงวัตถุ (OOP) ยอดนิยมในการพัฒนาซอฟต์แวร์องค์กร แอป Android และการแข่งขันหุ่นยนต์ระดับโลก',
        en: 'Object-oriented language used in enterprise systems, Android apps, and robotics competitions.',
      },
      code: javaCode,
    },
  ];
}
