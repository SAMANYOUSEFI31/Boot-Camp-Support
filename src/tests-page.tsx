import { createRoot } from 'react-dom/client';
import { B } from './bushido';
import { Names } from './names';
import { Scoring } from './scoring';
import { donationScore, membership, reconcileWarnings } from './membership';
import type { Cohort, Participant } from './types';

const day = { n: 8, type: 'main' as const, hardLevels: 3, specialMission: true };
const person: Participant = {
  id: 'p', name: 'نمونه', nameKey: 'نمونه', telegram: '', groupId: 'g', status: 'active', habitCount: 5
};
const full = { done: 5, doneHabits: [0, 1, 2, 3, 4], hard: 3, special: 1 };
const required = { ...full, done: 4, doneHabits: [0, 1, 2, 3], hard: 0, special: 0 };
const payment = { id: 'receipt', amount: 200000, dayN: 8, paidAt: '2026-11-25T00:00:00Z' };
const c: Cohort = {
  id: 'sample', name: 'نمونه', startDate: '2026-11-01', archived: false,
  days: [day, { ...day, n: 9 }, { ...day, n: 10 }, { ...day, n: 11 }],
  groups: [{ id: 'g', name: 'نمونه', order: 1, mine: true, closedDays: [8, 9, 10],
    dayParticipants: { 8: ['p'], 9: ['p'], 10: ['p'], 11: ['p'] } }],
  participants: [{ ...person }], records: {}
};
reconcileWarnings(c);
const expelled = c.participants[0].status === 'left' && membership(c.participants[0]).warnings === 3;
c.participants[0].lifePayments = [payment];
reconcileWarnings(c);
const revived = c.participants[0].status === 'active' && membership(c.participants[0]).remaining === 1;
c.groups[0].closedDays.push(11);
reconcileWarnings(c);
const tests = [
  { title: 'روز کامل: دقیقاً ۱۱ امتیاز، بدون دونیت', pass: Scoring.dayScore(person, full, day) === 11 },
  { title: 'چهار عادت اصلی: ۶ امتیاز و روز استاندارد، حتی بدون عادت پنجم', pass: Scoring.dayScore(person, required, day) === 6 },
  { title: 'عادت پنجم جای عادت اصلی را نمی‌گیرد', pass: !Scoring.standardDay(person, { ...required, doneHabits: [0, 1, 2, 4] }, day) },
  { title: 'گرم‌کردن و مرور: بدون امتیاز', pass: ['warmup', 'review'].every((type) => Scoring.dayScore(person, full, { ...day, type }) === 0) },
  { title: 'دونیت یک میلیون تومان: ۵ امتیاز در کل دوره', pass: donationScore({ donations: [{ ...payment, amount: 1000000 }] }) === 5 },
  { title: 'هر روز ثبت‌نشده یک اخطار؛ سه اخطار باعث خروج', pass: expelled },
  { title: 'یک خرید جان: یک بازگشت؛ اخطار بعدی دوباره خروج', pass: revived && c.participants[0].status === 'left' }
];

function TestApp() {
  const passed = tests.filter((t) => t.pass).length;
  return <div className="bsh-stack">
    <h1 className="heading-lg">آزمون قواعد جدید امتیاز و جان</h1>
    <B.Button variant="secondary" href="index.html">بازگشت به برنامه</B.Button>
    <B.Alert intent={passed === tests.length ? 'success' : 'danger'}>
      {Names.toPersianDigits(passed) + ' از ' + Names.toPersianDigits(tests.length) + ' آزمون موفق'}
    </B.Alert>
    {tests.map((t) => <B.Card key={t.title} padding="md">
      <B.Badge intent={t.pass ? 'success' : 'danger'} icon={t.pass ? 'Check' : 'X'}>
        {t.pass ? 'موفق' : 'ناموفق'}
      </B.Badge>
      <p className="body-md">{t.title}</p>
    </B.Card>)}
  </div>;
}

createRoot(document.getElementById('root') as HTMLElement).render(<TestApp />);
