/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, type ChangeEvent } from 'react';
import { B } from './bushido';
import { HelpHint } from './help-hint';
import { MergePanel } from './ui-merge-panel';
import { defaultPlan } from './merge-groups';
import type { MergePlan } from './merge-groups';
import { Names } from './names';
import { errorMessage } from './errors';
import { Store } from './store';
import { downloadBeforeRestoreBackup } from './ui-common';
import type { AppState, Cohort, MergeDecision, Toast } from './types';

/**
 * دیالوگ ساخت یا ویرایش دوره
 */
interface CohortModalProps {
  open: boolean;
  onClose: () => void;
  cohort: Cohort | null;
  existingCohorts?: Cohort[];
  toast?: Toast;
}

function CohortModal(props: CohortModalProps) {
  const open = props.open;
  const onClose = props.onClose;
  const cohort = props.cohort; // null برای ساخت، شیء برای ویرایش
  const existingCohorts = props.existingCohorts || [];

  const isEdit = !!cohort;

  const [name, setName] = useState(isEdit ? cohort.name : 'دوره آبان ۱۴۰۵');
  const [startDate, setStartDate] = useState(isEdit ? new Date(cohort.startDate) : new Date());
  const [warmupDays, setWarmupDays] = useState<number | string>(7);
  const [mainDays, setMainDays] = useState<number | string>(21);
  const [reviewDays, setReviewDays] = useState<number | string>(2);
  const [copyFromPrevious, setCopyFromPrevious] = useState(false);
  const [copyCohortId, setCopyCohortId] = useState(existingCohorts[0] ? existingCohorts[0].id : '');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(
    function () {
      if (open) {
        if (cohort) {
          setName(cohort.name);
          setStartDate(new Date(cohort.startDate));
        } else {
          setName('دوره ' + Names.formatShamsi(new Date(), { month: 'long', year: 'numeric' }));
          setStartDate(new Date());
          setWarmupDays(7);
          setMainDays(21);
          setReviewDays(2);
          setCopyFromPrevious(false);
          setCopyCohortId(existingCohorts[0] ? existingCohorts[0].id : '');
        }
        setErrorMsg('');
      }
    },
    [open, cohort]
  );

  if (!open) return null;

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg('نام دوره را بنویس.');
      return;
    }

    const isoStart = startDate ? startDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

    if (isEdit) {
      Store.updateCohort(cohort.id, {
        name: trimmed,
        startDate: isoStart
      });
    } else {
      Store.createCohort({
        name: trimmed,
        startDate: isoStart,
        warmupDays: parseInt(String(warmupDays), 10) || 7,
        mainDays: parseInt(String(mainDays), 10) || 21,
        reviewDays: parseInt(String(reviewDays), 10) || 2,
        copyFromCohortId: copyFromPrevious ? copyCohortId : null
      });
    }
    onClose();
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
      <B.Button variant="ghost" onClick={onClose}>
        انصراف
      </B.Button>
      <B.Button variant="primary" onClick={handleSave}>
        {isEdit ? 'ذخیره تغییرات' : 'ساخت دوره'}
      </B.Button>
    </div>
  );

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'ویرایش دوره' : 'ساخت دوره جدید'}
      description={
        isEdit ? 'نام یا تاریخ شروع دوره را عوض کن.' : 'نام و تاریخ شروع را بنویس. دوره ۳۰ روز است.'
      }
      footer={footer}
      size="md"
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' }}>
        {errorMsg && <B.Alert intent="danger">{errorMsg}</B.Alert>}
        <B.TextField
          label="نام دوره"
          value={name}
          onChange={function (e) {
            setName(e.target.value);
          }}
          required={true}
          placeholder="مثلاً: دوره آبان ۱۴۰۵"
        />
        <B.DatePicker
          label="تاریخ شروع دوره"
          value={startDate}
          onChange={function (d) {
            setStartDate(d);
          }}
        />
        {!isEdit && (
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <div className="bsh-help-row">
              <HelpHint help="dayTypes" visibleLabel />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
              <B.TextField
                label="روز گرم‌کردن"
                type="number"
                value={warmupDays}
                onChange={function (e) {
                  setWarmupDays(e.target.value);
                }}
              />
              <B.TextField
                label="روز اصلی"
                type="number"
                value={mainDays}
                onChange={function (e) {
                  setMainDays(e.target.value);
                }}
              />
              <B.TextField
                label="روز مرور"
                type="number"
                value={reviewDays}
                onChange={function (e) {
                  setReviewDays(e.target.value);
                }}
              />
            </div>
          </div>
        )}
        {!isEdit && existingCohorts.length > 0 && (
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <B.Checkbox
              label="گروه‌ها و افراد را از دورهٔ دیگری کپی کن"
              checked={copyFromPrevious}
              onChange={function (e) {
                setCopyFromPrevious(e.target.checked);
              }}
            />
            {copyFromPrevious && (
              <B.Select
                label="کپی از کدام دوره؟"
                options={existingCohorts.map(function (c) {
                  return { value: c.id, label: c.name };
                })}
                value={copyCohortId}
                onChange={function (e) {
                  setCopyCohortId(e.target.value);
                }}
              />
            )}
          </div>
        )}
      </div>
    </B.Dialog>
  );
}

