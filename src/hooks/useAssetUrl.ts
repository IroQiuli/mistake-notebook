import { useEffect, useState } from 'react';
import { getUrl } from '../storage/assets';

/** 按 asset id 取对象 URL，组件卸载时不 revoke（URL 由 assets 层缓存复用） */
export function useAssetUrl(id?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setUrl(null);
      return;
    }
    getUrl(id).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return url;
}
