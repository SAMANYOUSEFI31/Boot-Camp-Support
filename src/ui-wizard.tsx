/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, type ChangeEvent } from 'react';
import { B } from './bushido';
import { HelpHint } from './help-hint';
import { Names } from './names';
import { errorMessage } from './errors';
import { Store } from './store';
import { Importer, type GroupConfig, type ImportFile, type ImportReport } from './importer';
import type { Cohort, Toast } from './types';

/**
 * ویزارد ۴ مرحله‌ای ورود از اکسل / CSV
 */
interface ImportWizardModalProps {
  open: boolean;
  cohorts: Cohort[];
  activeCohortId: string | null;
  onClose: () => void;
  toast?: Toast;
}

function ImportWizardModal(props: ImportWizardModalProps) {
  const open = props.open;
  const cohorts = props.cohorts;
  const activeCohortId = props.activeCohortId;
  const onClose = props.onClose;
  const toast = props.toast;

  const [step, setStep] = useState(1); // 1: انتخاب فایل, 2: پیش‌نمایش, 3: مغایرت‌ها, 4: تأیید
  const [filesData, setFilesData] = useState<ImportFile[]>([]);
  const [analyzedReport, setAnalyzedReport] = useState<ImportReport | null>(null);
  const [groupConfigMap, setGroupConfigMap] = useState<Record<string, GroupConfig>>({}); // { [groupId]: { name, mine, selected } }
  // مقصد ورود: یک دورهٔ موجود، یا ساخت دورهٔ تازه (نام پیش‌فرض از نام فایل)
  const [target, setTarget] = useState<'existing' | 'new'>('existing');
  const [targetCohortId, setTargetCohortId] = useState('');
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(
    function () {
      if (open) {
        setStep(1);
        setFilesData([]);
        setAnalyzedReport(null);
        setGroupConfigMap({});
        setTarget('existing');
        setTargetCohortId('');
        setNewName('');
        setNewStartDate(new Date());
        setLoading(false);
        setErrorMsg('');
      }
    },
    [open]
  );

  if (!open) return null;

  // پیش‌فرض مقصد: اگر نام فایل با دوره‌ای یکی بود همان؛ وگرنه دورهٔ فعال؛ وگرنه ساخت دورهٔ تازه
  function initTarget(files: ImportFile[]) {
    const primary = files.find((f) => f.detectedType === 'grouping_table') || files[0];
    const guess = Names.cohortNameFromFileName(primary ? primary.fileName : '');
    const same = cohorts.find((c) => c.name.trim() === guess);
    const fallback = cohorts.find((c) => c.id === activeCohortId) || cohorts[0];
    setNewName(guess);
    if (same) {
      setTarget('existing');
      setTargetCohortId(same.id);
    } else if (fallback) {
      setTarget('existing');
      setTargetCohortId(fallback.id);
    } else {
      setTarget('new');
      setTargetCohortId('');
    }
  }

  // ۱. پردازش فایل‌های آپلود شده
  function handleFilesChosen(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    processSelectedFiles(files);
  }

  function processSelectedFiles(files: File[]) {
    setLoading(true);
    setErrorMsg('');

    const readPromises = files.map(function (f) {
      return Importer.readFileData(f);
    });

    Promise.all(readPromises)
      .then(function (results) {
        const parsedFiles = results.map(function (res) {
          const detected = Importer.detectStructureType(res.rawRows);
          return {
            fileName: res.fileName,
            detectedType: detected,
            rawRows: res.rawRows
          };
        });

        const analysis = Importer.analyzeImport(parsedFiles);

        // آماده‌سازی تنظیمات اولیه گروه‌ها
        const initialGroupConfig: Record<string, GroupConfig> = {};
        analysis.groups.forEach(function (g) {
          initialGroupConfig[g.id] = {
            name: g.name,
            mine: true,
            selected: true
          };
        });

        initTarget(parsedFiles);
        setFilesData(parsedFiles);
        setAnalyzedReport(analysis);
        setGroupConfigMap(initialGroupConfig);
        setLoading(false);
        setStep(2);
      })
      .catch(function (err) {
        setLoading(false);
        setErrorMsg('فایل خوانده نشد: ' + errorMessage(err) + ' فایل دیگری را امتحان کن.');
      });
  }

  // بارگذاری فایل‌های نمونه آزمون پذیرش با یک کلیک
  function handleLoadSampleFiles() {
    setLoading(true);
    setErrorMsg('');
    try {
      const sample = Importer.generateSampleFilesData();
      const sampleFiles: ImportFile[] = [
        {
          fileName: 'groups-table-sample.xlsx',
          detectedType: 'grouping_table',
          rawRows: sample.groupingTableRows
        },
        {
          fileName: 'registrants-sample.xlsx',
          detectedType: 'registrants_list',
          rawRows: sample.registrantsRows
        }
      ];

      const analysis = Importer.analyzeImport(sampleFiles);

      const initialGroupConfig: Record<string, GroupConfig> = {};
      analysis.groups.forEach(function (g) {
        initialGroupConfig[g.id] = {
          name: g.name,
          mine: true,
          selected: true
        };
      });

      initTarget(sampleFiles);
      setFilesData(sampleFiles);
      setAnalyzedReport(analysis);
      setGroupConfigMap(initialGroupConfig);
      setLoading(false);
      setStep(2);
    } catch (err) {
      setLoading(false);
      setErrorMsg('نمونه بارگذاری نشد: ' + errorMessage(err));
    }
  }

  // دورهٔ مقصد نهایی (موجود یا تازه) برای نمایش در مرحلهٔ ۴
  const targetCohort = cohorts.find((c) => c.id === targetCohortId) || null;
  const targetLabel =
    target === 'new' ? newName.trim() + ' (دورهٔ تازه)' : targetCohort ? targetCohort.name : '';

  // نهایی‌سازی و اعمال ادغام
  // «مال من است» برای همهٔ گروه‌ها یکجا
  function setAllMine(value: boolean) {
    if (!analyzedReport) return;
    const updated = Object.assign({}, groupConfigMap);
    analyzedReport.groups.forEach(function (g) {
      const cfg = updated[g.id] || { name: g.name, mine: true, selected: true };
      updated[g.id] = Object.assign({}, cfg, { mine: value });
    });
    setGroupConfigMap(updated);
  }

  function handleFinalApply() {
    if (!analyzedReport) return;
    try {
      let cohortId = targetCohortId;
      if (target === 'new') {
        const trimmed = newName.trim();
        if (!trimmed) {
          setErrorMsg('نام دورهٔ تازه را بنویس.');
          setStep(2);
          return;
        }
        cohortId = Store.createCohort({
          name: trimmed,
          startDate: newStartDate.toISOString().slice(0, 10)
        }).id;
      } else if (!cohortId) {
        setErrorMsg('دورهٔ مقصد را انتخاب کن.');
        setStep(2);
        return;
      }
      Importer.applyImport(cohortId, analyzedReport, groupConfigMap);
      if (toast) {
        toast.show({
          intent: 'success',
          message: 'اطلاعات به دورهٔ «' + targetLabel.replace(' (دورهٔ تازه)', '') + '» وارد شد.'
        });
      }
      onClose();
    } catch (err) {
      setErrorMsg('ورود انجام نشد: ' + errorMessage(err));
    }
  }

  // بازگردانی آخرین ورود
  function handleRollback() {
    const ok = Importer.rollbackLastImport();
    if (ok) {
      if (toast) toast.show({ intent: 'info', message: 'آخرین ورود برگردانده شد.' });
      onClose();
    } else {
      if (toast) toast.show({ intent: 'danger', message: 'ورودی برای برگرداندن نیست.' });
    }
  }

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title={'ورود افراد از Excel یا CSV (مرحلهٔ ' + Names.toPersianDigits(step) + ' از ۴)'}
      description="گروه‌ها و افراد را از فایل وارد کن. فقط نام، گروه و آیدی تلگرام خوانده می‌شود."
      size="lg"
    >
      <div className="bsh-stack" style={{ padding: 'var(--space-2) 0' }}>
        {errorMsg && <B.Alert intent="danger">{errorMsg}</B.Alert>}
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}
        >
          {[
            { s: 1, label: '۱. فایل' },
            { s: 2, label: '۲. گروه‌ها' },
            { s: 3, label: '۳. ناهمخوانی‌ها' },
            { s: 4, label: '۴. ورود' }
          ].map(function (st) {
            return (
              <B.Tag key={st.s} selected={step === st.s}>
                {st.label}
              </B.Tag>
            );
          })}
        </div>
        {step === 1 && (
          <div className="bsh-stack">
            <div className="bsh-help-row">
              <HelpHint help="importStep1" visibleLabel />
            </div>
            <B.Card padding="lg" style={{ textAlign: 'center', border: '2px dashed var(--border-subtle)' }}>
              <B.Icon
                name="Inbox"
                size="2xl"
                className="text-brand"
                style={{ margin: '0 auto var(--space-2)' }}
              />
              <h3 className="heading-xs">فایل Excel (.xlsx) یا CSV را انتخاب کن</h3>
              <p className="body-sm" style={{ color: 'var(--text-subtle)', margin: 'var(--space-2) 0' }}>
                «جدول گروه‌بندی»، «لیست ثبت‌نامی» یا هر دو را با هم انتخاب کن.
              </p>
              <input
                type="file"
                multiple={true}
                accept=".xlsx,.csv"
                onChange={handleFilesChosen}
                style={{ margin: 'var(--space-3) auto', display: 'block', color: 'var(--text-default)' }}
              />
            </B.Card>
            <B.Card padding="md">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)'
                }}
              >
                <div>
                  <div className="title">فایل‌های نمونه</div>
                  <div className="caption" style={{ color: 'var(--text-subtle)' }}>
                    برای امتحان: ۵ گروه با ۸۵ نفر، یک ناهمخوانی، ۳ نفر بدون گروه و ۵ فریز.
                  </div>
                </div>
                <B.Button variant="secondary" loading={loading} onClick={handleLoadSampleFiles}>
                  بارگذاری ۲ فایل نمونه
                </B.Button>
              </div>
            </B.Card>
            {Importer.hasRollbackAvailable() && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <B.Button variant="ghost" iconStart="ArrowLeft" onClick={handleRollback}>
                  برگرداندن آخرین ورود
                </B.Button>
              </div>
            )}
          </div>
        )}
        {step === 2 && analyzedReport && (
          <div className="bsh-stack">
            <div className="bsh-help-row">
              <HelpHint help="importStep2" visibleLabel />
              <HelpHint help="mine" visibleLabel />
            </div>
            <B.Card padding="md">
              <div className="bsh-stack" style={{ gap: 'var(--space-3)' }}>
                <B.RadioGroup
                  legend="این فایل مال کدام دوره است؟"
                  name="import-target"
                  orientation="vertical"
                  value={target}
                  onChange={function (v) {
                    setTarget(v as 'existing' | 'new');
                  }}
                  options={[
                    { value: 'existing', label: 'اضافه به دوره‌ای که هست', disabled: cohorts.length === 0 },
                    { value: 'new', label: 'ساخت دورهٔ تازه' }
                  ]}
                />
                {target === 'existing' ? (
                  <B.Select
                    label="دورهٔ مقصد"
                    options={cohorts.map(function (c) {
                      return { value: c.id, label: c.name };
                    })}
                    value={targetCohortId}
                    onChange={function (e) {
                      setTargetCohortId(e.target.value);
                    }}
                  />
                ) : (
                  <div className="bsh-stack" style={{ gap: 'var(--space-3)' }}>
                    <B.TextField
                      label="نام دوره (از نام فایل؛ قابل تغییر)"
                      value={newName}
                      onChange={function (e) {
                        setNewName(e.target.value);
                      }}
                    />
                    <B.DatePicker
                      label="تاریخ شروع دوره"
                      value={newStartDate}
                      onChange={function (d) {
                        setNewStartDate(d);
                      }}
                    />
                  </div>
                )}
              </div>
            </B.Card>
            <B.Alert intent="info">
              نام هر گروه را اصلاح کن. گروهی که تیکش را برداری وارد نمی‌شود. گروهی که «گروه من» نباشد،
              به‌عنوان گروه دیگران وارد می‌شود.
            </B.Alert>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <B.Button
                variant="ghost"
                size="sm"
                onClick={function () {
                  setAllMine(true);
                }}
              >
                همه را بزن
              </B.Button>
              <B.Button
                variant="ghost"
                size="sm"
                onClick={function () {
                  setAllMine(false);
                }}
              >
                همه را بردار
              </B.Button>
            </div>
            <div className="bsh-stack" style={{ gap: 'var(--space-3)' }}>
              {analyzedReport.groups.map(function (g) {
                const cfg = groupConfigMap[g.id] || { name: g.name, mine: true, selected: true };
                const membersOfGroup = analyzedReport.participants.filter(function (p) {
                  return p.groupId === g.id;
                });
                const firstNames = membersOfGroup
                  .slice(0, 4)
                  .map(function (p) {
                    return p.name;
                  })
                  .join('، ');

                return (
                  <B.Card key={g.id} padding="md">
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: 'var(--space-3)',
                        alignItems: 'center'
                      }}
                    >
                      <B.Checkbox
                        checked={cfg.selected}
                        onChange={function (e) {
                          const updated = Object.assign({}, groupConfigMap);
                          updated[g.id] = Object.assign({}, cfg, { selected: e.target.checked });
                          setGroupConfigMap(updated);
                        }}
                      />
                      <div>
                        <B.TextField
                          label={'نام گروه (' + Names.toPersianDigits(membersOfGroup.length) + ' نفر)'}
                          value={cfg.name}
                          onChange={function (e) {
                            const updated = Object.assign({}, groupConfigMap);
                            updated[g.id] = Object.assign({}, cfg, { name: e.target.value });
                            setGroupConfigMap(updated);
                          }}
                        />
                        <div
                          className="caption"
                          style={{ color: 'var(--text-subtle)', marginTop: 'var(--space-1)' }}
                        >
                          {'نمونه: ' + (firstNames || 'بدون فرد')}
                        </div>
                      </div>
                      <B.Switch
                        label="گروه من"
                        checked={cfg.mine}
                        onChange={function (e) {
                          const updated = Object.assign({}, groupConfigMap);
                          updated[g.id] = Object.assign({}, cfg, { mine: e.target.checked });
                          setGroupConfigMap(updated);
                        }}
                      />
                    </div>
                  </B.Card>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <B.Button
                variant="ghost"
                onClick={function () {
                  setStep(1);
                }}
              >
                قبلی
              </B.Button>
              <B.Button
                variant="primary"
                onClick={function () {
                  setStep(3);
                }}
              >
                ادامه: ناهمخوانی‌ها
              </B.Button>
            </div>
          </div>
        )}
        {step === 3 && analyzedReport && (
          <div className="bsh-stack">
            <div className="bsh-help-row">
              <HelpHint help="importStep3" visibleLabel />
            </div>
            <div className="title">ناهمخوانی‌ها</div>
            {analyzedReport.inconsistencies.length === 0 ? (
              <B.Alert intent="success" title="ناهمخوانی پیدا نشد">
                نام تکراری هم نیست.
              </B.Alert>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {analyzedReport.inconsistencies.map(function (inc, idx) {
                  const intent =
                    inc.type === 'group_conflict' ? 'warning' : inc.type === 'duplicate' ? 'danger' : 'info';
                  return (
                    <B.Alert key={idx} intent={intent}>
                      {inc.text}
                    </B.Alert>
                  );
                })}
              </div>
            )}
            <B.Card padding="md">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
                <B.Stat
                  label="افراد فایل"
                  value={Names.toPersianDigits(analyzedReport.stats.totalParticipants) + ' نفر'}
                />
                <B.Stat
                  label="افراد فریز"
                  value={Names.toPersianDigits(analyzedReport.stats.frozenCount) + ' نفر'}
                />
                <B.Stat label="نام تکراری" value={Names.toPersianDigits(analyzedReport.duplicates.length)} />
              </div>
            </B.Card>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <B.Button
                variant="ghost"
                onClick={function () {
                  setStep(2);
                }}
              >
                قبلی
              </B.Button>
              <B.Button
                variant="primary"
                onClick={function () {
                  setStep(4);
                }}
              >
                ادامه: ورود
              </B.Button>
            </div>
          </div>
        )}
        {step === 4 && analyzedReport && (
          <div className="bsh-stack">
            <div className="bsh-help-row">
              <HelpHint help="importStep4" visibleLabel />
            </div>
            <B.Alert intent="info" title="چه اتفاقی می‌افتد؟">
              افراد تازه اضافه می‌شوند. فرد موجود (با همان نام) عوض نمی‌شود؛ فقط آیدی تلگرام خالی‌اش پر می‌شود
              و اگر فایل فریزش کرده باشد، فریز می‌شود. چیزی حذف نمی‌شود.
            </B.Alert>
            <B.Card padding="md">
              <div className="title" style={{ marginBottom: 'var(--space-2)' }}>
                {'ورود به دورهٔ: ' + targetLabel}
              </div>
              <p className="body-sm" style={{ color: 'var(--text-subtle)' }}>
                بعد از ورود، تا وقتی صفحه را نبسته‌ای می‌توانی «برگرداندن آخرین ورود» را بزنی.
              </p>
            </B.Card>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <B.Button
                variant="ghost"
                onClick={function () {
                  setStep(3);
                }}
              >
                قبلی
              </B.Button>
              <B.Button variant="primary" onClick={handleFinalApply}>
                وارد کن
              </B.Button>
            </div>
          </div>
        )}
      </div>
    </B.Dialog>
  );
}

export { ImportWizardModal };
