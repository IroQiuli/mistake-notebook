import { resolveThemeUrl } from '../../lib/themeUrl';

export type ShimejiAction =
  | 'idle_sit'     // 坐在边缘晃腿
  | 'idle_stand'   // 站立待机
  | 'leek_spin'    // 经典甩葱
  | 'drag_dangle'  // 提在半空中扑腾蹬腿
  | 'land'         // 落地缓冲
  | 'cheer'        // 欢呼比耶
  | 'sleep';       // 趴着小憩

export interface AnimationClip {
  frames: string[];
  intervalMs: number;
  loop?: boolean;
}

export const SHIMEJI_CLIPS: Record<ShimejiAction, AnimationClip> = {
  // 坐在屏幕边缘规律晃荡小腿（待机常态，极可爱）
  idle_sit: {
    frames: [
      'themes/miku/shimeji/shime20.png',
      'themes/miku/shimeji/shime21.png',
      'themes/miku/shimeji/shime20.png',
      'themes/miku/shimeji/shime21.png',
    ],
    intervalMs: 400,
    loop: true,
  },

  // 站立待机
  idle_stand: {
    frames: [
      'themes/miku/shimeji/shime1.png',
    ],
    intervalMs: 800,
    loop: true,
  },

  // 经典连贯甩葱舞
  leek_spin: {
    frames: [
      'themes/miku/shimeji/shime31.png',
      'themes/miku/shimeji/shime32.png',
      'themes/miku/shimeji/shime31.png',
      'themes/miku/shimeji/shime33.png',
    ],
    intervalMs: 160,
    loop: true,
  },

  // 鼠标/手指抓起提在半空中蹬腿挣扎扑腾（天选姬灵魂招牌动作）
  drag_dangle: {
    frames: [
      'themes/miku/shimeji/shime5.png',
      'themes/miku/shimeji/shime6.png',
      'themes/miku/shimeji/shime7.png',
      'themes/miku/shimeji/shime6.png',
    ],
    intervalMs: 130,
    loop: true,
  },

  // 落地踩地反弹缓冲
  land: {
    frames: [
      'themes/miku/shimeji/shime18.png',
      'themes/miku/shimeji/shime19.png',
      'themes/miku/shimeji/shime1.png',
    ],
    intervalMs: 140,
    loop: false,
  },

  // 戳一戳 / 欢呼跳跃
  cheer: {
    frames: [
      'themes/miku/shimeji/shime26.png',
      'themes/miku/shimeji/shime27.png',
      'themes/miku/shimeji/shime28.png',
      'themes/miku/shimeji/shime29.png',
    ],
    intervalMs: 150,
    loop: false,
  },

  // 趴在边缘打瞌睡揉眼睛
  sleep: {
    frames: [
      'themes/miku/shimeji/shime42.png',
      'themes/miku/shimeji/shime43.png',
      'themes/miku/shimeji/shime44.png',
      'themes/miku/shimeji/shime45.png',
    ],
    intervalMs: 500,
    loop: true,
  },
};

/** 解析动作帧的真实资源路径 */
export function getFrameUrl(relPath: string): string {
  return resolveThemeUrl(relPath);
}
