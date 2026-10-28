import { resolveThemeUrl } from '../../lib/themeUrl';

export type ShimejiAction =
  | 'idle'         // 活泼常态待机：轻快踏步、双马尾左右摇摆律动、眨眼 (全动态、纯净无框)
  | 'sit'          // 萌坐待机：乖巧坐下、摇晃小手望向主人 (纯净无纸箱)
  | 'walk'         // 漫步小跑
  | 'drag_hang'    // 抓取并在空中静止不动时：自然垂直悬挂
  | 'drag_left'    // 抓取并向左拖拽移动：受惯性往右侧甩起摇摆
  | 'drag_right'   // 抓取并向右拖拽移动：受惯性往左侧甩起摇摆
  | 'drag_dangle'  // 兼容悬挂别名
  | 'land'         // 落地回弹冲击缓冲
  | 'cheer'        // 欢呼跳跃比耶
  | 'sleep'        // 趴着小憩揉眼
  // 兼容别名
  | 'idle_sit'
  | 'idle_stand'
  | 'leek_spin';

export interface AnimationClip {
  frames: string[];
  intervalMs: number;
  loop?: boolean;
}

export const SHIMEJI_CLIPS: Record<ShimejiAction, AnimationClip> = {
  // 活泼常态待机：双马尾左右蓬松摇摆、双脚有节奏轻快踏步，像天选姬一样充满生命力（纯净全透明，无任何背部框线）
  idle: {
    frames: [
      'themes/miku/shimeji/shime1.png',
      'themes/miku/shimeji/shime2.png',
      'themes/miku/shimeji/shime3.png',
      'themes/miku/shimeji/shime2.png',
    ],
    intervalMs: 200,
    loop: true,
  },

  // 萌坐待机：乖巧坐在地面、小手摇摆互动（彻底剔除带纸箱的旧帧，100% 纯净）
  sit: {
    frames: [
      'themes/miku/shimeji/shime11.png',
      'themes/miku/shimeji/shime15.png',
      'themes/miku/shimeji/shime16.png',
      'themes/miku/shimeji/shime15.png',
    ],
    intervalMs: 320,
    loop: true,
  },

  // 原地快乐漫步踏步
  walk: {
    frames: [
      'themes/miku/shimeji/shime1b.png',
      'themes/miku/shimeji/shime2b.png',
      'themes/miku/shimeji/shime3b.png',
      'themes/miku/shimeji/shime2b.png',
    ],
    intervalMs: 180,
    loop: true,
  },

  // 鼠标/手指抓起并静止不动：静止自然垂直悬挂（不再机械左右无序摇摆）
  drag_hang: {
    frames: ['themes/miku/shimeji/shime6.png'],
    intervalMs: 1000,
    loop: true,
  },

  // 抓起向左拖拽移动：身体受惯性往右后方甩起摆动
  drag_left: {
    frames: ['themes/miku/shimeji/shime8.png'],
    intervalMs: 1000,
    loop: true,
  },

  // 抓起向右拖拽移动：身体受惯性往左后方甩起摆动
  drag_right: {
    frames: ['themes/miku/shimeji/shime7.png'],
    intervalMs: 1000,
    loop: true,
  },

  // 兼容别名
  drag_dangle: {
    frames: ['themes/miku/shimeji/shime6.png'],
    intervalMs: 1000,
    loop: true,
  },

  // 落地踩地反弹缓冲
  land: {
    frames: [
      'themes/miku/shimeji/shime19.png',
      'themes/miku/shimeji/shime1.png',
    ],
    intervalMs: 130,
    loop: false,
  },

  // 戳一戳 / 欢呼跳跃狂喜比耶
  cheer: {
    frames: [
      'themes/miku/shimeji/shime26.png',
      'themes/miku/shimeji/shime27.png',
      'themes/miku/shimeji/shime28.png',
      'themes/miku/shimeji/shime29.png',
      'themes/miku/shimeji/shime28.png',
      'themes/miku/shimeji/shime27.png',
    ],
    intervalMs: 120,
    loop: false,
  },

  // 趴在边缘打瞌睡揉眼睛
  sleep: {
    frames: [
      'themes/miku/shimeji/shime42.png',
      'themes/miku/shimeji/shime43.png',
      'themes/miku/shimeji/shime44.png',
      'themes/miku/shimeji/shime45.png',
      'themes/miku/shimeji/shime46.png',
    ],
    intervalMs: 400,
    loop: true,
  },

  // 别名映射保持向后兼容
  idle_sit: {
    frames: [
      'themes/miku/shimeji/shime1.png',
      'themes/miku/shimeji/shime2.png',
      'themes/miku/shimeji/shime3.png',
      'themes/miku/shimeji/shime2.png',
    ],
    intervalMs: 200,
    loop: true,
  },

  idle_stand: {
    frames: [
      'themes/miku/shimeji/shime1.png',
      'themes/miku/shimeji/shime2.png',
    ],
    intervalMs: 260,
    loop: true,
  },

  leek_spin: {
    frames: [
      'themes/miku/shimeji/shime26.png',
      'themes/miku/shimeji/shime27.png',
      'themes/miku/shimeji/shime28.png',
      'themes/miku/shimeji/shime29.png',
      'themes/miku/shimeji/shime28.png',
    ],
    intervalMs: 130,
    loop: true,
  },
};

/** 解析动作帧的真实资源路径 */
export function getFrameUrl(relPath: string): string {
  return resolveThemeUrl(relPath);
}