/**
 * صفحه خالی در صورت نبود هیچ دوره‌ای
 */
function EmptyCohortState(props: {
  onCreateCohort: () => void;
  onRestoreBackup: () => void;
  onImport: () => void;
}) {
  const onCreateCohort = props.onCreateCohort;
  const onRestoreBackup = props.onRestoreBackup;
  const onImport = props.onImport;

  const action = (
    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
      <B.Button variant="primary" iconStart="Plus" onClick={onCreateCohort}>
        ساخت دوره
      </B.Button>
      <B.Button variant="secondary" iconStart="ExternalLink" onClick={onRestoreBackup}>
        بازگردانی بکاپ
      </B.Button>
      <B.Button variant="secondary" iconStart="Inbox" onClick={onImport}>
        ورود افراد از Excel یا CSV
      </B.Button>
    </div>
  );

  return (
    <div
      style={{
        maxWidth: 640,
        margin: 'var(--space-12) auto',
        padding: '0 var(--space-4)'
      }}
    >
      <B.EmptyState
        icon="Flame"
        title="هنوز دوره‌ای نیست"
        description="یک دوره بساز، یا اگر بکاپ داری آن را بازگردانی کن."
        action={action}
      />
    </div>
  );
}

/**
 * دیالوگ بازگردانی از بکاپ: «افزودن به داده‌های فعلی» (پیش‌فرض) یا «جایگزینی کامل»
 */
