interface ChibiProps {
  className?: string;
  size?: number;
}

/**
 * 1: 忘记 (Again) - Q版初音蚊香眼/冒汗困扰表情
 */
export function MikuChibiDizzy({ className, size = 32 }: ChibiProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 双马尾 (左/右微垂耷拉) */}
      <path
        d="M 16 26 C 9 32, 7 42, 10 52 C 12 55, 15 54, 15 51 C 14 43, 16 35, 21 30 Z"
        fill="#39c5bb"
      />
      <path
        d="M 48 26 C 55 32, 57 42, 54 52 C 52 55, 49 54, 49 51 C 50 43, 48 35, 43 30 Z"
        fill="#39c5bb"
      />

      {/* 头部圆润脸庞 */}
      <circle cx="32" cy="31" r="18" fill="#ffeae3" />

      {/* 刘海 */}
      <path
        d="M 15 28 C 15 19, 23 15, 32 15 C 41 15, 49 19, 49 28 C 45 23, 40 23, 37 25 C 34 22, 30 22, 27 25 C 24 23, 19 23, 15 28 Z"
        fill="#39c5bb"
      />

      {/* 耳机与粉色发饰 */}
      <rect x="13" y="20" width="5" height="5" rx="1.5" fill="#1b2326" stroke="#ff5e97" strokeWidth="1.2" />
      <rect x="46" y="20" width="5" height="5" rx="1.5" fill="#1b2326" stroke="#ff5e97" strokeWidth="1.2" />

      {/* 蚊香眼 (左) */}
      <path
        d="M 23 31 A 3.5 3.5 0 0 1 29 32 A 2.2 2.2 0 0 1 25.5 33.5 A 1.2 1.2 0 0 1 27 32"
        fill="none"
        stroke="#4a5568"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* 蚊香眼 (右) */}
      <path
        d="M 35 31 A 3.5 3.5 0 0 1 41 32 A 2.2 2.2 0 0 1 37.5 33.5 A 1.2 1.2 0 0 1 39 32"
        fill="none"
        stroke="#4a5568"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* 波浪嘴 */}
      <path
        d="M 28 40 Q 30 42, 32 40 Q 34 38, 36 40"
        fill="none"
        stroke="#e53e3e"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* 腮红 */}
      <ellipse cx="21" cy="36" rx="2.5" ry="1.2" fill="#ffb4a2" opacity="0.7" />
      <ellipse cx="43" cy="36" rx="2.5" ry="1.2" fill="#ffb4a2" opacity="0.7" />

      {/* 冒冷汗水滴 */}
      <path
        d="M 44 24 C 44 22, 47 18, 47 18 C 47 18, 50 22, 50 24 C 50 25.6, 48.6 27, 47 27 C 45.4 27, 44 25.6, 44 24 Z"
        fill="#63b3ed"
      />
    </svg>
  );
}

/**
 * 2: 困难 (Hard) - Q版初音点唇挠头思考困惑表情
 */
