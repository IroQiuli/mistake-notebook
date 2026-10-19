import { useState } from 'react';
import type { InkTool } from './InkSurface';

/** 笔迹工具状态：钢笔 / 荧光笔 / 橡皮 + 颜色 + 粗细 */
export function useInkTools() {
  const [tool, setTool] = useState<InkTool>('pen');
  const [color, setColor] = useState('#18181b');
  const [width, setWidth] = useState(0.0045);

  return { tool, color, width, setTool, setColor, setWidth };
}
