/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRoot } from 'react-dom/client';
import { B } from './bushido';
import { Names } from './names';
import { errorMessage } from './errors';
import { Scoring } from './scoring';
import { Store } from './store';
import { ImageExport } from './image-export';
import type { AppState, Cohort, Group } from './types';

// داده‌های نمونهٔ آزمون عمداً ناقص‌اند؛ برای تایپ به ساختار کامل تبدیل می‌شوند
const asCohort = (v: unknown) => v as Cohort;
const asState = (v: unknown) => v as AppState;

const testDefinitions = [
  {
    id: 1,
    title: '۱. habitCount=3, done=3, hard=3, special=1 در روز ۳ سطحی با مأموریت -> ۷ از ۷',
    run: function () {
      const p = { id: 'p1', habitCount: 3 };
      const day = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
      const rec = { done: 3, hard: 3, special: 1 };
      const sc = Scoring.dayScore(p, rec, day);
      const mx = Scoring.dayMax(p, day, rec);
      return { pass: sc === 7 && mx === 7, detail: 'امتیاز: ' + sc + ' از ' + mx };
    }
  },
  {
    id: 2,
    title: '۲. habitCount=4, done=2, hard=0, special=0 در همان روز -> ۲ از ۸',
    run: function () {
      const p = { id: 'p2', habitCount: 4 };
      const day = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
      const rec = { done: 2, hard: 0, special: 0 };
      const sc = Scoring.dayScore(p, rec, day);
      const mx = Scoring.dayMax(p, day, rec);
      return { pass: sc === 2 && mx === 8, detail: 'امتیاز: ' + sc + ' از ' + mx };
    }
  },
  {
    id: 3,
    title: '۳. habitCount=1, done=1, hard=2 در روز ۲ سطحی بدون مأموریت -> ۳ از ۳',
    run: function () {
      const p = { id: 'p3', habitCount: 1 };
      const day = { n: 10, type: 'main', hardLevels: 2, specialMission: false };
      const rec = { done: 1, hard: 2, special: 0 };
      const sc = Scoring.dayScore(p, rec, day);
      const mx = Scoring.dayMax(p, day, rec);
      return { pass: sc === 3 && mx === 3, detail: 'امتیاز: ' + sc + ' از ' + mx };
    }
  },
  {
    id: 4,
    title: '۴. روز بدون کار سخت (hardLevels=0) با مأموریت، habitCount=2, done=2, special=1 -> ۳ از ۳',
    run: function () {
      const p = { id: 'p4', habitCount: 2 };
      const day = { n: 11, type: 'main', hardLevels: 0, specialMission: true };
      const rec = { done: 2, hard: 0, special: 1 };
      const sc = Scoring.dayScore(p, rec, day);
      const mx = Scoring.dayMax(p, day, rec);
      return { pass: sc === 3 && mx === 3, detail: 'امتیاز: ' + sc + ' از ' + mx };
    }
  },
  {
    id: 5,
    title: '۵. hard بزرگتر از hardLevels امروز: به سقف روز clamp می‌شود',
    run: function () {
      const p = { id: 'p5', habitCount: 2 };
      const day = { n: 12, type: 'main', hardLevels: 1, specialMission: false };
      const rec = { done: 2, hard: 3, special: 0 };
      const sc = Scoring.dayScore(p, rec, day);
      return { pass: sc === 3, detail: 'امتیاز محاسبه شده: ' + sc + ' (سقف کار سخت: ۱)' };
    }
  },
  {
    id: 6,
    title: '۶. done بزرگتر از habitCount: validateRecord خطا می‌دهد و dayScore clamp می‌کند',
    run: function () {
      const p = { id: 'p6', habitCount: 2 };
      const day = { n: 13, type: 'main', hardLevels: 3, specialMission: true };
      const rec = { done: 4, hard: 1, special: 0 };
      const val = Scoring.validateRecord(p, rec, day);
      const sc = Scoring.dayScore(p, rec, day);
      return {
        pass: !val.valid && sc === 3,
        detail: 'خطا: ' + val.errors.join('، ') + ' | امتیاز کلَمپ شده: ' + sc
      };
    }
  },
  {
    id: 7,
    title: '۷. habitCount=null و done=2 -> حداکثر شامل ۲ عادت',
    run: function () {
      const p = { id: 'p7', habitCount: null };
      const day = { n: 14, type: 'main', hardLevels: 3, specialMission: true };
      const rec = { done: 2, hard: 1, special: 0 };
      const mx = Scoring.dayMax(p, day, rec);
      const sc = Scoring.dayScore(p, rec, day);
      return { pass: mx === 6 && sc === 3, detail: 'حداکثر: ' + mx + ' | امتیاز: ' + sc };
    }
  },
  {
    id: 8,
    title: '۸. روز warmup یا review: امتیاز و حداکثر هر دو صفر و در مجموع نیامده',
    run: function () {
      const p = { id: 'p8', habitCount: 3 };
      const w = { n: 3, type: 'warmup', hardLevels: 0, specialMission: false };
      const r = { n: 29, type: 'review', hardLevels: 0, specialMission: false };
      const rec = { done: 3, hard: 2, special: 1 };
      const scW = Scoring.dayScore(p, rec, w);
      const mxW = Scoring.dayMax(p, w, rec);
      const scR = Scoring.dayScore(p, rec, r);
      const mxR = Scoring.dayMax(p, r, rec);
      const ok = scW === 0 && mxW === 0 && scR === 0 && mxR === 0;
      return { pass: ok, detail: 'Warmup: ' + scW + '/' + mxW + ' | Review: ' + scR + '/' + mxR };
    }
  },
  {
    id: 9,
    title: '۹. روز باز در personTotals نیامده؛ روز بسته آمده',
    run: function () {
      const p = { id: 'p9', habitCount: 3 };
      const cohort = {
        days: [
          { n: 8, type: 'main', hardLevels: 3, specialMission: true },
          { n: 9, type: 'main', hardLevels: 3, specialMission: true }
        ],
        records: { p9: { 8: { done: 3, hard: 3, special: 1 }, 9: { done: 2, hard: 2, special: 0 } } }
      };
      const gOpen = { id: 'g1', closedDays: [] };
      const gClosed = { id: 'g1', closedDays: [8] };
      const resOpen = Scoring.personTotals(p, cohort, gOpen);
      const resClosed = Scoring.personTotals(p, cohort, gClosed);
      const ok = resOpen.totalScore === 0 && resClosed.totalScore === 7;
      return { pass: ok, detail: 'روز باز: ' + resOpen.totalScore + ' | روز بسته: ' + resClosed.totalScore };
    }
  },
  {
    id: 10,
    title: '۱۰. روز بسته‌شده و نفری که هیچ رکوردی ندارد -> امتیاز ۰، حداکثر = hardLevels + مأموریت',
    run: function () {
      const p = { id: 'p10', habitCount: null };
      const cohort = {
        days: [{ n: 8, type: 'main', hardLevels: 3, specialMission: true }],
        records: {}
      };
      const g = { id: 'g1', closedDays: [8] };
      const res = Scoring.personTotals(p, cohort, g);
      return {
        pass: res.totalScore === 0 && res.totalMax === 4,
        detail: 'امتیاز: ' + res.totalScore + ' از ' + res.totalMax
      };
    }
  },
  {
    id: 11,
    title: '۱۱. جمع تجمعی: روز ۸ با ۷ از ۷ و روز ۹ با ۳ از ۵ -> ۱۰ از ۱۲ و درصد ۸۳',
    run: function () {
      const p = { id: 'p11', habitCount: 3 };
      const cohort = {
        days: [
          { n: 8, type: 'main', hardLevels: 3, specialMission: true },
          { n: 9, type: 'main', hardLevels: 1, specialMission: true }
        ],
        records: { p11: { 8: { done: 3, hard: 3, special: 1 }, 9: { done: 2, hard: 1, special: 0 } } }
      };
      const g = { id: 'g1', closedDays: [8, 9] };
      const res = Scoring.personTotals(p, cohort, g);
      return {
        pass: res.totalScore === 10 && res.totalMax === 12 && res.percent === 83,
        detail: res.totalScore + ' از ' + res.totalMax + ' (' + res.percent + '٪)'
      };
    }
  },
  {
    id: 12,
    title: '۱۲. افراد frozen و left در groupSummary نیستند',
    run: function () {
      const cohort = {
        days: [{ n: 8, type: 'main', hardLevels: 3, specialMission: true }],
        participants: [
          { id: 'p1', groupId: 'g1', status: 'active', habitCount: 3 },
          { id: 'p2', groupId: 'g1', status: 'frozen', habitCount: 3 },
          { id: 'p3', groupId: 'g1', status: 'left', habitCount: 3 }
        ],
        records: {
          p1: { 8: { done: 3, hard: 3, special: 1 } },
          p2: { 8: { done: 3, hard: 3, special: 1 } },
          p3: { 8: { done: 3, hard: 3, special: 1 } }
        }
      };
      const g = { id: 'g1', closedDays: [8] };
      const s = Scoring.groupSummary(cohort, g, 8, false);
      return {
        pass: s.activeCount === 1 && s.totalScore === 7 && s.totalMax === 7,
        detail: 'امتیاز گروه فعال: ' + s.totalScore + ' از ' + s.totalMax
      };
    }
  },
  {
    id: 13,
    title: '۱۳. بستن روز و بازکردن دوباره‌اش مجموع را به‌روز می‌کند',
    run: function () {
      const p = { id: 'p13', habitCount: 3 };
      const cohort = {
        days: [{ n: 8, type: 'main', hardLevels: 3, specialMission: true }],
        records: { p13: { 8: { done: 3, hard: 3, special: 1 } } }
      };
      const g = { id: 'g1', closedDays: [8] };
      const t1 = Scoring.personTotals(p, cohort, g);
      g.closedDays = [];
      const t2 = Scoring.personTotals(p, cohort, g);
      return {
        pass: t1.totalScore === 7 && t2.totalScore === 0,
        detail: 'بسته: ' + t1.totalScore + ' -> باز: ' + t2.totalScore
      };
    }
  },
  {
    id: 14,
    title: '۱۴. تغییر hardLevels یک روزِ بسته بعد از ثبت، حداکثر و امتیاز را درست بازمحاسبه می‌کند',
    run: function () {
      const p = { id: 'p14', habitCount: 3 };
      const day = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
      const rec = { done: 3, hard: 3, special: 1 };
      const s1 = Scoring.dayScore(p, rec, day);
      day.hardLevels = 1;
      const s2 = Scoring.dayScore(p, rec, day);
      const m2 = Scoring.dayMax(p, day, rec);
      return {
        pass: s1 === 7 && s2 === 5 && m2 === 5,
        detail: 'سقف ۳: ' + s1 + ' -> سقف ۱: ' + s2 + ' از ' + m2
      };
    }
  },
  {
    id: 15,
    title: '۱۵. ورودی عددی با رقم فارسی یا عربی («۳» یا «٣») به عدد لاتین تبدیل می‌شود',
    run: function () {
      const p = { id: 'p15', habitCount: 3 };
      const day = { n: 8, type: 'main', hardLevels: 3, specialMission: true };
      const rFa = { done: '۳', hard: '۲', special: '۱' };
      const rAr = { done: '٣', hard: '٢', special: '١' };
      const sFa = Scoring.dayScore(p, rFa, day);
      const sAr = Scoring.dayScore(p, rAr, day);
      return { pass: sFa === 6 && sAr === 6, detail: 'فارسی: ' + sFa + ' | عربی: ' + sAr };
    }
  },
  {
    id: 16,
    title: '۱۶. تطابق کامل داده‌های گزارش تصویری Canvas با خروجی و محاسبات اکسل',
    run: function () {
      const cohort = {
        name: 'دوره ۱۲',
        startDate: '2026-03-21',
        days: [
          { n: 8, type: 'main', hardLevels: 3, specialMission: true },
          { n: 9, type: 'main', hardLevels: 2, specialMission: true }
        ],
        participants: [
          { id: 'p1', name: 'علی رضایی', groupId: 'g1', status: 'active', habitCount: 3 },
          { id: 'p2', name: 'زهرا موسوی', groupId: 'g1', status: 'active', habitCount: 4 },
          { id: 'p3', name: 'مهدی کریمی', groupId: 'g1', status: 'frozen', habitCount: 3 }
        ],
        records: {
          p1: { 8: { done: 3, hard: 3, special: 1 }, 9: { done: 2, hard: 1, special: 0 } },
          p2: { 8: { done: 2, hard: 0, special: 0 }, 9: { done: 4, hard: 2, special: 1 } },
          p3: { 8: { done: 3, hard: 3, special: 1 } }
        }
      };
      const group = { id: 'g1', name: 'گروه عقاب', closedDays: [8] };

      // تست ۱: بدون افراد فریز
      const reportData = ImageExport.getGroupDayReportRows(asCohort(cohort), group as Group, 8, false);
      if (reportData.rows.length !== 2) {
        return {
          pass: false,
          detail: 'تعداد اعضای فعال باید ۲ نفر باشد اما ' + reportData.rows.length + ' است.'
        };
      }

      const row1 = reportData.rows[0];
      // محاسبات برای روز ۸: p1 => done: 3, hard: 3, special: 1 -> dayScore: 7, dayMax: 7, totalScore: 7, totalMax: 7, percent: 100
      const ok1 = row1.dayScore === 7 && row1.dayMax === 7 && row1.totalScore === 7 && row1.percent === 100;

      const row2 = reportData.rows[1];
      // محاسبات برای روز ۸: p2 => done: 2, hard: 0, special: 0 -> dayScore: 2, dayMax: 8, totalScore: 2, totalMax: 8, percent: 25
      const ok2 = row2.dayScore === 2 && row2.dayMax === 8 && row2.totalScore === 2 && row2.percent === 25;

      // تست ۲: با افراد فریز
      const reportWithFrozen = ImageExport.getGroupDayReportRows(asCohort(cohort), group as Group, 8, true);
      const okFrozen = reportWithFrozen.rows.length === 3 && reportWithFrozen.rows[2].status === 'frozen';

      const allOk = ok1 && ok2 && okFrozen;
      return {
        pass: allOk,
        detail:
          'فرد ۱: ' +
          row1.dayScore +
          '/' +
          row1.dayMax +
          ' (' +
          row1.percent +
          '٪) | فرد ۲: ' +
          row2.dayScore +
          '/' +
          row2.dayMax +
          ' (' +
          row2.percent +
          '٪) | فریز: ' +
          reportWithFrozen.rows.length +
          ' نفر'
      };
    }
  },
  {
    id: 17,
    title: '۱۷. ادغام بکاپ: دورهٔ جدید اضافه می‌شود و دورهٔ تکراری با پیش‌فرض «رد کن» دست نمی‌خورد',
    run: function () {
      const mk = function (id: string, name: string, date: string) {
        return {
          id: id,
          name: name,
          startDate: date,
          days: [],
          groups: [{ id: 'g1', name: 'گروه ۱', mine: true }],
          participants: [{ id: 'p1', name: 'الف', groupId: 'g1' }],
          records: { p1: { 1: { done: 2 } } }
        };
      };
      const cur = { schemaVersion: 1, activeCohortId: 'a', cohorts: [mk('a', 'مهر', '2026-10-01')] };
      const incoming = [mk('a', 'مهر', '2026-10-01'), mk('b', 'آبان', '2026-11-01')];
      const before = JSON.stringify(cur);
      const r = Store.mergeCohorts(asState(cur), incoming.map(asCohort), {});
      const ok =
        r.state.cohorts.length === 2 &&
        r.report.added.length === 1 &&
        r.report.skipped.length === 1 &&
        JSON.stringify(cur) === before;
      return {
        pass: ok,
        detail:
          'دوره‌ها: ' +
          r.state.cohorts.length +
          ' | اضافه: ' +
          r.report.added.length +
          ' | ردشده: ' +
          r.report.skipped.length
      };
    }
  },
  {
    id: 18,
    title:
      '۱۸. ادغام بکاپ: «نسخهٔ جدا» شناسه و نام یکتا می‌سازد و افراد و رکوردها کامل کپی می‌شوند؛ «جایگزین» دورهٔ قبلی را کامل عوض می‌کند',
    run: function () {
      const mk = function (id: string, n: number) {
        return {
          id: id,
          name: 'مهر',
          startDate: '2026-10-01',
          days: [],
          groups: [{ id: 'g1', name: 'گروه ۱', mine: true }],
          participants: [
            { id: 'p1', name: 'الف', groupId: 'g1' },
            { id: 'p2', name: 'ب', groupId: 'g1' }
          ],
          records: { p1: { 1: { done: n } }, p2: { 1: { done: n } } }
        };
      };
      const cur = { schemaVersion: 1, activeCohortId: 'a', cohorts: [mk('a', 1)] };
      const copy = Store.mergeCohorts(asState(cur), [asCohort(mk('a', 3))], {
        decisions: { 0: 'copy' },
        newId: function () {
          return 'new1';
        }
      });
      const c2 = copy.state.cohorts[1];
      const okCopy =
        copy.state.cohorts.length === 2 &&
        c2.id === 'new1' &&
        c2.name !== 'مهر' &&
        c2.participants.length === 2 &&
        c2.records.p2[1].done === 3 &&
        copy.state.cohorts[0].records.p1[1].done === 1;
      const rep = Store.mergeCohorts(asState(cur), [asCohort(mk('zzz', 3))], { decisions: { 0: 'replace' } });
      const okRep = rep.state.cohorts.length === 1 && rep.state.cohorts[0].records.p1[1].done === 3;
      return {
        pass: okCopy && okRep,
        detail: 'نسخهٔ جدا: ' + c2.name + ' | جایگزینی: ' + (okRep ? 'درست' : 'نادرست')
      };
    }
  },
  {
    id: 19,
    title: '۱۹. ادغام بکاپ: برچسب «گروه من» قابل تغییر است و اعتبارسنجی فایل خراب را بدون تغییر رد می‌کند',
    run: function () {
      const inc = [
        {
          id: 'x',
          name: 'دی',
          startDate: '2027-01-01',
          days: [],
          groups: [{ id: 'g1', name: 'گروه ۱', mine: true }],
          participants: [],
          records: {}
        }
      ];
      const r = Store.mergeCohorts(
        asState({ schemaVersion: 1, activeCohortId: null, cohorts: [] }),
        inc.map(asCohort),
        {
          groupMine: { 0: { g1: false } }
        }
      );
      const okMine = r.state.cohorts[0].groups[0].mine === false && inc[0].groups[0].mine === true;
      const bad = Store.validateBackup({ schemaVersion: 1, cohorts: [{ id: 'x', name: 'دی', groups: [] }] });
      const good = Store.validateBackup({ schemaVersion: 1, cohorts: inc });
      return {
        pass: okMine && !bad.ok && good.ok,
        detail: 'مال من: ' + okMine + ' | خراب: ' + (bad.ok ? '' : bad.error)
      };
    }
  }
];