export function MikuChibiThinking({ className, size = 32 }: ChibiProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 双马尾 */}
      <path
        d="M 16 26 C 8 32, 6 42, 8 50 C 9 53, 13 52, 13 49 C 12 42, 15 35, 21 30 Z"
        fill="#39c5bb"
      />
      <path
        d="M 48 26 C 56 32, 58 42, 56 50 C 55 53, 51 52, 51 49 C 52 42, 49 35, 43 30 Z"
        fill="#39c5bb"
      />

      {/* 头部 */}
      <circle cx="32" cy="31" r="18" fill="#ffeae3" />

      {/* 刘海 */}
      <path
        d="M 15 28 C 15 19, 23 15, 32 15 C 41 15, 49 19, 49 28 C 45 23, 40 23, 37 25 C 34 22, 30 22, 27 25 C 24 23, 19 23, 15 28 Z"
        fill="#39c5bb"
      />

      {/* 耳机与粉色发饰 */}
      <rect x="13" y="20" width="5" height="5" rx="1.5" fill="#1b2326" stroke="#ff5e97" strokeWidth="1.2" />
      <rect x="46" y="20" width="5" height="5" rx="1.5" fill="#1b2326" stroke="#ff5e97" strokeWidth="1.2" />

      {/* 眉毛 (一高一低思考状) */}
      <path d="M 23 27 Q 26 26, 29 28" fill="none" stroke="#2d3748" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 35 28 Q 38 25, 41 26" fill="none" stroke="#2d3748" strokeWidth="1.2" strokeLinecap="round" />

      {/* 眼睛 (圆溜溜带小困惑) */}
      <circle cx="26" cy="32" r="2.5" fill="#1a202c" />
      <circle cx="27" cy="31" r="0.8" fill="#ffffff" />
      <circle cx="38" cy="32" r="2.5" fill="#1a202c" />
      <circle cx="39" cy="31" r="0.8" fill="#ffffff" />

      {/* 嘴巴 (圆嘟嘟 'o' 形) */}
      <ellipse cx="32" cy="39" rx="1.8" ry="2.2" fill="#e53e3e" />

      {/* 挠头小手 */}
      <path
        d="M 46 36 C 46 34, 49 32, 51 34 C 52 35, 52 38, 48 39 Z"
        fill="#ffeae3"
        stroke="#cbd5e0"
        strokeWidth="0.8"
      />

      {/* 腮红 */}
      <ellipse cx="21" cy="36" rx="2.5" ry="1.2" fill="#ffb4a2" opacity="0.6" />
      <ellipse cx="43" cy="36" rx="2.5" ry="1.2" fill="#ffb4a2" opacity="0.6" />

      {/* 困惑小问号 */}
      <text
        x="47"
        y="17"
        fontFamily="sans-serif"
        fontWeight="bold"
        fontSize="12"
        fill="#d97706"
      >
        ?
      </text>
    </svg>
  );
}

/**
 * 3: 良好 (Good) - Q版初音竖大拇指点赞开心表情
 */
export function MikuChibiThumbsUp({ className, size = 32 }: ChibiProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 双马尾微扬 */}
      <path
        d="M 16 26 C 7 28, 4 38, 7 48 C 8 51, 12 50, 13 47 C 12 40, 16 33, 22 29 Z"
        fill="#39c5bb"
      />
      <path
        d="M 48 26 C 57 28, 60 38, 57 48 C 56 51, 52 50, 51 47 C 52 40, 48 33, 42 29 Z"
        fill="#39c5bb"
      />

      {/* 头部 */}
      <circle cx="32" cy="30" r="18" fill="#ffeae3" />

      {/* 刘海 */}
      <path
        d="M 15 27 C 15 18, 23 14, 32 14 C 41 14, 49 18, 49 27 C 45 22, 40 22, 37 24 C 34 21, 30 21, 27 24 C 24 22, 19 22, 15 27 Z"
        fill="#39c5bb"
      />

      {/* 耳机与粉色发饰 */}
      <rect x="13" y="19" width="5" height="5" rx="1.5" fill="#1b2326" stroke="#ff5e97" strokeWidth="1.2" />
      <rect x="46" y="19" width="5" height="5" rx="1.5" fill="#1b2326" stroke="#ff5e97" strokeWidth="1.2" />

      {/* 笑眯眯弧形眼 (^ ^) */}
      <path
        d="M 23 31 Q 26 27, 29 31"
        fill="none"
        stroke="#2d3748"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 35 31 Q 38 27, 41 31"
        fill="none"
        stroke="#2d3748"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 灿烂微笑 */}
      <path
        d="M 28 37 Q 32 42, 36 37"
        fill="#e53e3e"
        stroke="#e53e3e"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* 萌萌红晕 */}
      <ellipse cx="21" cy="35" rx="2.5" ry="1.4" fill="#ff8ba7" />
      <ellipse cx="43" cy="35" rx="2.5" ry="1.4" fill="#ff8ba7" />

      {/* 右侧竖起大拇指 (Thumbs up!) */}
      <g transform="translate(45, 34)">
        {/* 手掌 */}
        <circle cx="5" cy="8" r="4.5" fill="#ffeae3" stroke="#cbd5e0" strokeWidth="0.8" />
        {/* 竖起的大拇指 */}
        <rect x="3" y="0" width="4.5" height="8" rx="2.2" fill="#ffeae3" stroke="#cbd5e0" strokeWidth="0.8" />
        {/* 赞之光效微粒 */}
        <circle cx="10" cy="2" r="1" fill="#38a169" />
        <circle cx="12" cy="7" r="1.5" fill="#38a169" />
      </g>
    </svg>
  );
}

