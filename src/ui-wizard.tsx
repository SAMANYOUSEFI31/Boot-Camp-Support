/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, type ChangeEvent } from 'react';
import { B } from './bushido';
import { Names } from './names';
import { errorMessage } from './errors';
import { Importer, type GroupConfig, type ImportFile, type ImportReport } from './importer';
import type { Cohort, Toast } from './types';

/**
 * ویزارد ۴ مرحله‌ای ورود از اکسل / CSV
 */
function ImportWizardModal(props: { open: boolean; cohort: Cohort; onClose: () => void; toast?: Toast }) {
  const open = props.open;
  const cohort = props.cohort;
  const onClose = props.onClose;
  const toast = props.toast;

  const [step, setStep] = useState(1); // 1: انتخاب فایل, 2: پیش‌نمایش, 3: مغایرت‌ها, 4: تأیید
  const [filesData, setFilesData] = useState<ImportFile[]>([]);
  const [analyzedReport, setAnalyzedReport] = useState<ImportReport | null>(null);
  const [groupConfigMap, setGroupConfigMap] = useState<Record<string, GroupConfig>>({}); // { [groupId]: { name, mine, selected } }
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(
    function () {
      if (open) {
        setStep(1);
        setFilesData([]);
        setAnalyzedReport(null);
        setGroupConfigMap({});
        setLoading(false);
        setErrorMsg('');
      }
    },
    [open]
  );

  if (!open) return null;

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

        setFilesData(parsedFiles);
        setAnalyzedReport(analysis);
        setGroupConfigMap(initialGroupConfig);
        setLoading(false);
        setStep(2);
      })
      .catch(function (err) {
        setLoading(false);
        setErrorMsg('خطا در پردازش فایل: ' + errorMessage(err));
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

      setFilesData(sampleFiles);
      setAnalyzedReport(analysis);
      setGroupConfigMap(initialGroupConfig);
      setLoading(false);
      setStep(2);
    } catch (err) {
      setLoading(false);
      setErrorMsg('خطا در بارگذاری نمونه: ' + errorMessage(err));
    }
  }

  // نهایی‌سازی و اعمال ادغام
  function handleFinalApply() {
    if (!analyzedReport) return;
    try {
      Importer.applyImport(cohort.id, analyzedReport, groupConfigMap);
      if (toast) {
        toast.show({
          intent: 'success',
          message: 'اطلاعات با موفقیت به دوره وارد و ادغام شدند.'
        });
      }
      onClose();
    } catch (err) {
      setErrorMsg('خطا در اعمال: ' + errorMessage(err));
    }
  }

  // بازگردانی آخرین ورود
  function handleRollback() {
    const ok = Importer.rollbackLastImport();
    if (ok) {
      if (toast) toast.show({ intent: 'info', message: 'آخرین ورود با موفقیت بازگردانده شد.' });
      onClose();
    } else {
      if (toast) toast.show({ intent: 'danger', message: 'نسخه پشتیبانی برای بازگردانی وجود ندارد.' });
    }
  }

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title={'ویزارد ورود اطلاعات از اکسل / CSV (مرحله ' + Names.toPersianDigits(step) + ' از ۴)'}
      description="ورود گروه‌ها و افراد با رعایت کامل حریم خصوصی و تطبیق خودکار مغایرت‌ها."
      size="lg"
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' }}>
        {errorMsg && <B.Alert intent="danger">{errorMsg}</B.Alert>}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          {[
            { s: 1, label: '۱. انتخاب فایل' },
            { s: 2, label: '۲. پیش‌نمایش گروه‌ها' },
            { s: 3, label: '۳. گزارش ناهمخوانی‌ها' },
            { s: 4, label: '۴. تأیید نهایی' }
          ].map(function (st) {
            return (
              <B.Tag key={st.s} selected={step === st.s}>
                {st.label}
              </B.Tag>
            );
          })}
        </div>
        {step === 1 && (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <B.Card padding="lg" style={{ textAlign: 'center', border: '2px dashed var(--border-subtle)' }}>
              <B.Icon
                name="Inbox"
                size="2xl"
                className="text-brand"
                style={{ margin: '0 auto var(--space-2)' }}
              />
              <h3 className="heading-xs">فایل یا فایل‌های اکسل (.xlsx) یا .csv را انتخاب کنید</h3>
              <p className="body-sm" style={{ color: 'var(--text-subtle)', margin: 'var(--space-2) 0' }}>
                می‌توانید «جدول گروه‌بندی»، «لیست ثبت‌نامی» یا هر دو را همزمان انتخاب نمایید.
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
                  <div className="title">بارگذاری فایل‌های نمونه آزمون پذیرش</div>
                  <div className="caption" style={{ color: 'var(--text-subtle)' }}>
                    شامل ۵ گروه با ۸۵ نفر، مغایرت سمیه سعدی، ۳ نفر بدون گروه و ۵ فریز شده.
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
                  بازگردانی آخرین ورود (Undo)
                </B.Button>
              </div>
            )}
          </div>
        )}
        {step === 2 && analyzedReport && (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <B.Alert intent="info">
              نام گروه‌ها را در صورت نیاز ویرایش کنید. گروه‌هایی که تیک «مال من است» ندارند، اصلاً وارد برنامه
              نمی‌شوند.
            </B.Alert>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
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
                          label={'نام گروه (تعداد: ' + Names.toPersianDigits(membersOfGroup.length) + ' نفر)'}
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
                          {'نمونه اعضا: ' + (firstNames || 'بدون عضو')}
                        </div>
                      </div>
                      <B.Switch
                        label="مال من است"
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
                مرحله قبل
              </B.Button>
              <B.Button
                variant="primary"
                onClick={function () {
                  setStep(3);
                }}
              >
                مشاهده گزارش ناهمخوانی‌ها
              </B.Button>
            </div>
          </div>
        )}
        {step === 3 && analyzedReport && (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <div className="title">گزارش مغایرت‌ها و بررسی انطباق داده‌ها:</div>
            {analyzedReport.inconsistencies.length === 0 ? (
              <B.Alert intent="success" title="داده‌ها کاملاً منطبق هستند">
                هیچ ناهمخوانی یا تکراری مشاهده نشد.
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
                  label="کل افراد در فایل‌ها"
                  value={Names.toPersianDigits(analyzedReport.stats.totalParticipants) + ' نفر'}
                />
                <B.Stat
                  label="افراد فریز شده"
                  value={Names.toPersianDigits(analyzedReport.stats.frozenCount) + ' نفر'}
                />
                <B.Stat
                  label="تعداد تکراری‌ها"
                  value={Names.toPersianDigits(analyzedReport.duplicates.length)}
                />
              </div>
            </B.Card>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <B.Button
                variant="ghost"
                onClick={function () {
                  setStep(2);
                }}
              >
                مرحله قبل
              </B.Button>
              <B.Button
                variant="primary"
                onClick={function () {
                  setStep(4);
                }}
              >
                رفتن به تأیید نهایی
              </B.Button>
            </div>
          </div>
        )}
        {step === 4 && analyzedReport && (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <B.Alert intent="info" title="قاعده ادغام بوشیدو">
              افراد موجود در دوره دستکاری نمی‌شوند و فقط آیدی تلگرام خالی آنها تکمیل می‌گردد. افراد جدید به
              گروه‌ها اضافه می‌شوند و هیچ رکوردی حذف نخواهد شد.
            </B.Alert>
            <B.Card padding="md">
              <div className="title" style={{ marginBottom: 'var(--space-2)' }}>
                {'آماده اعمال در دوره: ' + cohort.name}
              </div>
              <p className="body-sm" style={{ color: 'var(--text-subtle)' }}>
                با کلیک روی تأیید، اعضا و گروه‌های مشخص‌شده به دوره اضافه می‌شوند و یک نسخه پشتیبان در حافظه
                ذخیره می‌گردد تا در صورت تمایل امکان Undo داشته باشید.
              </p>
            </B.Card>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <B.Button
                variant="ghost"
                onClick={function () {
                  setStep(3);
                }}
              >
                مرحله قبل
              </B.Button>
              <B.Button variant="primary" onClick={handleFinalApply}>
                تأیید و اعمال اطلاعات
              </B.Button>
            </div>
          </div>
        )}
      </div>
    </B.Dialog>
  );
}

export const UIWizard = {
  ImportWizardModal: ImportWizardModal
};
