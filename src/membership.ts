import type { Cohort, Participant, Payment } from './types';
import { doneIndexes } from './habits';

export const DONATION_STEP = 200000;
export const DONATION_CAP = 1000000;
export const LIFE_PRICE = 200000;

export function donationTotal(p: Pick<Participant, 'donations'>, uptoDay = Infinity): number {
  return (p.donations || []).filter((payment) => payment.dayN <= uptoDay)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function donationScore(p: Pick<Participant, 'donations'>, uptoDay = Infinity): number {
  return Math.min(5, Math.floor(donationTotal(p, uptoDay) / DONATION_STEP));
}

export function membership(p: Participant) {
  const warnings = (p.warningDays || []).length;
  const purchasedLives = (p.lifePayments || []).length;
  const allowance = (p.lifePayments || []).reduce((cap, payment, index) =>
    Math.max(cap, (payment.warningsAtPurchase ?? 3 + index) + 1), 3);
  return { warnings, purchasedLives, remaining: Math.max(0, allowance - warnings) };
}

export function reconcileWarnings(c: Cohort): void {
  for (const p of c.participants) {
    const days = new Set<number>();
    for (const g of c.groups) {
      for (const dayN of g.closedDays) {
        if (!g.dayParticipants?.[dayN]?.includes(p.id)) continue;
        if (c.days.find((d) => d.n === dayN)?.type !== 'main') continue;
        const indices = doneIndexes(p, c.records[p.id]?.[dayN]);
        if (!indices || ![0, 1, 2, 3].every((i) => indices.includes(i))) days.add(dayN);
      }
    }
    if (days.size || p.warningDays) p.warningDays = [...days].sort((a, b) => a - b);
    const exhausted = membership(p).remaining === 0;
    if (exhausted && (p.status === 'active' || p.expelledForWarnings)) {
      p.status = 'left';
      p.expelledForWarnings = true;
    } else if (!exhausted && p.expelledForWarnings) {
      p.status = 'active';
      p.expelledForWarnings = false;
    }
  }
}

export function validatePayments(payments: unknown, kind: 'donation' | 'life'): payments is Payment[] {
  if (!Array.isArray(payments)) return false;
  const ids = new Set<string>();
  let total = 0;
  for (const value of payments) {
    if (!value || typeof value !== 'object') return false;
    const p = value as Partial<Payment>;
    if (typeof p.id !== 'string' || !p.id || ids.has(p.id) ||
        typeof p.amount !== 'number' || !Number.isSafeInteger(p.amount) || p.amount <= 0 ||
        typeof p.dayN !== 'number' || !Number.isInteger(p.dayN) || p.dayN < 1 || p.dayN > 90 ||
        typeof p.paidAt !== 'string' || !Number.isFinite(Date.parse(p.paidAt))) return false;
    if (kind === 'life' && p.amount !== LIFE_PRICE) return false;
    if (p.warningsAtPurchase !== undefined &&
        (!Number.isInteger(p.warningsAtPurchase) || p.warningsAtPurchase < 3)) return false;
    ids.add(p.id);
    total += p.amount;
  }
  return kind !== 'donation' || total <= DONATION_CAP;
}