function RestoreBackupModal(props: { open: boolean; onClose: () => void; toast?: Toast }) {
  const open = props.open;
  const onClose = props.onClose;
  const toast = props.toast;

  const [backup, setBackup] = useState<AppState | null>(null); // دادهٔ اعتبارسنجی‌شده (کپی)
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState('merge');
  const [selected, setSelected] = useState<Record<number, boolean>>({}); // { [اندیس دوره]: bool }
  const [decisions, setDecisions] = useState<Record<number, MergeDecision>>({}); // { [اندیس دوره]: skip|replace|copy }
  const [names, setNames] = useState<Record<number, string>>({}); // { [اندیس دوره]: نام قابل‌ویرایش }
  const [groupMine, setGroupMine] = useState<Record<number, Record<string, boolean>>>({}); // { [اندیس دوره]: { [شناسه گروه]: bool } }
  const [cohortTarget, setCohortTarget] = useState<Record<number, string>>({}); // { [اندیس دوره]: 'separate' | شناسهٔ دورهٔ فعلی }
  const [plans, setPlans] = useState<Record<number, MergePlan>>({}); // برنامهٔ ادغام هر دوره

  useEffect(
    function () {
      if (open) {
        setBackup(null);
        setFileName('');
        setErrorMsg('');
        setMode('merge');
        setSelected({});
        setCohortTarget({});
        setPlans({});
        setDecisions({});
        setGroupMine({});
        setNames({});
      }
    },
    [open]
  );

  if (!open) return null;

  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg('');
    setBackup(null);

    if (/\.(xlsx|xls|csv|numbers)$/i.test(file.name)) {
      setErrorMsg(
        'این فایل Excel یا CSV است، نه بکاپ. برای وارد کردن افراد از «ابزارها ← ورود افراد از Excel یا CSV» استفاده کن.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = function (ev) {
      let json: unknown;
      try {
        json = JSON.parse(String(ev.target?.result));
      } catch (err) {
        setErrorMsg('این فایل خوانده نشد. فایل بکاپ را انتخاب کن (پسوند json).');
        return;
      }
      const v = Store.validateBackup(json);
      if (!v.ok) {
        setErrorMsg(v.error + ' چیزی در برنامه عوض نشد.');
        return;
      }
      const sel: Record<number, boolean> = {};
      const dec: Record<number, MergeDecision> = {};
      const mine: Record<number, Record<string, boolean>> = {};
      const nm: Record<number, string> = {};
      const tgt: Record<number, string> = {};
      const pl: Record<number, MergePlan> = {};
      const nowCohorts = Store.getState().cohorts || [];
      v.data.cohorts.forEach(function (c, i) {
        sel[i] = true;
        dec[i] = 'skip';
        // هم‌نام و هم‌تاریخ (با نرمال‌سازی) = ادغام در همان دوره؛ وگرنه دورهٔ جدا
        const ti = Store.findMergeTarget(nowCohorts, c);
        tgt[i] = ti !== -1 ? nowCohorts[ti].id : 'separate';
        if (ti !== -1) pl[i] = defaultPlan(nowCohorts[ti], c);
        mine[i] = {};
        c.groups.forEach(function (g) {
          mine[i][g.id] = g.mine !== false;
        });
      });
      setSelected(sel);
      setDecisions(dec);
      setGroupMine(mine);
      setCohortTarget(tgt);
      setPlans(pl);
      setNames(nm);
      setBackup(v.data);
    };
    reader.onerror = function () {
      setErrorMsg('فایل خوانده نشد. دوباره انتخابش کن.');
    };
    reader.readAsText(file, 'utf-8');
  }

  function setIn<T>(
    setter: (v: Record<number, T>) => void,
    current: Record<number, T>,
    key: number,
    value: T
  ) {
    const next = Object.assign({}, current);
    next[key] = value;
    setter(next);
  }

  function setAllMine(idx: number, groups: { id: string }[], value: boolean) {
    const inner: Record<string, boolean> = {};
    groups.forEach(function (g) {
      inner[g.id] = value;
    });
    setIn(setGroupMine, groupMine, idx, inner);
  }

  function setMine(idx: number, groupId: string, value: boolean) {
    const inner = Object.assign({}, groupMine[idx]);
    inner[groupId] = value;
    setIn(setGroupMine, groupMine, idx, inner);
  }

  const currentCohorts = Store.getState().cohorts || [];
  const cohorts: Cohort[] = backup ? backup.cohorts : [];
  const selectedCount = cohorts.filter(function (c, i) {
    return selected[i];
  }).length;

  function handleConfirm() {
    if (!backup) return;
    try {
      if (mode === 'replace') {
        if (currentCohorts.length) downloadBeforeRestoreBackup();
        Store.restoreState(backup);
        if (toast) toast.show({ intent: 'success', message: 'اطلاعات با فایل بکاپ جایگزین شد.' });
      } else {
        const targets: Record<number, string | null> = {};
        let willModify = false;
        cohorts.forEach(function (c, i) {
          if (!selected[i]) return;
          const t = cohortTarget[i];
          targets[i] = t && t !== 'separate' ? t : null;
          if (targets[i] || decisions[i] === 'replace') willModify = true;
        });
        // مثل جایگزینی کامل: پیش از دست‌زدن به دورهٔ موجود، یک نسخهٔ احتیاطی بگیر
        if (willModify && currentCohorts.length) downloadBeforeRestoreBackup();
        const report = Store.mergeFromBackup(backup, {
          selected: selected,
          decisions: decisions,
          groupMine: groupMine,
          rename: names,
          targets: targets,
          plans: plans
        });
        const parts = [];
        report.merged.forEach(function (m) {
          const s = m.stats;
          parts.push(
            s.nothingNew
              ? '«' + m.name + '»: چیز تازه‌ای نبود'
              : '«' +
                  m.into +
                  '»: ' +
                  Names.toPersianDigits(s.groupsAdded) +
                  ' گروه، ' +
                  Names.toPersianDigits(s.peopleAdded) +
                  ' نفر، ' +
                  Names.toPersianDigits(s.recordsAdded + s.recordsReplaced) +
                  ' رکورد اضافه شد'
          );
          if (s.overlaps.length)
            parts.push(Names.toPersianDigits(s.overlaps.length) + ' نفر در دو گروه هستند');
        });
        if (report.added.length) parts.push(Names.toPersianDigits(report.added.length) + ' دوره اضافه شد');
        if (report.replaced.length)
          parts.push(Names.toPersianDigits(report.replaced.length) + ' دوره جایگزین شد');
        if (report.copied.length)
          parts.push(Names.toPersianDigits(report.copied.length) + ' نسخهٔ جدا ساخته شد');
        if (report.skipped.length) parts.push(Names.toPersianDigits(report.skipped.length) + ' دوره رد شد');
        if (toast) toast.show({ intent: 'success', message: parts.join('، ') + '.' });
      }
      onClose();
    } catch (err) {
      setErrorMsg('بکاپ اعمال نشد: ' + errorMessage(err) + ' چیزی در برنامه عوض نشد.');
    }
  }

  const isMerge = mode === 'merge';
  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
      <B.Button variant="ghost" onClick={onClose}>
        انصراف
      </B.Button>
      <B.Button
        variant={isMerge ? 'primary' : 'danger-bold'}
        disabled={!backup || (isMerge && selectedCount === 0)}
        onClick={handleConfirm}
      >
        {isMerge ? 'به داده‌های فعلی اضافه کن' : 'همه‌چیز را جایگزین کن'}
      </B.Button>
    </div>
  );

  function renderCohortCard(c: Cohort, i: number) {
    const groupsCount = c.groups.length;
    const peopleCount = c.participants.length;
    const shownName = names[i] !== undefined ? names[i] : c.name;
    const mergeTargetId = cohortTarget[i] && cohortTarget[i] !== 'separate' ? cohortTarget[i] : '';
    const mergeTarget = currentCohorts.find(function (x) {
      return x.id === mergeTargetId;
    });
    const conflict =
      isMerge &&
      !mergeTarget &&
      Store.findConflictIndex(currentCohorts, { ...c, name: shownName.trim() || c.name }) !== -1;
    const isSelected = !!selected[i];

    return (
      <B.Card key={c.id + '_' + i} padding="md">
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <B.Checkbox
            label={c.name}
            checked={isSelected}
            onChange={function (e) {
              setIn(setSelected, selected, i, e.target.checked);
            }}
          />
          {isSelected && currentCohorts.length > 0 && (
            <B.Select
              label="این دوره چه شود؟"
              options={[{ value: 'separate', label: 'دورهٔ جدا بساز' }].concat(
                currentCohorts.map(function (x) {
                  return { value: x.id, label: 'ادغام در دورهٔ: ' + x.name };
                })
              )}
              value={cohortTarget[i] || 'separate'}
              onChange={function (e) {
                const v = e.target.value;
                setIn(setCohortTarget, cohortTarget, i, v);
                const ct = currentCohorts.find(function (x) {
                  return x.id === v;
                });
                if (ct) setIn(setPlans, plans, i, defaultPlan(ct, c));
              }}
            />
          )}
          {isSelected && mergeTarget && plans[i] && (
            <MergePanel
              current={mergeTarget}
              file={c}
              plan={plans[i]}
              onChange={function (p) {
                setIn(setPlans, plans, i, p);
              }}
            />
          )}
          {isSelected && !mergeTarget && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minInlineSize: 0 }}>
                <B.TextField
                  label="نام دوره (می‌توانی عوضش کنی)"
                  value={shownName}
                  onChange={function (e) {
                    setIn(setNames, names, i, e.target.value);
                  }}
                />
              </div>
              <B.Button
                variant="ghost"
                size="sm"
                onClick={function () {
                  setIn(setNames, names, i, Names.cohortNameFromFileName(fileName) || c.name);
                }}
              >
                نام از فایل
              </B.Button>
            </div>
          )}
          <div className="caption" style={{ color: 'var(--text-subtle)' }}>
            {Names.toPersianDigits(groupsCount) +
              ' گروه · ' +
              Names.toPersianDigits(peopleCount) +
              ' نفر · شروع ' +
              (c.startDate ? Names.formatShamsi(c.startDate) : 'نامشخص')}
          </div>
          {isSelected && conflict && (
            <B.Alert intent="warning" title="این دوره از قبل هست">
              <B.RadioGroup
                name={'dup-' + i}
                orientation="vertical"
                value={decisions[i] || 'skip'}
                onChange={function (v) {
                  setIn(setDecisions, decisions, i, v as MergeDecision);
                }}
                options={[
                  { value: 'skip', label: 'رد کن (دورهٔ فعلی می‌ماند)' },
                  { value: 'replace', label: 'جایگزین کن (با نسخهٔ فایل عوض می‌شود)' },
                  { value: 'copy', label: 'نسخهٔ جدا بساز (هر دو می‌مانند)' }
                ]}
              />
              <HelpHint help="restoreConflict" visibleLabel />
            </B.Alert>
          )}
          {isSelected && !mergeTarget && groupsCount > 0 && (
            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <B.Button
                  variant="ghost"
                  size="sm"
                  onClick={function () {
                    setAllMine(i, c.groups, true);
                  }}
                >
                  همه را بزن
                </B.Button>
                <B.Button
                  variant="ghost"
                  size="sm"
                  onClick={function () {
                    setAllMine(i, c.groups, false);
                  }}
                >
                  همه را بردار
                </B.Button>
                <HelpHint help="mine" visibleLabel />
              </div>
              {c.groups.map(function (g) {
                const members = c.participants.filter(function (p) {
                  return p.groupId === g.id;
                }).length;
                const mineMap = groupMine[i] || {};
                return (
                  <B.Checkbox
                    key={g.id}
                    label={'گروه من — ' + g.name + ' (' + Names.toPersianDigits(members) + ' نفر)'}
                    checked={mineMap[g.id] !== false}
                    onChange={function (e) {
                      setMine(i, g.id, e.target.checked);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </B.Card>
    );
  }

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title="بازگردانی از فایل پشتیبان (JSON)"
      description="فایل بکاپ را انتخاب کن، بعد بگو با اطلاعات فعلی چه شود."
      footer={footer}
      size="lg"
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' }}>
        {errorMsg && <B.Alert intent="danger">{errorMsg}</B.Alert>}
        <div>
          <label className="label-md" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
            فایل بکاپ (json)
          </label>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelected}
            style={{ display: 'block', width: '100%', color: 'var(--text-default)' }}
          />
        </div>
        <B.RadioGroup
          legend="با اطلاعات فعلی چه شود؟"
          name="restore-mode"
          orientation="vertical"
          value={mode}
          onChange={function (v) {
            setMode(v);
          }}
          options={[
            {
              value: 'merge',
              label: (
                <span>
                  <strong>اضافه کن (پیشنهادی)</strong>
                  <br />
                  <span className="caption" style={{ color: 'var(--text-subtle)' }}>
                    دوره‌های فایل کنار دوره‌های فعلی می‌آیند. چیزی پاک نمی‌شود.
                  </span>
                </span>
              )
            },
            {
              value: 'replace',
              label: (
                <span>
                  <strong>جایگزین کن</strong>
                  <br />
                  <span className="caption" style={{ color: 'var(--text-subtle)' }}>
                    همهٔ اطلاعات فعلی پاک و با فایل عوض می‌شود.
                  </span>
                </span>
              )
            }
          ]}
        />
        <div className="bsh-help-row">
          <HelpHint help="restoreMode" visibleLabel />
        </div>
        {!isMerge && (
          <B.Alert intent="warning">
            قبل از جایگزینی، یک نسخهٔ احتیاطی از اطلاعات فعلی دانلود می‌شود
            (support-before-restore-تاریخ.json). نگهش دار تا اگر لازم شد برگردانی.
          </B.Alert>
        )}
        {backup && (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <div className="title">
              {isMerge ? 'دوره‌های داخل فایل (' + fileName + ')' : 'محتوای فایل (' + fileName + ')'}
            </div>
            {cohorts.length === 0 && (
              <B.Alert intent="info">این فایل دوره‌ای ندارد. بکاپ دیگری را امتحان کن.</B.Alert>
            )}
            {isMerge ? (
              cohorts.map(renderCohortCard)
            ) : (
              <B.Card padding="md">
                {cohorts.map(function (c, i) {
                  return (
                    <div key={i} className="body-sm">
                      {c.name +
                        ' — ' +
                        Names.toPersianDigits(c.groups.length) +
                        ' گروه، ' +
                        Names.toPersianDigits(c.participants.length) +
                        ' نفر'}
                    </div>
                  );
                })}
              </B.Card>
            )}
            {(backup.exportedAt || backup.lastBackupAt) && (
              <div className="caption" style={{ color: 'var(--text-subtle)' }}>
                {'ساخته‌شده در: ' + Names.formatShamsi(backup.exportedAt || backup.lastBackupAt)}
              </div>
            )}
          </div>
        )}
      </div>
    </B.Dialog>
  );
}

export { CohortModal, EmptyCohortState, RestoreBackupModal };
