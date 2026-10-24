/**
 * 解析主题壁纸/静态资源 URL：
 * 兼容 GitHub Pages 项目子路径（如 /mistake-notebook/）与本地开发根路径，
 * 并支持在线 http/https 直链、base64 data: 和 blob:。
 */
export function resolveThemeUrl(url: string | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  // 在线 URL、本地 blob 或 base64 直接返回
  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  // 修正 Vite base 路径，去除前导斜杠防止打到域名根目录 (解决平板端访问 GitHub Pages 404)
  const base = import.meta.env.BASE_URL ?? './';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanUrl = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `${cleanBase}${cleanUrl}`;
}
