/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

(function (root) {
  'use strict';

  var SupportApp = root.SupportApp || (root.SupportApp = {});
  var h = root.React.createElement;
  var B = root.Bushido;
  var Names = SupportApp.Names || {};
  var Store = SupportApp.Store || {};

  /**
   * دیالوگ ساخت یا ویرایش دوره
   */
  function CohortModal(props) {
    var open = props.open;
    var onClose = props.onClose;
    var cohort = props.cohort; // null برای ساخت، شیء برای ویرایش
    var existingCohorts = props.existingCohorts || [];

    var isEdit = !!cohort;

    var [name, setName] = root.React.useState(isEdit ? cohort.name : 'دوره آبان ۱۴۰۵');
    var [startDate, setStartDate] = root.React.useState(isEdit ? new Date(cohort.startDate) : new Date());
    var [warmupDays, setWarmupDays] = root.React.useState(7);
    var [mainDays, setMainDays] = root.React.useState(21);
    var [reviewDays, setReviewDays] = root.React.useState(2);
    var [copyFromPrevious, setCopyFromPrevious] = root.React.useState(false);
    var [copyCohortId, setCopyCohortId] = root.React.useState(existingCohorts[0] ? existingCohorts[0].id : '');
    var [errorMsg, setErrorMsg] = root.React.useState('');

    root.React.useEffect(function () {
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
    }, [open, cohort]);

    if (!open) return null;

    function handleSave() {
      var trimmed = name.trim();
      if (!trimmed) {
        setErrorMsg('نام دوره نمی‌تواند خالی باشد.');
        return;
      }

      var isoStart = startDate ? startDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

      if (isEdit) {
        Store.updateCohort(cohort.id, {
          name: trimmed,
          startDate: isoStart
        });
      } else {
        Store.createCohort({
          name: trimmed,
          startDate: isoStart,
          warmupDays: parseInt(warmupDays, 10) || 7,
          mainDays: parseInt(mainDays, 10) || 21,
          reviewDays: parseInt(reviewDays, 10) || 2,
          copyFromCohortId: copyFromPrevious ? copyCohortId : null
        });
      }
      onClose();
    }

    var footer = h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
      h(B.Button, { variant: 'ghost', onClick: onClose }, 'انصراف'),
      h(B.Button, { variant: 'primary', onClick: handleSave }, isEdit ? 'ذخیره تغییرات' : 'ساخت دوره')
    );

    return h(B.Dialog, {
      open: open,
      onClose: onClose,
      title: isEdit ? 'ویرایش دوره' : 'ساخت دوره جدید',
      description: isEdit ? 'نام و تاریخ شروع دوره را تغییر دهید.' : 'مشخصات اولیه دوره ۳۰ روزه را وارد کنید.',
      footer: footer,
      size: 'md'
    },
      h('div', { style: { display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' } },
        errorMsg && h(B.Alert, { intent: 'danger' }, errorMsg),
        h(B.TextField, {
          label: 'نام دوره',
          value: name,
          onChange: function (e) { setName(e.target.value); },
          required: true,
          placeholder: 'مثلاً: دوره ۳۰ روزه آبان'
        }),
        h(B.DatePicker, {
          label: 'تاریخ شروع دوره',
          value: startDate,
          onChange: function (d) { setStartDate(d); }
        }),
        !isEdit && h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' } },
          h(B.TextField, {
            label: 'روزهای گرم‌کردن',
            type: 'number',
            value: warmupDays,
            onChange: function (e) { setWarmupDays(e.target.value); }
          }),
          h(B.TextField, {
            label: 'روزهای اصلی',
            type: 'number',
            value: mainDays,
            onChange: function (e) { setMainDays(e.target.value); }
          }),
          h(B.TextField, {
            label: 'روزهای مرور',
            type: 'number',
            value: reviewDays,
            onChange: function (e) { setReviewDays(e.target.value); }
          })
        ),
        !isEdit && existingCohorts.length > 0 && h('div', { style: { display: 'grid', gap: 'var(--space-2)' } },
          h(B.Checkbox, {
            label: 'گروه‌ها و افراد از دوره قبل کپی شوند',
            checked: copyFromPrevious,
            onChange: function (e) { setCopyFromPrevious(e.target.checked); }
          }),
          copyFromPrevious && h(B.Select, {
            label: 'انتخاب دوره مبدأ برای کپی',
            options: existingCohorts.map(function (c) { return { value: c.id, label: c.name }; }),
            value: copyCohortId,
            onChange: function (e) { setCopyCohortId(e.target.value); }
          })
        )
      )
    );
  }

  /**
   * صفحه خالی در صورت نبود هیچ دوره‌ای
   */
  function EmptyCohortState(props) {
    var onCreateCohort = props.onCreateCohort;
    var onRestoreBackup = props.onRestoreBackup;

    var action = h('div', { style: { display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' } },
      h(B.Button, { variant: 'primary', iconStart: 'Plus', onClick: onCreateCohort }, 'ساخت دوره'),
      h(B.Button, { variant: 'secondary', iconStart: 'ExternalLink', onClick: onRestoreBackup }, 'بازگردانی از بکاپ')
    );

    return h('div', {
      style: {
        maxWidth: 640,
        margin: 'var(--space-12) auto',
        padding: '0 var(--space-4)'
      }
    },
      h(B.EmptyState, {
        icon: 'Flame',
        title: 'هنوز هیچ دوره‌ای ایجاد نشده است',
        description: 'برای شروع کار با ابزار پشتیبان‌ها، دوره جدید بسازید یا فایل بکاپ قبلی خود را بازگردانی کنید.',
        action: action
      })
    );
  }

  /**
   * دیالوگ بازگردانی از بکاپ با پیش‌نمایش
   */
  function RestoreBackupModal(props) {
    var open = props.open;
    var onClose = props.onClose;
    var toast = props.toast;

    var [parsedBackup, setParsedBackup] = root.React.useState(null);
    var [fileName, setFileName] = root.React.useState('');
    var [errorMsg, setErrorMsg] = root.React.useState('');

    root.React.useEffect(function () {
      if (open) {
        setParsedBackup(null);
        setFileName('');
        setErrorMsg('');
      }
    }, [open]);

    if (!open) return null;

    function handleFileSelected(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      setFileName(file.name);
      setErrorMsg('');

      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var json = JSON.parse(ev.target.result);
          if (!json || typeof json !== 'object' || !Array.isArray(json.cohorts)) {
            throw new Error('ساختار فایل بکاپ استاندارد بوشیدو نیست.');
          }
          setParsedBackup(json);
        } catch (err) {
          setErrorMsg('فایل انتخاب‌شده نامعتبر است: ' + err.message);
          setParsedBackup(null);
        }
      };
      reader.onerror = function () {
        setErrorMsg('خطا در خواندن فایل.');
      };
      reader.readAsText(file, 'utf-8');
    }

    function handleConfirmRestore() {
      if (!parsedBackup) return;
      try {
        Store.restoreState(parsedBackup);
        if (toast) {
          toast.show({ intent: 'success', message: 'اطلاعات با موفقیت بازگردانی شد.' });
        }
        onClose();
      } catch (err) {
        setErrorMsg('خطا در اعمال بکاپ: ' + err.message);
      }
    }

    var cohortsCount = parsedBackup ? (parsedBackup.cohorts || []).length : 0;
    var groupsCount = 0;
    var participantsCount = 0;
    if (parsedBackup && parsedBackup.cohorts) {
      parsedBackup.cohorts.forEach(function (c) {
        groupsCount += (c.groups || []).length;
        participantsCount += (c.participants || []).length;
      });
    }

    var footer = h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
      h(B.Button, { variant: 'ghost', onClick: onClose }, 'انصراف'),
      h(B.Button, {
        variant: 'danger-bold',
        disabled: !parsedBackup,
        onClick: handleConfirmRestore
      }, 'تأیید و جایگزینی کامل')
    );

    return h(B.Dialog, {
      open: open,
      onClose: onClose,
      title: 'بازگردانی از فایل پشتیبان (JSON)',
      description: 'فایل بکاپ را انتخاب کنید. پس از تأیید، تمام داده‌های فعلی مرورگر با این فایل جایگزین می‌شوند.',
      footer: footer,
      size: 'md',
      alert: true
    },
      h('div', { style: { display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' } },
        errorMsg && h(B.Alert, { intent: 'danger' }, errorMsg),
        h('div', null,
          h('label', { className: 'label-md', style: { display: 'block', marginBottom: 'var(--space-2)' } }, 'انتخاب فایل JSON بکاپ'),
          h('input', {
            type: 'file',
            accept: '.json,application/json',
            onChange: handleFileSelected,
            style: { display: 'block', width: '100%', color: 'var(--text-base)' }
          })
        ),
        parsedBackup && h(B.Card, { padding: 'md' },
          h('div', { className: 'title', style: { marginBottom: 'var(--space-2)' } }, 'پیش‌نمایش محتوای بکاپ:'),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' } },
            h(B.Stat, { label: 'تعداد دوره‌ها', value: Names.toPersianDigits(cohortsCount) }),
            h(B.Stat, { label: 'تعداد گروه‌ها', value: Names.toPersianDigits(groupsCount) }),
            h(B.Stat, { label: 'تعداد افراد', value: Names.toPersianDigits(participantsCount) })
          ),
          parsedBackup.lastBackupAt && h('div', {
            className: 'caption',
            style: { color: 'var(--text-muted)', marginTop: 'var(--space-2)' }
          }, 'تاریخ ثبت بکاپ: ' + Names.formatShamsi(parsedBackup.lastBackupAt))
        )
      )
    );
  }

  SupportApp.UICohorts = {
    CohortModal: CohortModal,
    EmptyCohortState: EmptyCohortState,
    RestoreBackupModal: RestoreBackupModal
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupportApp.UICohorts;
  }
})(typeof window !== 'undefined' ? window : globalThis);
