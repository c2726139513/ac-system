import prisma from "./prisma";

function currentYearMonth(): string {
  const now = new Date();
  return now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0");
}

/**
 * Generate the next auto-number in format: YYYYMM-XXXX (e.g., 202606-0001)
 *
 * When `existingInMonth` is provided (even if empty), finds the smallest unused
 * number by checking existing records — this fills gaps left by deleted records.
 * Falls back to a SequenceCounter only when `existingInMonth` is omitted.
 */
export async function nextSequence(
  entityType: string,
  existingInMonth?: string[],
): Promise<string> {
  const yearMonth = currentYearMonth();
  const prefix = yearMonth + "-";

  if (existingInMonth !== undefined) {
    const used = new Set<number>();
    for (const num of existingInMonth) {
      if (num && num.startsWith(prefix)) {
        const n = parseInt(num.slice(7), 10);
        if (!isNaN(n)) used.add(n);
      }
    }
    let seq = 1;
    while (used.has(seq)) seq++;
    return prefix + String(seq).padStart(4, "0");
  }

  const counter = await prisma.sequenceCounter.upsert({
    where: { entityType_yearMonth: { entityType, yearMonth } },
    update: { seq: { increment: 1 } },
    create: { entityType, yearMonth, seq: 1 },
  });
  return prefix + String(counter.seq).padStart(4, "0");
}