/**
 * 4: 简单 (Easy) - Q版初音Wink眨眼元气比耶表情 (V sign)
 */
export function MikuChibiSparkle({ className, size = 32 }: ChibiProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 双马尾欢快高扬 */}
      <path
        d="M 16 25 C 6 24, 2 33, 5 43 C 7 46, 11 45, 12 42 C 11 35, 16 30, 22 27 Z"
        fill="#39c5bb"
      />
      <path
        d="M 48 25 C 58 24, 62 33, 59 43 C 57 46, 53 45, 52 42 C 53 35, 48 30, 42 27 Z"
        fill="#39c5bb"
      />

      {/* 头部 */}
      <circle cx="32" cy="30" r="18" fill="#ffeae3" />

      {/* 刘海 */}
      <path
        d="M 15 27 C 15 18, 23 14, 32 14 C 41 14, 49 18, 49 27 C 45 22, 40 22, 37 24 C 34 21, 30 21, 27 24 C 24 22, 19 22, 15 27 Z"
        fill="#39c5bb"
      />

      {/* 耳机与粉色发饰 */}
      <rect x="13" y="19" width="5" height="5" rx="1.5" fill="#1b2326" stroke="#ff5e97" strokeWidth="1.2" />
      <rect x="46" y="19" width="5" height="5" rx="1.5" fill="#1b2326" stroke="#ff5e97" strokeWidth="1.2" />

      {/* 左眼 Wink 眨眼 (>) */}
      <path
        d="M 23 29 L 28 32 L 23 35"
        fill="none"
        stroke="#2d3748"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 右眼 大圆亮眸 */}
      <circle cx="38" cy="31" r="3" fill="#2d3748" />
      <circle cx="39" cy="30" r="1.1" fill="#ffffff" />
      <circle cx="37" cy="33" r="0.6" fill="#ffffff" />

      {/* 元气笑口开怀 */}
      <path
        d="M 28 37 Q 32 44, 36 37 Z"
        fill="#e53e3e"
      />

      {/* 腮红 */}
      <ellipse cx="20" cy="35" rx="2.8" ry="1.5" fill="#ff708f" />
      <ellipse cx="44" cy="35" rx="2.8" ry="1.5" fill="#ff708f" />

      {/* 右侧比耶剪刀手 (Victory V sign) */}
      <g transform="translate(46, 30)">
        {/* 手掌 */}
        <circle cx="6" cy="11" r="4" fill="#ffeae3" stroke="#cbd5e0" strokeWidth="0.8" />
        {/* 食指中指 V 形 */}
        <rect x="3" y="2" width="3" height="8" rx="1.5" fill="#ffeae3" stroke="#cbd5e0" strokeWidth="0.8" transform="rotate(-15 4 6)" />
        <rect x="7" y="1" width="3" height="8" rx="1.5" fill="#ffeae3" stroke="#cbd5e0" strokeWidth="0.8" transform="rotate(15 8 5)" />
      </g>

      {/* 星星闪烁 (★) */}
      <path
        d="M 12 16 L 13.5 12 L 15 16 L 19 17.5 L 15 19 L 13.5 23 L 12 19 L 8 17.5 Z"
        fill="#f6e05e"
      />
      <circle cx="18" cy="27" r="1.2" fill="#39c5bb" />
    </svg>
  );
}

/**
 * 通关撒花/清空错题庆祝初音 (Celebrate Miku)
 */
