/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, type ChangeEvent } from 'react';
import { B } from './bushido';
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
      setErrorMsg('نام دوره نمی‌تواند خالی باشد.');
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
        isEdit ? 'نام و تاریخ شروع دوره را تغییر دهید.' : 'مشخصات اولیه دوره ۳۰ روزه را وارد کنید.'
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
          placeholder="مثلاً: دوره ۳۰ روزه آبان"
        />
        <B.DatePicker
          label="تاریخ شروع دوره"
          value={startDate}
          onChange={function (d) {
            setStartDate(d);
          }}
        />
        {!isEdit && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
            <B.TextField
              label="روزهای گرم‌کردن"
              type="number"
              value={warmupDays}
              onChange={function (e) {
                setWarmupDays(e.target.value);
              }}
            />
            <B.TextField
              label="روزهای اصلی"
              type="number"
              value={mainDays}
              onChange={function (e) {
                setMainDays(e.target.value);
              }}
            />
            <B.TextField
              label="روزهای مرور"
              type="number"
              value={reviewDays}
              onChange={function (e) {
                setReviewDays(e.target.value);
              }}
            />
          </div>
        )}
        {!isEdit && existingCohorts.length > 0 && (
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <B.Checkbox
              label="گروه‌ها و افراد از دوره قبل کپی شوند"
              checked={copyFromPrevious}
              onChange={function (e) {
                setCopyFromPrevious(e.target.checked);
              }}
            />
            {copyFromPrevious && (
              <B.Select
                label="انتخاب دوره مبدأ برای کپی"
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
        بازگردانی از بکاپ
      </B.Button>
      <B.Button variant="secondary" iconStart="Inbox" onClick={onImport}>
        ورود از اکسل / CSV
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
        title="هنوز هیچ دوره‌ای ایجاد نشده است"
        description="برای شروع کار با ابزار پشتیبان‌ها، دوره جدید بسازید یا فایل بکاپ قبلی خود را بازگردانی کنید."
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

  useEffect(
    function () {
      if (open) {
        setBackup(null);
        setFileName('');
        setErrorMsg('');
        setMode('merge');
        setSelected({});
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
        'این فایل اکسل یا CSV است، نه بکاپ. برای ورود لیست افراد از «ابزارها ← ورود از اکسل / CSV» استفاده کنید.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = function (ev) {
      let json: unknown;
      try {
        json = JSON.parse(String(ev.target?.result));
      } catch (err) {
        setErrorMsg('این فایل خوانده نشد. مطمئن شوید فایل بکاپ (با پسوند json) را انتخاب کرده‌اید.');
        return;
      }
      const v = Store.validateBackup(json);
      if (!v.ok) {
        setErrorMsg(v.error + ' هیچ تغییری در اطلاعات شما اعمال نشد.');
        return;
      }
      const sel: Record<number, boolean> = {};
      const dec: Record<number, MergeDecision> = {};
      const mine: Record<number, Record<string, boolean>> = {};
      const nm: Record<number, string> = {};
      v.data.cohorts.forEach(function (c, i) {
        sel[i] = true;
        dec[i] = 'skip';
        mine[i] = {};
        c.groups.forEach(function (g) {
          mine[i][g.id] = g.mine !== false;
        });
      });
      setSelected(sel);
      setDecisions(dec);
      setGroupMine(mine);
      setNames(nm);
      setBackup(v.data);
    };
    reader.onerror = function () {
      setErrorMsg('خطا در خواندن فایل.');
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
        if (toast) toast.show({ intent: 'success', message: 'اطلاعات با موفقیت جایگزین شد.' });
      } else {
        const report = Store.mergeFromBackup(backup, {
          selected: selected,
          decisions: decisions,
          groupMine: groupMine,
          rename: names
        });
        const parts = [];
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
      setErrorMsg('خطا در اعمال بکاپ: ' + errorMessage(err));
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
        {isMerge ? 'افزودن به داده‌های فعلی' : 'تأیید و جایگزینی کامل'}
      </B.Button>
    </div>
  );

  function renderCohortCard(c: Cohort, i: number) {
    const groupsCount = c.groups.length;
    const peopleCount = c.participants.length;
    const shownName = names[i] !== undefined ? names[i] : c.name;
    const conflict =
      isMerge && Store.findConflictIndex(currentCohorts, { ...c, name: shownName.trim() || c.name }) !== -1;
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
          {isSelected && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minInlineSize: 0 }}>
                <B.TextField
                  label="نام دوره (قابل تغییر)"
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
                نام فایل
              </B.Button>
            </div>
          )}
          <div className="caption" style={{ color: 'var(--text-subtle)' }}>
            {Names.toPersianDigits(groupsCount) +
              ' گروه · ' +
              Names.toPersianDigits(peopleCount) +
              ' نفر · شروع: ' +
              (c.startDate ? Names.formatShamsi(c.startDate) : 'نامشخص')}
          </div>
          {isSelected && conflict && (
            <B.Alert intent="warning" title="این دوره از قبل در برنامه هست">
              <B.RadioGroup
                name={'dup-' + i}
                orientation="vertical"
                value={decisions[i] || 'skip'}
                onChange={function (v) {
                  setIn(setDecisions, decisions, i, v as MergeDecision);
                }}
                options={[
                  { value: 'skip', label: 'رد کن (دورهٔ فعلی دست‌نخورده می‌ماند)' },
                  { value: 'replace', label: 'جایگزین کن (دورهٔ فعلی با این نسخه عوض می‌شود)' },
                  { value: 'copy', label: 'نسخهٔ جدا بساز (نام با پسوند ـ۲)' }
                ]}
              />
            </B.Alert>
          )}
          {isSelected && groupsCount > 0 && (
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
              </div>
              {c.groups.map(function (g) {
                const members = c.participants.filter(function (p) {
                  return p.groupId === g.id;
                }).length;
                const mineMap = groupMine[i] || {};
                return (
                  <B.Checkbox
                    key={g.id}
                    label={'مال من است — ' + g.name + ' (' + Names.toPersianDigits(members) + ' نفر)'}
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
      description="ابتدا فایل بکاپ را انتخاب کنید، سپس بگویید با اطلاعات فعلی چه شود."
      footer={footer}
      size="lg"
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' }}>
        {errorMsg && <B.Alert intent="danger">{errorMsg}</B.Alert>}
        <div>
          <label className="label-md" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
            انتخاب فایل JSON بکاپ
          </label>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelected}
            style={{ display: 'block', width: '100%', color: 'var(--text-default)' }}
          />
        </div>
        <B.RadioGroup
          legend="روش بازگردانی"
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
                  <strong>افزودن به داده‌های فعلی (پیشنهادی)</strong>
                  <br />
                  <span className="caption" style={{ color: 'var(--text-subtle)' }}>
                    دوره‌های فایل کنار دوره‌های فعلی اضافه می‌شوند و چیزی پاک نمی‌شود.
                  </span>
                </span>
              )
            },
            {
              value: 'replace',
              label: (
                <span>
                  <strong>جایگزینی کامل</strong>
                  <br />
                  <span className="caption" style={{ color: 'var(--text-subtle)' }}>
                    همهٔ اطلاعات فعلی پاک و با محتوای فایل عوض می‌شود.
                  </span>
                </span>
              )
            }
          ]}
        />
        {!isMerge && (
          <B.Alert intent="warning">
            پیش از جایگزینی، خودکار یک فایل از اطلاعات فعلی با نام support-before-restore-تاریخ.json دانلود
            می‌شود. آن را نگه دارید تا اگر لازم شد، برگردانید.
          </B.Alert>
        )}
        {backup && (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <div className="title">
              {isMerge ? 'دوره‌های داخل فایل (' + fileName + ')' : 'محتوای فایل (' + fileName + ')'}
            </div>
            {cohorts.length === 0 && <B.Alert intent="info">این فایل هیچ دوره‌ای ندارد.</B.Alert>}
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
                {'تاریخ ساخت فایل: ' + Names.formatShamsi(backup.exportedAt || backup.lastBackupAt)}
              </div>
            )}
          </div>
        )}
      </div>
    </B.Dialog>
  );
}

export { CohortModal, EmptyCohortState, RestoreBackupModal };
