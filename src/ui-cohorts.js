/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { B } from './bushido.js';
import { Names } from './names.js';
import { Store } from './store.js';
import { UICommon } from './ui-common.js';

const h = React.createElement;


/**
 * دیالوگ ساخت یا ویرایش دوره
 */
function CohortModal(props) {
  var open = props.open;
  var onClose = props.onClose;
  var cohort = props.cohort; // null برای ساخت، شیء برای ویرایش
  var existingCohorts = props.existingCohorts || [];

  var isEdit = !!cohort;

  var [name, setName] = React.useState(isEdit ? cohort.name : 'دوره آبان ۱۴۰۵');
  var [startDate, setStartDate] = React.useState(isEdit ? new Date(cohort.startDate) : new Date());
  var [warmupDays, setWarmupDays] = React.useState(7);
  var [mainDays, setMainDays] = React.useState(21);
  var [reviewDays, setReviewDays] = React.useState(2);
  var [copyFromPrevious, setCopyFromPrevious] = React.useState(false);
  var [copyCohortId, setCopyCohortId] = React.useState(existingCohorts[0] ? existingCohorts[0].id : '');
  var [errorMsg, setErrorMsg] = React.useState('');

  React.useEffect(function () {
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
 * دیالوگ بازگردانی از بکاپ: «افزودن به داده‌های فعلی» (پیش‌فرض) یا «جایگزینی کامل»
 */
function RestoreBackupModal(props) {
  var open = props.open;
  var onClose = props.onClose;
  var toast = props.toast;

  var [backup, setBackup] = React.useState(null); // دادهٔ اعتبارسنجی‌شده (کپی)
  var [fileName, setFileName] = React.useState('');
  var [errorMsg, setErrorMsg] = React.useState('');
  var [mode, setMode] = React.useState('merge');
  var [selected, setSelected] = React.useState({});   // { [اندیس دوره]: bool }
  var [decisions, setDecisions] = React.useState({}); // { [اندیس دوره]: skip|replace|copy }
  var [groupMine, setGroupMine] = React.useState({}); // { [اندیس دوره]: { [شناسه گروه]: bool } }

  React.useEffect(function () {
    if (open) {
      setBackup(null);
      setFileName('');
      setErrorMsg('');
      setMode('merge');
      setSelected({});
      setDecisions({});
      setGroupMine({});
    }
  }, [open]);

  if (!open) return null;

  function handleFileSelected(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg('');
    setBackup(null);

    var reader = new FileReader();
    reader.onload = function (ev) {
      var json;
      try {
        json = JSON.parse(ev.target.result);
      } catch (err) {
        setErrorMsg('این فایل خوانده نشد. مطمئن شوید فایل بکاپ (با پسوند json) را انتخاب کرده‌اید.');
        return;
      }
      var v = Store.validateBackup(json);
      if (!v.ok) {
        setErrorMsg(v.error + ' هیچ تغییری در اطلاعات شما اعمال نشد.');
        return;
      }
      var sel = {};
      var dec = {};
      var mine = {};
      v.data.cohorts.forEach(function (c, i) {
        sel[i] = true;
        dec[i] = 'skip';
        mine[i] = {};
        c.groups.forEach(function (g) { mine[i][g.id] = g.mine !== false; });
      });
      setSelected(sel);
      setDecisions(dec);
      setGroupMine(mine);
      setBackup(v.data);
    };
    reader.onerror = function () {
      setErrorMsg('خطا در خواندن فایل.');
    };
    reader.readAsText(file, 'utf-8');
  }

  function setIn(setter, current, key, value) {
    var next = Object.assign({}, current);
    next[key] = value;
    setter(next);
  }

  function setMine(idx, groupId, value) {
    var inner = Object.assign({}, groupMine[idx]);
    inner[groupId] = value;
    setIn(setGroupMine, groupMine, idx, inner);
  }

  var currentCohorts = Store.getState().cohorts || [];
  var cohorts = backup ? backup.cohorts : [];
  var selectedCount = cohorts.filter(function (c, i) { return selected[i]; }).length;

  function handleConfirm() {
    if (!backup) return;
    try {
      if (mode === 'replace') {
        if (currentCohorts.length) UICommon.downloadBeforeRestoreBackup();
        Store.restoreState(backup);
        if (toast) toast.show({ intent: 'success', message: 'اطلاعات با موفقیت جایگزین شد.' });
      } else {
        var report = Store.mergeFromBackup(backup, {
          selected: selected,
          decisions: decisions,
          groupMine: groupMine
        });
        var parts = [];
        if (report.added.length) parts.push(Names.toPersianDigits(report.added.length) + ' دوره اضافه شد');
        if (report.replaced.length) parts.push(Names.toPersianDigits(report.replaced.length) + ' دوره جایگزین شد');
        if (report.copied.length) parts.push(Names.toPersianDigits(report.copied.length) + ' نسخهٔ جدا ساخته شد');
        if (report.skipped.length) parts.push(Names.toPersianDigits(report.skipped.length) + ' دوره رد شد');
        if (toast) toast.show({ intent: 'success', message: parts.join('، ') + '.' });
      }
      onClose();
    } catch (err) {
      setErrorMsg('خطا در اعمال بکاپ: ' + err.message);
    }
  }

  var isMerge = mode === 'merge';
  var footer = h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
    h(B.Button, { variant: 'ghost', onClick: onClose }, 'انصراف'),
    h(B.Button, {
      variant: isMerge ? 'primary' : 'danger-bold',
      disabled: !backup || (isMerge && selectedCount === 0),
      onClick: handleConfirm
    }, isMerge ? 'افزودن به داده‌های فعلی' : 'تأیید و جایگزینی کامل')
  );

  function renderCohortCard(c, i) {
    var groupsCount = c.groups.length;
    var peopleCount = c.participants.length;
    var conflict = isMerge && Store.findConflictIndex(currentCohorts, c) !== -1;
    var isSelected = !!selected[i];

    return h(B.Card, { key: c.id + '_' + i, padding: 'md' },
      h('div', { style: { display: 'grid', gap: 'var(--space-3)' } },
        h(B.Checkbox, {
          label: c.name,
          checked: isSelected,
          onChange: function (e) { setIn(setSelected, selected, i, e.target.checked); }
        }),
        h('div', { className: 'caption', style: { color: 'var(--text-subtle)' } },
          Names.toPersianDigits(groupsCount) + ' گروه · ' +
          Names.toPersianDigits(peopleCount) + ' نفر · شروع: ' +
          (c.startDate ? Names.formatShamsi(c.startDate) : 'نامشخص')
        ),
        isSelected && conflict && h(B.Alert, { intent: 'warning', title: 'این دوره از قبل در برنامه هست' },
          h(B.RadioGroup, {
            name: 'dup-' + i,
            orientation: 'vertical',
            value: decisions[i] || 'skip',
            onChange: function (v) { setIn(setDecisions, decisions, i, v); },
            options: [
              { value: 'skip', label: 'رد کن (دورهٔ فعلی دست‌نخورده می‌ماند)' },
              { value: 'replace', label: 'جایگزین کن (دورهٔ فعلی با این نسخه عوض می‌شود)' },
              { value: 'copy', label: 'نسخهٔ جدا بساز (نام با پسوند ـ۲)' }
            ]
          })
        ),
        isSelected && groupsCount > 0 && h('div', { style: { display: 'grid', gap: 'var(--space-1)' } },
          c.groups.map(function (g) {
            var members = c.participants.filter(function (p) { return p.groupId === g.id; }).length;
            var mineMap = groupMine[i] || {};
            return h(B.Checkbox, {
              key: g.id,
              label: 'مال من است — ' + g.name + ' (' + Names.toPersianDigits(members) + ' نفر)',
              checked: mineMap[g.id] !== false,
              onChange: function (e) { setMine(i, g.id, e.target.checked); }
            });
          })
        )
      )
    );
  }

  return h(B.Dialog, {
    open: open,
    onClose: onClose,
    title: 'بازگردانی از فایل پشتیبان (JSON)',
    description: 'ابتدا فایل بکاپ را انتخاب کنید، سپس بگویید با اطلاعات فعلی چه شود.',
    footer: footer,
    size: 'lg'
  },
    h('div', { style: { display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' } },
      errorMsg && h(B.Alert, { intent: 'danger' }, errorMsg),
      h('div', null,
        h('label', { className: 'label-md', style: { display: 'block', marginBottom: 'var(--space-2)' } }, 'انتخاب فایل JSON بکاپ'),
        h('input', {
          type: 'file',
          accept: '.json,application/json',
          onChange: handleFileSelected,
          style: { display: 'block', width: '100%', color: 'var(--text-default)' }
        })
      ),
      h(B.RadioGroup, {
        legend: 'روش بازگردانی',
        name: 'restore-mode',
        orientation: 'vertical',
        value: mode,
        onChange: function (v) { setMode(v); },
        options: [
          {
            value: 'merge',
            label: h('span', null,
              h('strong', null, 'افزودن به داده‌های فعلی (پیشنهادی)'),
              h('br'),
              h('span', { className: 'caption', style: { color: 'var(--text-subtle)' } }, 'دوره‌های فایل کنار دوره‌های فعلی اضافه می‌شوند و چیزی پاک نمی‌شود.')
            )
          },
          {
            value: 'replace',
            label: h('span', null,
              h('strong', null, 'جایگزینی کامل'),
              h('br'),
              h('span', { className: 'caption', style: { color: 'var(--text-subtle)' } }, 'همهٔ اطلاعات فعلی پاک و با محتوای فایل عوض می‌شود.')
            )
          }
        ]
      }),
      !isMerge && h(B.Alert, { intent: 'warning' },
        'پیش از جایگزینی، خودکار یک فایل از اطلاعات فعلی با نام support-before-restore-تاریخ.json دانلود می‌شود. آن را نگه دارید تا اگر لازم شد، برگردانید.'
      ),
      backup && h('div', { style: { display: 'grid', gap: 'var(--space-3)' } },
        h('div', { className: 'title' },
          isMerge ? 'دوره‌های داخل فایل (' + fileName + ')' : 'محتوای فایل (' + fileName + ')'
        ),
        cohorts.length === 0 && h(B.Alert, { intent: 'info' }, 'این فایل هیچ دوره‌ای ندارد.'),
        isMerge
          ? cohorts.map(renderCohortCard)
          : h(B.Card, { padding: 'md' },
              cohorts.map(function (c, i) {
                return h('div', { key: i, className: 'body-sm' },
                  c.name + ' — ' + Names.toPersianDigits(c.groups.length) + ' گروه، ' +
                  Names.toPersianDigits(c.participants.length) + ' نفر');
              })
            ),
        (backup.exportedAt || backup.lastBackupAt) && h('div', {
          className: 'caption',
          style: { color: 'var(--text-subtle)' }
        }, 'تاریخ ساخت فایل: ' + Names.formatShamsi(backup.exportedAt || backup.lastBackupAt))
      )
    )
  );
}

export const UICohorts = {
  CohortModal: CohortModal,
  EmptyCohortState: EmptyCohortState,
  RestoreBackupModal: RestoreBackupModal
};