export function MikuChibiCelebrate({ className, size = 64 }: ChibiProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 撒花纸屑 (Confetti) */}
      <circle cx="20" cy="20" r="3" fill="#ff5e97" />
      <circle cx="80" cy="22" r="3" fill="#39c5bb" />
      <rect x="25" y="12" width="5" height="5" rx="1" fill="#ecc94b" transform="rotate(25 27 14)" />
      <rect x="72" y="14" width="5" height="5" rx="1" fill="#ed64a6" transform="rotate(-35 74 16)" />
      <circle cx="48" cy="8" r="2.5" fill="#4fd1c5" />

      {/* 初音大长双马尾 (高高挥起) */}
      <path
        d="M 32 44 C 18 36, 10 48, 14 68 C 16 74, 22 72, 22 67 C 21 56, 27 48, 38 46 Z"
        fill="#39c5bb"
      />
      <path
        d="M 68 44 C 82 36, 90 48, 86 68 C 84 74, 78 72, 78 67 C 79 56, 73 48, 62 46 Z"
        fill="#39c5bb"
      />

      {/* 身体衣服 (黑灰制服与初音领带) */}
      <path d="M 40 68 L 44 88 L 56 88 L 60 68 Z" fill="#2d3748" />
      <path d="M 48 68 L 52 68 L 51 82 L 49 82 Z" fill="#39c5bb" />

      {/* 双手高高举起大葱 */}
      {/* 左葱 */}
      <g transform="translate(18, 30) rotate(-40)">
        <rect x="0" y="4" width="6" height="24" rx="3" fill="#ffffff" stroke="#cbd5e0" strokeWidth="0.8" />
        <rect x="0" y="0" width="6" height="12" rx="2" fill="#48bb78" />
      </g>
      {/* 右葱 */}
      <g transform="translate(76, 26) rotate(40)">
        <rect x="0" y="4" width="6" height="24" rx="3" fill="#ffffff" stroke="#cbd5e0" strokeWidth="0.8" />
        <rect x="0" y="0" width="6" height="12" rx="2" fill="#48bb78" />
      </g>

      {/* 头部大圆脸 */}
      <circle cx="50" cy="46" r="24" fill="#ffeae3" />

      {/* 刘海 */}
      <path
        d="M 28 42 C 28 30, 38 24, 50 24 C 62 24, 72 30, 72 42 C 67 36, 61 36, 57 39 C 53 35, 47 35, 43 39 C 39 36, 33 36, 28 42 Z"
        fill="#39c5bb"
      />

      {/* 标志性发饰 */}
      <rect x="25" y="32" width="7" height="7" rx="2" fill="#1a202c" stroke="#ff5e97" strokeWidth="1.5" />
      <rect x="68" y="32" width="7" height="7" rx="2" fill="#1a202c" stroke="#ff5e97" strokeWidth="1.5" />

      {/* 幸福眯眼笑 (^ ^) */}
      <path
        d="M 38 48 Q 42 42, 46 48"
        fill="none"
        stroke="#2d3748"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M 54 48 Q 58 42, 62 48"
        fill="none"
        stroke="#2d3748"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* 开心大张嘴 (D 形笑口) */}
      <path
        d="M 44 56 Q 50 66, 56 56 Z"
        fill="#e53e3e"
      />
      <path
        d="M 47 57 Q 50 60, 53 57"
        fill="#feb2b2"
      />

      {/* 腮红 */}
      <ellipse cx="36" cy="54" rx="4" ry="2" fill="#ff708f" />
      <ellipse cx="64" cy="54" rx="4" ry="2" fill="#ff708f" />

      {/* 39 (Miku) 小萌标 */}
      <g transform="translate(42, 86)">
        <rect width="16" height="10" rx="5" fill="#39c5bb" />
        <text x="8" y="8" textAnchor="middle" fontSize="7" fontWeight="900" fill="#ffffff">
          39!
        </text>
      </g>
    </svg>
  );
}

/**
 * 考研冲刺倒计时初音 (Sprint Miku with Victory Headband)
 */
