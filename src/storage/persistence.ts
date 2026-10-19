/** 浏览器是否已承诺「不主动清理本站数据」 */
export type PersistState = 'granted' | 'denied' | 'unsupported';

export async function persistenceState(): Promise<PersistState> {
  if (!navigator.storage?.persisted) return 'unsupported';
  try {
    return (await navigator.storage.persisted()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/**
 * 申请持久化存储。浏览器可能不弹窗、直接按站点互动度决定，
 * 所以返回值只代表当前状态，不代表失败原因。
 */
export async function requestPersistence(): Promise<PersistState> {
  if (!navigator.storage?.persist) return 'unsupported';
  try {
    if (await navigator.storage.persisted()) return 'granted';
    await navigator.storage.persist();
    return (await navigator.storage.persisted()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}
