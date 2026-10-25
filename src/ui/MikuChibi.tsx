import { cn } from './cn';

// 直接导入高品质官方 Project Sekai / 官方 Q版初音纯透明无杂边素材
import dizzySrc from '../assets/miku/dizzy.webp';
import thinkingSrc from '../assets/miku/thinking.webp';
import thumbsUpSrc from '../assets/miku/thumbsup.webp';
import sparkleSrc from '../assets/miku/sparkle.webp';
import celebrateSrc from '../assets/miku/celebrate.webp';
import sprintSrc from '../assets/miku/sprint.webp';
import cheerSrc from '../assets/miku/cheer.webp';
import leekSrc from '../assets/miku/leek.webp';
import cardsSrc from '../assets/miku/cards.webp';
import glowsticksSrc from '../assets/miku/glowsticks.webp';

export interface ChibiProps {
  className?: string;
  size?: number;
  alt?: string;
}

/**
 * 1: 忘记 (Again) - 咬手指困扰流汗 Q版初音
 */
export function MikuChibiDizzy({ className, size = 32, alt = '初音未来 忘记了' }: ChibiProps) {
  return (
    <img
      src={dizzySrc}
      alt={alt}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none object-contain pointer-events-none drop-shadow-xs transition-transform', className)}
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
    />
  );
}

/**
 * 2: 困难 (Hard) - 手扶下颌吃惊“好难” Q版初音
 */
export function MikuChibiThinking({ className, size = 32, alt = '初音未来 遇到困难' }: ChibiProps) {
  return (
    <img
      src={thinkingSrc}
      alt={alt}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none object-contain pointer-events-none drop-shadow-xs transition-transform', className)}
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
    />
  );
}

/**
 * 3: 良好 (Good) - 俏皮眨眼、单手竖大拇指点赞 Q版初音
 */
export function MikuChibiThumbsUp({ className, size = 32, alt = '初音未来 点赞良好' }: ChibiProps) {
  return (
    <img
      src={thumbsUpSrc}
      alt={alt}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none object-contain pointer-events-none drop-shadow-xs transition-transform', className)}
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
    />
  );
}

/**
 * 4: 简单 (Easy) - Wink 吐小舌比耶剪刀手 Q版初音
 */
export function MikuChibiSparkle({ className, size = 32, alt = '初音未来 胜利比耶' }: ChibiProps) {
  return (
    <img
      src={sparkleSrc}
      alt={alt}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none object-contain pointer-events-none drop-shadow-xs transition-transform', className)}
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
    />
  );
}

/**
 * 通关撒花/清空错题庆祝初音 - 拉响金色礼花筒，彩带飞舞
 */
export function MikuChibiCelebrate({ className, size = 64, alt = '初音未来 撒花通关' }: ChibiProps) {
  return (
    <img
      src={celebrateSrc}
      alt={alt}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none object-contain pointer-events-none drop-shadow-md', className)}
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
    />
  );
}

/**
 * 考研冲刺倒计时初音 - 双拳紧握向前加油 "Fight!"
 */
export function MikuChibiSprint({ className, size = 32, alt = '初音未来 考研冲刺' }: ChibiProps) {
  return (
    <img
      src={sprintSrc}
      alt={alt}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none object-contain pointer-events-none drop-shadow-xs', className)}
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
    />
  );
}

/**
 * 连续打卡音符元气初音 - 快乐跳跃与飞旋音符
 */
export function MikuChibiCheer({ className, size = 32, alt = '初音未来 音符伴学' }: ChibiProps) {
  return (
    <img
      src={cheerSrc}
      alt={alt}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none object-contain pointer-events-none drop-shadow-xs', className)}
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
    />
  );
}

/**
 * 待写清单标 / 葱娘入口 - 经典初音挥手打招呼
 */
export function MikuChibiLeek({ className, size = 32, alt = '初音未来 伴学' }: ChibiProps) {
  return (
    <img
      src={leekSrc}
      alt={alt}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none object-contain pointer-events-none drop-shadow-xs', className)}
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
    />
  );
}

/**
 * 手握答题卡片与烟花盛典 Q版初音
 */
export function MikuChibiCards({ className, size = 32, alt = '初音未来 题卡' }: ChibiProps) {
  return (
    <img
      src={cardsSrc}
      alt={alt}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none object-contain pointer-events-none drop-shadow-xs', className)}
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
    />
  );
}

/**
 * 双持荧光棒狂欢初音
 */
export function MikuChibiGlowsticks({ className, size = 32, alt = '初音未来 打call' }: ChibiProps) {
  return (
    <img
      src={glowsticksSrc}
      alt={alt}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none object-contain pointer-events-none drop-shadow-xs', className)}
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
    />
  );
}