export function MikuChibiSprint({ className, size = 32 }: ChibiProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 奔跑速度风线 */}
      <line x1="4" y1="28" x2="14" y2="28" stroke="#39c5bb" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="2" y1="36" x2="12" y2="36" stroke="#ff5e97" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="6" y1="44" x2="16" y2="44" stroke="#39c5bb" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

      {/* 飘逸后扬的双马尾 */}
      <path
        d="M 22 28 C 10 24, 6 15, 4 8 C 8 8, 12 14, 18 20 Z"
        fill="#39c5bb"
      />
      <path
        d="M 25 32 C 14 30, 8 24, 7 17 C 11 17, 16 22, 22 26 Z"
        fill="#39c5bb"
        opacity="0.8"
      />

      {/* 头部 */}
      <circle cx="36" cy="30" r="17" fill="#ffeae3" />

      {/* 刘海 */}
      <path
        d="M 20 28 C 20 19, 28 14, 38 14 C 47 14, 53 19, 53 28 C 49 23, 44 23, 41 25 C 38 22, 34 22, 31 25 C 28 23, 24 23, 20 28 Z"
        fill="#39c5bb"
      />

      {/* 必胜头巾 (红色系带) */}
      <path d="M 20 24 L 52 24 L 52 29 L 20 29 Z" fill="#e53e3e" />
      <circle cx="36" cy="26.5" r="2.2" fill="#ffffff" />
      {/* 头巾飘带 */}
      <path d="M 20 26 C 14 24, 10 18, 9 12 C 12 15, 16 22, 20 26 Z" fill="#e53e3e" />

      {/* 坚毅眼神 (冲刺专注) */}
      <ellipse cx="32" cy="34" rx="2.8" ry="3.2" fill="#2d3748" />
      <circle cx="33" cy="33" r="1" fill="#ffffff" />
      <ellipse cx="44" cy="34" rx="2.8" ry="3.2" fill="#2d3748" />
      <circle cx="45" cy="33" r="1" fill="#ffffff" />

      {/* 微微抿起的小嘴 (专注加油) */}
      <path d="M 36 41 Q 38 42, 40 41" fill="none" stroke="#e53e3e" strokeWidth="1.5" strokeLinecap="round" />

      {/* 腮红 */}
      <ellipse cx="27" cy="37" rx="2.5" ry="1.2" fill="#ff708f" />
      <ellipse cx="49" cy="37" rx="2.5" ry="1.2" fill="#ff708f" />

      {/* 握拳冲刺手臂 */}
      <circle cx="48" cy="42" r="3.5" fill="#ffeae3" stroke="#cbd5e0" strokeWidth="0.8" />
    </svg>
  );
}

/**
 * 连续打卡音符元气初音 (Cheering Miku with Rhythm Notes)
 */
export function MikuChibiCheer({ className, size = 32 }: ChibiProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 律动音符 */}
      <g transform="translate(6, 10)">
        <ellipse cx="4" cy="8" rx="2.5" ry="2" fill="#39c5bb" transform="rotate(-20 4 8)" />
        <line x1="6" y1="7" x2="6" y2="1" stroke="#39c5bb" strokeWidth="1.2" />
        <path d="M 6 1 Q 9 2, 9 5" fill="none" stroke="#39c5bb" strokeWidth="1.2" />
      </g>
      <g transform="translate(48, 8)">
        <ellipse cx="4" cy="8" rx="2.5" ry="2" fill="#ff5e97" transform="rotate(-20 4 8)" />
        <line x1="6" y1="7" x2="6" y2="1" stroke="#ff5e97" strokeWidth="1.2" />
        <path d="M 6 1 Q 9 2, 9 5" fill="none" stroke="#ff5e97" strokeWidth="1.2" />
      </g>

      {/* 双马尾随律动摆动 */}
      <path
        d="M 16 27 C 8 28, 5 38, 8 48 C 9 51, 13 50, 14 47 C 13 40, 17 33, 22 29 Z"
        fill="#39c5bb"
      />
      <path
        d="M 48 27 C 56 28, 59 38, 56 48 C 55 51, 51 50, 50 47 C 51 40, 47 33, 42 29 Z"
        fill="#39c5bb"
      />

      {/* 头部 */}
      <circle cx="32" cy="32" r="17" fill="#ffeae3" />

      {/* 刘海 */}
      <path
        d="M 16 29 C 16 20, 24 16, 32 16 C 40 16, 48 20, 48 29 C 44 24, 39 24, 36 26 C 33 23, 29 23, 26 26 C 23 24, 19 24, 16 29 Z"
        fill="#39c5bb"
      />

      {/* 耳机与粉色发饰 */}
      <rect x="14" y="21" width="5" height="5" rx="1.5" fill="#1b2326" stroke="#ff5e97" strokeWidth="1.2" />
      <rect x="45" y="21" width="5" height="5" rx="1.5" fill="#1b2326" stroke="#ff5e97" strokeWidth="1.2" />

      {/* 灵动大眼睛 */}
      <ellipse cx="26" cy="33" rx="2.5" ry="3" fill="#2d3748" />
      <circle cx="27" cy="32" r="1" fill="#ffffff" />
      <ellipse cx="38" cy="33" rx="2.5" ry="3" fill="#2d3748" />
      <circle cx="39" cy="32" r="1" fill="#ffffff" />

      {/* 微笑 */}
      <path d="M 29 39 Q 32 43, 35 39" fill="none" stroke="#e53e3e" strokeWidth="1.6" strokeLinecap="round" />

      {/* 腮红 */}
      <ellipse cx="21" cy="37" rx="2.2" ry="1.2" fill="#ff708f" />
      <ellipse cx="43" cy="37" rx="2.2" ry="1.2" fill="#ff708f" />
    </svg>
  );
}