function TestApp() {
  const results = testDefinitions.map(function (t) {
    try {
      const res = t.run();
      return { id: t.id, title: t.title, pass: res.pass, detail: res.detail };
    } catch (e) {
      return { id: t.id, title: t.title, pass: false, detail: 'خطا: ' + errorMessage(e) };
    }
  });

  const passCount = results.filter(function (r) {
    return r.pass;
  }).length;
  const allPassed = passCount === results.length;

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="heading-lg">آزمون‌های موتور محاسبات بوشیدو</h1>
          <p className="body-sm" style={{ color: 'var(--text-muted)' }}>
            بررسی ۱۵ قانون اجباری امتیازدهی طبق بخش ۵ سند SPEC
          </p>
        </div>
        <B.Button variant="secondary" href="index.html" iconStart="ArrowLeft">
          بازگشت به برنامه
        </B.Button>
      </div>
      <B.Card padding="lg">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <B.Badge
              intent={allPassed ? 'success' : 'danger'}
              emphasis="bold"
              icon={allPassed ? 'CircleCheck' : 'OctagonAlert'}
            >
              {allPassed ? 'همه آزمون‌ها با موفقیت پاس شدند' : 'خطا در برخی آزمون‌ها'}
            </B.Badge>
            <span className="numeric-md">{B.toFa(passCount) + ' از ' + B.toFa(results.length)}</span>
          </div>
          <B.Button
            variant="ghost"
            size="sm"
            onClick={function () {
              window.location.reload();
            }}
          >
            اجرای مجدد
          </B.Button>
        </div>
      </B.Card>
      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        {results.map(function (r) {
          return (
            <B.Card
              key={r.id}
              padding="md"
              style={{
                borderRight: '4px solid ' + (r.pass ? 'var(--emerald-500)' : 'var(--crimson-500)')
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="body-md" style={{ fontWeight: 600 }}>
                    {r.title}
                  </div>
                  <div
                    className="caption"
                    style={{ color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}
                  >
                    {r.detail}
                  </div>
                </div>
                <B.Badge
                  intent={r.pass ? 'success' : 'danger'}
                  emphasis="subtle"
                  icon={r.pass ? 'Check' : 'X'}
                >
                  {r.pass ? 'موفق' : 'ناموفق'}
                </B.Badge>
              </div>
            </B.Card>
          );
        })}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<TestApp />);
