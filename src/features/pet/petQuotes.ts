export interface PetContext {
  dueCount?: number;
  reviewedToday?: number;
  now?: Date;
}

export type PetPose = 'leek' | 'sprint' | 'sparkle' | 'celebrate' | 'thinking' | 'thumbsup';

export interface PetQuoteResult {
  text: string;
  pose: PetPose;
}

const MORNING_QUOTES: string[] = [
  '早上好！一日之计在于晨，晨读复习效率超高哦~ ☀️',
  '早安！元气满满的初音已经就位，今天也要加油哦！♪',
  '清晨新的一天开始啦！把昨天的盲点彻底消灭吧~ ٩(๑❛ᴗ❛๑)۶',
];

const NOON_QUOTES: string[] = [
  '中午要吃顿营养好饭，再小憩 15 分钟给大脑充充电哦！🍱',
  '午休时间！让双眼离开屏幕，听首轻音乐放松一下~ 🎵',
  '午后容易犯困，喝口水活动一下脖子再战！💪',
];

const EVENING_QUOTES: string[] = [
  '傍晚复盘时间！回顾一下今天整理的心得体会吧~ 📝',
  '晚上的专注力很宝贵，我们一题一题稳扎稳打！✨',
  '天色渐暗，自习室的灯火就是通往上岸的光！加油！🌟',
];

const NIGHT_QUOTES: string[] = [
  '已经很深了呢… 熬夜伤身体还影响记忆，早点休息吧！🌙',
  '今天辛苦啦！充足的睡眠是大脑整理知识的魔法时间~ 💤',
  '夜深啦，如果还在坚持，给努力的你倒一杯温水哦~ ☕',
];

const POKE_QUOTES: Array<{ text: string; pose: PetPose }> = [
  { text: '呀！戳到我的双马尾啦！( > < )', pose: 'thinking' },
  { text: '39！不仅代表初音未来，也是在感谢一直坚持的你~♪', pose: 'sparkle' },
  { text: '把每一道错题，都变成考场上势在必得的分数！Fight! (๑•̀ㅂ•́)و✧', pose: 'sprint' },
  { text: '给认真的主人竖大拇指！你的每一分付出都有回响~👍', pose: 'thumbsup' },
  { text: '累了吗？揉揉眼睛看会儿绿植，深呼吸一下吧~ 🌿', pose: 'leek' },
  { text: '自控原理和数学真题都在被你一点点攻克，超厉害！(≧∇≦)ﾉ', pose: 'sparkle' },
  { text: '戳我可以在设置里调整我的大小，还能随意拖动我哦~', pose: 'leek' },
  { text: '遇到难解的推导别焦虑，放慢速度理清步骤就好！🧠', pose: 'thinking' },
  { text: '滴答滴答… Miku 会一直安静陪在屏幕左下角守候你！🎵', pose: 'thumbsup' },
];

export function getPetGreeting(ctx: PetContext = {}): PetQuoteResult {
  const d = ctx.now ?? new Date();
  const hour = d.getHours();

  // 1. 若今日待写全部完成且有已写记录 -> 优先撒花
  if (ctx.dueCount === 0 && (ctx.reviewedToday ?? 0) > 0) {
    return {
      text: '太棒了！今日复习目标已全部拿下，为你拉响礼花！🎉',
      pose: 'celebrate',
    };
  }

  // 2. 剩余题量较多
  if (ctx.dueCount !== undefined && ctx.dueCount >= 10) {
    return {
      text: `今天还有 ${ctx.dueCount} 道错题在排队，集中注意力，我们一鼓作气搞定它！💪`,
      pose: 'sprint',
    };
  }

  // 3. 剩余题量少量（最后冲刺）
  if (ctx.dueCount !== undefined && ctx.dueCount > 0 && ctx.dueCount <= 3) {
    return {
      text: `只剩最后 ${ctx.dueCount} 道题啦！再坚持一下就大功告成~ ✨`,
      pose: 'thumbsup',
    };
  }

  // 4. 按时段问候
  if (hour >= 5 && hour < 9) {
    const text = MORNING_QUOTES[Math.floor(Math.random() * MORNING_QUOTES.length)];
    return { text, pose: 'leek' };
  }
  if (hour >= 11 && hour < 14) {
    const text = NOON_QUOTES[Math.floor(Math.random() * NOON_QUOTES.length)];
    return { text, pose: 'leek' };
  }
  if (hour >= 18 && hour < 22) {
    const text = EVENING_QUOTES[Math.floor(Math.random() * EVENING_QUOTES.length)];
    return { text, pose: 'sprint' };
  }
  if (hour >= 23 || hour < 5) {
    const text = NIGHT_QUOTES[Math.floor(Math.random() * NIGHT_QUOTES.length)];
    return { text, pose: 'thinking' };
  }

  // 日常通用
  return {
    text: '今天也要元气满满地攻克考研错题哦！♪(・ω・)ノ',
    pose: 'leek',
  };
}

export function getRandomPokeQuote(excludeText?: string): PetQuoteResult {
  const candidates = excludeText
    ? POKE_QUOTES.filter((q) => q.text !== excludeText)
    : POKE_QUOTES;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return picked ?? { text: '加油哦！Miku 永远支持你！♪', pose: 'thumbsup' };
}
