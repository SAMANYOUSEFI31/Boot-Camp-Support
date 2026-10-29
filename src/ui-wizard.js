/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { B } from './bushido.js';
import { Names } from './names.js';
import { Importer } from './importer.js';

const h = React.createElement;


/**
 * ویزارد ۴ مرحله‌ای ورود از اکسل / CSV
 */
function ImportWizardModal(props) {
  var open = props.open;
  var cohort = props.cohort;
  var onClose = props.onClose;
  var toast = props.toast;

  var [step, setStep] = React.useState(1); // 1: انتخاب فایل, 2: پیش‌نمایش, 3: مغایرت‌ها, 4: تأیید
  var [filesData, setFilesData] = React.useState([]);
  var [analyzedReport, setAnalyzedReport] = React.useState(null);
  var [groupConfigMap, setGroupConfigMap] = React.useState({}); // { [groupId]: { name, mine, selected } }
  var [loading, setLoading] = React.useState(false);
  var [errorMsg, setErrorMsg] = React.useState('');

  React.useEffect(function () {
    if (open) {
      setStep(1);
      setFilesData([]);
      setAnalyzedReport(null);
      setGroupConfigMap({});
      setLoading(false);
      setErrorMsg('');
    }
  }, [open]);

  if (!open) return null;

  // ۱. پردازش فایل‌های آپلود شده
  function handleFilesChosen(e) {
    var files = Array.from(e.target.files || []);
    if (!files.length) return;
    processSelectedFiles(files);
  }

  function processSelectedFiles(files) {
    setLoading(true);
    setErrorMsg('');

    var readPromises = files.map(function (f) {
      return Importer.readFileData(f);
    });

    Promise.all(readPromises).then(function (results) {
      var parsedFiles = results.map(function (res) {
        var detected = Importer.detectStructureType(res.rawRows);
        return {
          fileName: res.fileName,
          detectedType: detected,
          rawRows: res.rawRows
        };
      });

      var analysis = Importer.analyzeImport(parsedFiles);

      // آماده‌سازی تنظیمات اولیه گروه‌ها
      var initialGroupConfig = {};
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
    }).catch(function (err) {
      setLoading(false);
      setErrorMsg('خطا در پردازش فایل: ' + err.message);
    });
  }

  // بارگذاری فایل‌های نمونه آزمون پذیرش با یک کلیک
  function handleLoadSampleFiles() {
    setLoading(true);
    setErrorMsg('');
    try {
      var sample = Importer.generateSampleFilesData();
      var sampleFiles = [
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

      var analysis = Importer.analyzeImport(sampleFiles);

      var initialGroupConfig = {};
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
      setErrorMsg('خطا در بارگذاری نمونه: ' + err.message);
    }
  }

  // نهایی‌سازی و اعمال ادغام
  function handleFinalApply() {
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
      setErrorMsg('خطا در اعمال: ' + err.message);
    }
  }

  // بازگردانی آخرین ورود
  function handleRollback() {
    var ok = Importer.rollbackLastImport();
    if (ok) {
      if (toast) toast.show({ intent: 'info', message: 'آخرین ورود با موفقیت بازگردانده شد.' });
      onClose();
    } else {
      if (toast) toast.show({ intent: 'danger', message: 'نسخه پشتیبانی برای بازگردانی وجود ندارد.' });
    }
  }

  return h(B.Dialog, {
    open: open,
    onClose: onClose,
    title: 'ویزارد ورود اطلاعات از اکسل / CSV (مرحله ' + Names.toPersianDigits(step) + ' از ۴)',
    description: 'ورود گروه‌ها و افراد با رعایت کامل حریم خصوصی و تطبیق خودکار مغایرت‌ها.',
    size: 'lg'
  },
    h('div', { style: { display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' } },
      errorMsg && h(B.Alert, { intent: 'danger' }, errorMsg),

      // نوار پیشرفت مراحل
      h('div', { style: { display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' } },
        [
          { s: 1, label: '۱. انتخاب فایل' },
          { s: 2, label: '۲. پیش‌نمایش گروه‌ها' },
          { s: 3, label: '۳. گزارش ناهمخوانی‌ها' },
          { s: 4, label: '۴. تأیید نهایی' }
        ].map(function (st) {
          return h(B.Tag, {
            key: st.s,
            selected: step === st.s
          }, st.label);
        })
      ),

      // مرحله ۱: انتخاب فایل
      step === 1 && h('div', { style: { display: 'grid', gap: 'var(--space-4)' } },
        h(B.Card, { padding: 'lg', style: { textAlign: 'center', border: '2px dashed var(--border-subtle)' } },
          h(B.Icon, { name: 'Inbox', size: '2xl', className: 'text-brand', style: { margin: '0 auto var(--space-2)' } }),
          h('h3', { className: 'heading-xs' }, 'فایل یا فایل‌های اکسل (.xlsx) یا .csv را انتخاب کنید'),
          h('p', { className: 'body-sm', style: { color: 'var(--text-subtle)', margin: 'var(--space-2) 0' } },
            'می‌توانید «جدول گروه‌بندی»، «لیست ثبت‌نامی» یا هر دو را همزمان انتخاب نمایید.'
          ),
          h('input', {
            type: 'file',
            multiple: true,
            accept: '.xlsx,.csv',
            onChange: handleFilesChosen,
            style: { margin: 'var(--space-3) auto', display: 'block', color: 'var(--text-default)' }
          })
        ),

        // گزینه سریع تست: بارگذاری داده‌های نمونه پذیرش
        h(B.Card, { padding: 'md' },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' } },
            h('div', null,
              h('div', { className: 'title' }, 'بارگذاری فایل‌های نمونه آزمون پذیرش'),
              h('div', { className: 'caption', style: { color: 'var(--text-subtle)' } },
                'شامل ۵ گروه با ۸۵ نفر، مغایرت سمیه سعدی، ۳ نفر بدون گروه و ۵ فریز شده.'
              )
            ),
            h(B.Button, {
              variant: 'secondary',
              loading: loading,
              onClick: handleLoadSampleFiles
            }, 'بارگذاری ۲ فایل نمونه')
          )
        ),

        // دکمه بازگردانی در صورت وجود
        Importer.hasRollbackAvailable() && h('div', { style: { display: 'flex', justifyContent: 'flex-start' } },
          h(B.Button, {
            variant: 'ghost',
            iconStart: 'ArrowLeft',
            onClick: handleRollback
          }, 'بازگردانی آخرین ورود (Undo)')
        )
      ),

      // مرحله ۲: پیش‌نمایش گروه‌ها و انتخاب «مال من است»
      step === 2 && analyzedReport && h('div', { style: { display: 'grid', gap: 'var(--space-4)' } },
        h(B.Alert, { intent: 'info' },
          'نام گروه‌ها را در صورت نیاز ویرایش کنید. گروه‌هایی که تیک «مال من است» ندارند، اصلاً وارد برنامه نمی‌شوند.'
        ),
        h('div', { style: { display: 'grid', gap: 'var(--space-3)' } },
          analyzedReport.groups.map(function (g) {
            var cfg = groupConfigMap[g.id] || { name: g.name, mine: true, selected: true };
            var membersOfGroup = analyzedReport.participants.filter(function (p) { return p.groupId === g.id; });
            var firstNames = membersOfGroup.slice(0, 4).map(function (p) { return p.name; }).join('، ');

            return h(B.Card, { key: g.id, padding: 'md' },
              h('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 'var(--space-3)', alignItems: 'center' } },
                h(B.Checkbox, {
                  checked: cfg.selected,
                  onChange: function (e) {
                    var updated = Object.assign({}, groupConfigMap);
                    updated[g.id] = Object.assign({}, cfg, { selected: e.target.checked });
                    setGroupConfigMap(updated);
                  }
                }),
                h('div', null,
                  h(B.TextField, {
                    label: 'نام گروه (تعداد: ' + Names.toPersianDigits(membersOfGroup.length) + ' نفر)',
                    value: cfg.name,
                    onChange: function (e) {
                      var updated = Object.assign({}, groupConfigMap);
                      updated[g.id] = Object.assign({}, cfg, { name: e.target.value });
                      setGroupConfigMap(updated);
                    }
                  }),
                  h('div', { className: 'caption', style: { color: 'var(--text-subtle)', marginTop: 'var(--space-1)' } },
                    'نمونه اعضا: ' + (firstNames || 'بدون عضو')
                  )
                ),
                h(B.Switch, {
                  label: 'مال من است',
                  checked: cfg.mine,
                  onChange: function (e) {
                    var updated = Object.assign({}, groupConfigMap);
                    updated[g.id] = Object.assign({}, cfg, { mine: e.target.checked });
                    setGroupConfigMap(updated);
                  }
                })
              )
            );
          })
        ),
        h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
          h(B.Button, { variant: 'ghost', onClick: function () { setStep(1); } }, 'مرحله قبل'),
          h(B.Button, { variant: 'primary', onClick: function () { setStep(3); } }, 'مشاهده گزارش ناهمخوانی‌ها')
        )
      ),

      // مرحله ۳: گزارش ناهمخوانی‌ها
      step === 3 && analyzedReport && h('div', { style: { display: 'grid', gap: 'var(--space-4)' } },
        h('div', { className: 'title' }, 'گزارش مغایرت‌ها و بررسی انطباق داده‌ها:'),
        analyzedReport.inconsistencies.length === 0 ? (
          h(B.Alert, { intent: 'success', title: 'داده‌ها کاملاً منطبق هستند' },
            'هیچ ناهمخوانی یا تکراری مشاهده نشد.'
          )
        ) : (
          h('div', { style: { display: 'grid', gap: 'var(--space-2)' } },
            analyzedReport.inconsistencies.map(function (inc, idx) {
              var intent = inc.type === 'group_conflict' ? 'warning' : inc.type === 'duplicate' ? 'danger' : 'info';
              return h(B.Alert, {
                key: idx,
                intent: intent
              }, inc.text);
            })
          )
        ),

        // بخش آمار موارد شناسایی‌شده
        h(B.Card, { padding: 'md' },
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' } },
            h(B.Stat, { label: 'کل افراد در فایل‌ها', value: Names.toPersianDigits(analyzedReport.stats.totalParticipants) + ' نفر' }),
            h(B.Stat, { label: 'افراد فریز شده', value: Names.toPersianDigits(analyzedReport.stats.frozenCount) + ' نفر' }),
            h(B.Stat, { label: 'تعداد تکراری‌ها', value: Names.toPersianDigits(analyzedReport.duplicates.length) })
          )
        ),

        h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
          h(B.Button, { variant: 'ghost', onClick: function () { setStep(2); } }, 'مرحله قبل'),
          h(B.Button, { variant: 'primary', onClick: function () { setStep(4); } }, 'رفتن به تأیید نهایی')
        )
      ),

      // مرحله ۴: تأیید و ادغام
      step === 4 && analyzedReport && h('div', { style: { display: 'grid', gap: 'var(--space-4)' } },
        h(B.Alert, { intent: 'info', title: 'قاعده ادغام بوشیدو' },
          'افراد موجود در دوره دستکاری نمی‌شوند و فقط آیدی تلگرام خالی آنها تکمیل می‌گردد. افراد جدید به گروه‌ها اضافه می‌شوند و هیچ رکوردی حذف نخواهد شد.'
        ),
        h(B.Card, { padding: 'md' },
          h('div', { className: 'title', style: { marginBottom: 'var(--space-2)' } }, 'آماده اعمال در دوره: ' + cohort.name),
          h('p', { className: 'body-sm', style: { color: 'var(--text-subtle)' } },
            'با کلیک روی تأیید، اعضا و گروه‌های مشخص‌شده به دوره اضافه می‌شوند و یک نسخه پشتیبان در حافظه ذخیره می‌گردد تا در صورت تمایل امکان Undo داشته باشید.'
          )
        ),
        h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
          h(B.Button, { variant: 'ghost', onClick: function () { setStep(3); } }, 'مرحله قبل'),
          h(B.Button, {
            variant: 'primary',
            onClick: handleFinalApply
          }, 'تأیید و اعمال اطلاعات')
        )
      )
    )
  );
}

export const UIWizard = {
  ImportWizardModal: ImportWizardModal
};
