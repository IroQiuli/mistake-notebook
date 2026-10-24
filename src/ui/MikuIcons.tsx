import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * 首页图标：初音未来标志性「大葱 (Negi)」
 * 葱白根茎 + 翠绿葱叶 + 切割节理，极具辨识度
 */
export function MikuHomeIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* 葱叶分叉 */}
      <path d="M14 3c1 3-1 6-4 8l-6 6c-1 1-1 2 0 3s2 1 3 0l6-6c2-3 5-5 8-4-1 3-3 6-6 8l-6 6" />
      {/* 葱白与青葱分界环 */}
      <path d="M10 11l3 3" />
      <path d="M8 13l3 3" />
      {/* 葱叶小尖尖 */}
      <path d="M17 4c2 0 4 2 4 4" />
    </svg>
  );
}

/**
 * 错题本图标：初音音乐活页本 / 乐谱夹 (Music Binder)
 * 带有旋律音符的精美试卷错题簿
 */
export function MikuLibraryIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 3v18" />
      {/* 乐谱与题行 */}
      <path d="M12 7h5" />
      <path d="M12 11h5" />
      {/* 音符微标 */}
      <circle cx="13" cy="16" r="1.5" fill="currentColor" />
      <path d="M14.5 16V13h2v1.5" />
    </svg>
  );
}

/**
 * 录入图标：初音未来舞台麦克风 (Stage Mic)
 * 闪耀星星与现场收音话筒
 */
export function MikuCaptureIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* 麦克风网头 */}
      <rect x="9" y="2" width="6" height="10" rx="3" />
      {/* 收音弧环 */}
      <path d="M5 8a7 7 0 0 0 14 0" />
      {/* 支架手柄 */}
      <path d="M12 15v5" />
      <path d="M8 20h8" />
      {/* 录音捕捉星芒闪烁 */}
      <path d="M19 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * 统计图标：初音未来音乐律动频谱波形 (Soundwave Equalizer)
 * 充满电音声浪与节奏活力
 */
export function MikuStatsIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* 5 根跳动的音频频谱条 */}
      <path d="M4 14v4" />
      <path d="M8 8v10" />
      <path d="M12 4v14" />
      <path d="M16 10v8" />
      <path d="M20 6v12" />
    </svg>
  );
}

/**
 * 我的图标：初音未来标志性头戴式赛博耳机 (Miku Headset)
 * 双耳包耳罩 + 标志性粉色发带方块
 */
export function MikuSettingsIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* 头梁弧线 */}
      <path d="M4 13a8 8 0 0 1 16 0" />
      {/* 左耳罩 */}
      <rect x="2" y="12" width="4" height="7" rx="2" />
      {/* 右耳罩 */}
      <rect x="18" y="12" width="4" height="7" rx="2" />
      {/* 伸缩麦克风拾音柄 */}
      <path d="M18 17a3 3 0 0 1-3 3h-2" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </svg>
  );
}

/**
 * 初音双马尾音符微标 (Twin-tails & 01 Logo)
 */
export function MikuTwinTailLogo({ size = 24, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="11" fill="#39C5BB" />
      {/* 01 经典编号 */}
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fontSize="9"
        fontWeight="900"
        fill="#ffffff"
        fontFamily="monospace, system-ui"
        letterSpacing="-0.5"
      >
        01
      </text>
      {/* 右上角发圈粉色点缀 */}
      <circle cx="17.5" cy="6.5" r="2" fill="#FF5E97" />
    </svg>
  );
}
