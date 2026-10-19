export interface SeedSubject {
  name: string;
  color: string;
  chapters: string[];
}

/** 错因标签：比自由文本更好统计「到底栽在哪」 */
export const ERROR_TAGS = [
  '概念不清',
  '计算失误',
  '审题看漏',
  '时间不够',
  '公式记错',
  '方法没想到',
] as const;

export const ERROR_TAG_COLORS: Record<string, string> = {
  概念不清: '#ef4444',
  计算失误: '#f97316',
  审题看漏: '#eab308',
  时间不够: '#8b5cf6',
  公式记错: '#3b82f6',
  方法没想到: '#14b8a6',
};

/**
 * 掌握程度：同一色相由深到浅，越深 = 越不熟 = 越该重点看。
 * 1 完全不会 → 深赭色；4 已掌握 → 浅橙；未分级用灰色。
 */
export const MASTERY_LEVELS = [
  {
    level: 1 as const,
    label: '完全不会',
    short: '不会',
    color: '#9a3412',
    soft: '#fde8d7',
    hint: '重点看',
  },
  {
    level: 2 as const,
    label: '不熟',
    short: '不熟',
    color: '#ea580c',
    soft: '#fee7d5',
    hint: '多练',
  },
  {
    level: 3 as const,
    label: '一般',
    short: '一般',
    color: '#fb923c',
    soft: '#fef0e4',
    hint: '保持',
  },
  {
    level: 4 as const,
    label: '掌握',
    short: '掌握',
    color: '#fdba74',
    soft: '#fff7ed',
    hint: '可归档',
  },
];

export const MASTERY_UNSET_COLOR = '#d4d4d8';

export function masteryLevel(level?: number) {
  return MASTERY_LEVELS.find((m) => m.level === level);
}

export function masteryColor(level?: number): string {
  return masteryLevel(level)?.color ?? MASTERY_UNSET_COLOR;
}

export function masteryLabel(level?: number): string {
  return masteryLevel(level)?.label ?? '未分级';
}

/** 选中态按钮上的文字色：最浅的那档用深色字才看得清 */
export function masteryTextColor(level?: number): string {
  return level === 4 ? '#7c2d12' : '#ffffff';
}

/**
 * 首次启动写入的分类模板。
 * 数学二不考概率论与无穷级数；839 按王建辉《自动控制原理》第 2 版
 * 与王福利《过程控制系统》第 2 版的章节拆分。
 */
export const SEED_SUBJECTS: SeedSubject[] = [
  {
    name: '数学二',
    color: '#3b82f6',
    chapters: [
      '函数、极限与连续',
      '一元函数微分学',
      '一元函数积分学',
      '多元函数微分学',
      '二重积分',
      '常微分方程',
      '行列式',
      '矩阵',
      '向量',
      '线性方程组',
      '特征值与特征向量',
      '二次型',
    ],
  },
  {
    name: '英语二',
    color: '#22c55e',
    chapters: ['完形填空', '阅读理解', '新题型', '翻译', '写作', '词汇与语法'],
  },
  {
    name: '政治',
    color: '#ef4444',
    chapters: [
      '马克思主义基本原理',
      '毛泽东思想和中国特色社会主义理论体系概论',
      '中国近现代史纲要',
      '思想道德与法治',
      '形势与政策',
    ],
  },
  {
    name: '839 自动控制原理及过程控制',
    color: '#f97316',
    chapters: [
      '自动控制的一般概念',
      '控制系统的数学模型',
      '线性系统的时域分析法',
      '根轨迹分析法',
      '线性系统的频域分析法',
      '线性系统的校正方法',
      '非线性控制系统分析',
      '线性离散控制系统',
      '过程检测及控制仪表',
      '被控过程特性的机理建模',
      '常规过程控制系统（单回路控制）',
      '复杂过程控制系统方案设计',
      '典型工业过程控制综合设计实战',
    ],
  },
];
