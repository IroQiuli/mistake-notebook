import { db } from '../storage/db';
import { learningDayStart } from './time';

/**
 * 自动修复因早期短步长 bug 导致卡片到期日停留在过去（被误当成昨日顺延）的问题：
 * 若卡片已经复习过 (reps > 0 且有 lastReview)，但 due <= lastReview：
 * 根据其最近一次 reviewLog 的评分，将其 due 正确推移到未来的目标学习日早晨。
 */
export async function healCards(): Promise<number> {
  try {
    const [cards, logs] = await Promise.all([
      db.cards.toArray(),
      db.reviewLogs.toArray(),
    ]);

    const logsByProblem = new Map<string, typeof logs>();
    for (const l of logs) {
      if (l.rating === 0) continue;
      const arr = logsByProblem.get(l.problemId) ?? [];
      arr.push(l);
      logsByProblem.set(l.problemId, arr);
    }

    let healed = 0;
    const DAY = 24 * 3600 * 1000;

    await db.transaction('rw', db.cards, async () => {
      for (const card of cards) {
        if (!card.lastReview || card.reps === 0) continue;
        // 如果卡片的到期日 <= 上次做题时间，说明排期停滞在过去，未能正常推进
        if (card.due <= card.lastReview) {
          const pLogs = logsByProblem.get(card.problemId);
          if (pLogs && pLogs.length > 0) {
            pLogs.sort((a, b) => b.reviewedAt - a.reviewedAt);
            const lastLog = pLogs[0];
            // 忘记(1): 推进 1 天；困难(2): 推进 2 天；良好(3): 推进 3 天；简单(4): 推进 7 天
            const daysMap: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 7 };
            const days = daysMap[lastLog.rating] ?? 1;
            const targetDayStart = learningDayStart(lastLog.reviewedAt) + days * DAY;
            const newDue = targetDayStart + 5 * 3600 * 1000; // 目标日早晨 09:00
            await db.cards.update(card.problemId, {
              due: newDue,
              scheduledDays: days,
            });
            healed++;
          }
        }
      }
    });
    return healed;
  } catch (err) {
    console.error('Failed to heal cards:', err);
    return 0;
  }
}