/**
 * 怀抱大葱初音 (Miku Hugging Negi) - 待写清单标
 */
export function MikuChibiLeek({ className, size = 32 }: ChibiProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 双马尾 */}
      <path
        d="M 16 26 C 8 30, 6 40, 8 48 C 9 51, 13 50, 13 47 C 12 40, 15 34, 21 30 Z"
        fill="#39c5bb"
      />
      <path
        d="M 48 26 C 56 30, 58 40, 56 48 C 55 51, 51 50, 51 47 C 52 40, 49 34, 43 30 Z"
        fill="#39c5bb"
      />

      {/* 头部 */}
      <circle cx="32" cy="28" r="16" fill="#ffeae3" />

      {/* 刘海 */}
      <path
        d="M 17 26 C 17 18, 24 14, 32 14 C 40 14, 47 18, 47 26 C 43 21, 39 21, 36 23 C 33 20, 29 20, 26 23 C 23 21, 20 21, 17 26 Z"
        fill="#39c5bb"
      />

      {/* 眼睛 */}
      <circle cx="26" cy="29" r="2.2" fill="#2d3748" />
      <circle cx="27" cy="28.2" r="0.8" fill="#ffffff" />
      <circle cx="38" cy="29" r="2.2" fill="#2d3748" />
      <circle cx="39" cy="28.2" r="0.8" fill="#ffffff" />

      {/* 微笑 */}
      <path d="M 30 34 Q 32 36, 34 34" fill="none" stroke="#e53e3e" strokeWidth="1.2" strokeLinecap="round" />

      {/* 怀抱的翠绿大葱 (Negi) */}
      <g transform="translate(20, 36) rotate(-22)">
        {/* 葱白 */}
        <rect x="0" y="4" width="7" height="18" rx="3.5" fill="#ffffff" stroke="#cbd5e0" strokeWidth="0.8" />
        {/* 葱绿 */}
        <rect x="0" y="0" width="7" height="9" rx="3" fill="#48bb78" />
        {/* 葱叶分叉 */}
        <path d="M 2 0 L 0 -5 L 4 0 Z" fill="#38a169" />
        <path d="M 5 0 L 7 -6 L 7 0 Z" fill="#48bb78" />
      </g>

      {/* 抱葱的小手手 */}
      <circle cx="25" cy="42" r="3.2" fill="#ffeae3" stroke="#cbd5e0" strokeWidth="0.6" />
      <circle cx="37" cy="43" r="3.2" fill="#ffeae3" stroke="#cbd5e0" strokeWidth="0.6" />

      {/* 腮红 */}
      <ellipse cx="22" cy="32" rx="2" ry="1" fill="#ff708f" />
      <ellipse cx="42" cy="32" rx="2" ry="1" fill="#ff708f" />
    </svg>
  );
}
