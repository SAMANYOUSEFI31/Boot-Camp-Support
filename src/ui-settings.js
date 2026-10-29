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
   * تب تنظیمات
   */
  function SettingsTab(props) {
    var cohort = props.cohort;
    var toast = props.toast;

    var [subTab, setSubTab] = root.React.useState('days'); // 'days' | 'danger'
    var [dangerModalOpen, setDangerModalOpen] = root.React.useState(false);
    var [dangerConfirmText, setDangerConfirmText] = root.React.useState('');

    // بازه روزها برای اعمال دسته‌جمعی
    var [rangeStart, setRangeStart] = root.React.useState('8');
    var [rangeEnd, setRangeEnd] = root.React.useState('28');
    var [rangeHard, setRangeHard] = root.React.useState('3');
    var [rangeSpecial, setRangeSpecial] = root.React.useState(true);

    if (!cohort) return null;

    var days = cohort.days || [];

    function handleDayChange(dayN, field, value) {
      var updated = days.map(function (d) {
        if (d.n === dayN) {
          var copy = Object.assign({}, d);
          copy[field] = value;
          return copy;
        }
        return d;
      });
      Store.updateDaysConfig(cohort.id, updated);
      if (toast) toast.show({ intent: 'success', message: 'تنظیمات روز ' + Names.toPersianDigits(dayN) + ' ذخیره شد.' });
    }

    function handleCopyFromPrev(dayN) {
      if (dayN <= 1) return;
      var prev = days.find(function (d) { return d.n === dayN - 1; });
      if (!prev) return;
      var updated = days.map(function (d) {
        if (d.n === dayN) {
          return Object.assign({}, d, {
            type: prev.type,
            hardLevels: prev.hardLevels,
            specialMission: prev.specialMission
          });
        }
        return d;
      });
      Store.updateDaysConfig(cohort.id, updated);
      if (toast) toast.show({ intent: 'success', message: 'تنظیمات از روز ' + Names.toPersianDigits(dayN - 1) + ' کپی شد.' });
    }

    function handleApplyToRange() {
      var start = parseInt(rangeStart, 10);
      var end = parseInt(rangeEnd, 10);
      var hard = parseInt(rangeHard, 10);
      if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > 30) {
        if (toast) toast.show({ intent: 'danger', message: 'بازه روزها نامعتبر است.' });
        return;
      }

      var updated = days.map(function (d) {
        if (d.n >= start && d.n <= end) {
          return Object.assign({}, d, {
            hardLevels: hard,
            specialMission: rangeSpecial
          });
        }
        return d;
      });
      Store.updateDaysConfig(cohort.id, updated);
      if (toast) toast.show({ intent: 'success', message: 'تنظیمات به روزهای ' + Names.toPersianDigits(start) + ' تا ' + Names.toPersianDigits(end) + ' اعمال شد.' });
    }

    function handleConfirmClearAll() {
      if (dangerConfirmText.trim() !== 'پاک کن') return;
      Store.clearAllData();
      setDangerModalOpen(false);
      setDangerConfirmText('');
      if (toast) toast.show({ intent: 'danger', message: 'تمام داده‌های برنامه پاک شدند.' });
      window.location.reload();
    }

    return h('div', { className: 'bsh-stack bsh-stack--lg' },
      h('div', null,
        h('h2', { className: 'heading-md' }, 'تنظیمات دوره و سیستم'),
        h('p', { className: 'body-sm', style: { color: 'var(--text-subtle)' } },
          'پیکربندی روزهای ۳۰‌گانه دوره فعال، پشتیبان‌گیری، تست‌ها و پاکسازی حافظه.'
        )
      ),

      h(B.Tabs, {
        items: [
          { id: 'days', label: 'تنظیمات روزها (۳۰ روز)' },
          { id: 'danger', label: 'منطقه‌ی خطر و مدیریت داده‌ها' }
        ],
        value: subTab,
        onChange: function (id) { setSubTab(id); }
      }),

      subTab === 'days' ? (
        h('div', { style: { display: 'grid', gap: 'var(--space-4)' } },
          // کارت اعمال دسته‌جمعی به بازه
          h(B.Card, { padding: 'md' },
            h('div', { className: 'title', style: { marginBottom: 'var(--space-2)' } }, 'اعمال سریع به بازه‌ای از روزها'),
            h('div', {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 'var(--space-3)',
                alignItems: 'flex-end'
              }
            },
              h(B.TextField, {
                label: 'از روز',
                type: 'number',
                value: rangeStart,
                onChange: function (e) { setRangeStart(e.target.value); }
              }),
              h(B.TextField, {
                label: 'تا روز',
                type: 'number',
                value: rangeEnd,
                onChange: function (e) { setRangeEnd(e.target.value); }
              }),
              h(B.Select, {
                label: 'سطح کار سخت',
                options: [
                  { value: '0', label: 'بدون کار سخت (۰)' },
                  { value: '1', label: '۱ سطح' },
                  { value: '2', label: '۲ سطح' },
                  { value: '3', label: '۳ سطح' }
                ],
                value: rangeHard,
                onChange: function (e) { setRangeHard(e.target.value); }
              }),
              h('div', { style: { paddingBottom: 'var(--space-2)' } },
                h(B.Checkbox, {
                  label: 'مأموریت ویژه دارد',
                  checked: rangeSpecial,
                  onChange: function (e) { setRangeSpecial(e.target.checked); }
                })
              ),
              h('div', null,
                h(B.Button, {
                  variant: 'secondary',
                  onClick: handleApplyToRange
                }, 'اعمال به بازه')
              )
            )
          ),

          // جدول ۳۰ روزه
          h('div', {
            style: {
              overflowX: 'auto',
              border: 'var(--border-width-thin) solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)'
            }
          },
            h('table', {
              className: 'bsh-table',
              style: { borderCollapse: 'collapse', width: '100%', minWidth: 'var(--container-sm)' }
            },
              h('thead', null,
                h('tr', null,
                  h('th', { className: 'label-sm is-num', style: { textAlign: 'center', width: 60 } }, 'روز'),
                  h('th', { className: 'label-sm', style: { minWidth: 'var(--space-32)' } }, 'تاریخ شمسی'),
                  h('th', { className: 'label-sm', style: { minWidth: 'var(--space-32)' } }, 'نوع روز'),
                  h('th', { className: 'label-sm', style: { minWidth: 'var(--space-32)' } }, 'سطح کار سخت'),
                  h('th', { className: 'label-sm', style: { minWidth: 120, textAlign: 'center' } }, 'مأموریت ویژه'),
                  h('th', { className: 'label-sm', style: { minWidth: 100, textAlign: 'center' } }, 'اقدام')
                )
              ),
              h('tbody', null,
                days.map(function (d) {
                  var dayDate = Names.addDaysToIso(cohort.startDate, d.n - 1);
                  var dayShamsi = Names.formatShamsi(dayDate);

                  return h('tr', { key: d.n },
                    h('td', { className: 'body-sm is-num', style: { textAlign: 'center', fontWeight: 600 } },
                      Names.toPersianDigits(d.n)
                    ),
                    h('td', { className: 'body-sm' }, dayShamsi),
                    h('td', null,
                      h(B.Select, {
                        size: 'sm',
                        options: [
                          { value: 'warmup', label: 'گرم‌کردن' },
                          { value: 'main', label: 'اصلی' },
                          { value: 'review', label: 'مرور' }
                        ],
                        value: d.type,
                        onChange: function (e) {
                          handleDayChange(d.n, 'type', e.target.value);
                        }
                      })
                    ),
                    h('td', null,
                      h(B.Select, {
                        size: 'sm',
                        disabled: d.type !== 'main',
                        options: [
                          { value: '0', label: 'بدون کار سخت (۰)' },
                          { value: '1', label: '۱ سطح' },
                          { value: '2', label: '۲ سطح' },
                          { value: '3', label: '۳ سطح' }
                        ],
                        value: String(d.hardLevels != null ? d.hardLevels : 3),
                        onChange: function (e) {
                          handleDayChange(d.n, 'hardLevels', parseInt(e.target.value, 10));
                        }
                      })
                    ),
                    h('td', { style: { textAlign: 'center' } },
                      h(B.Checkbox, {
                        disabled: d.type !== 'main',
                        checked: !!d.specialMission,
                        onChange: function (e) {
                          handleDayChange(d.n, 'specialMission', e.target.checked);
                        }
                      })
                    ),
                    h('td', { style: { textAlign: 'center' } },
                      d.n > 1 && h(B.Button, {
                        variant: 'ghost',
                        size: 'sm',
                        onClick: function () { handleCopyFromPrev(d.n); }
                      }, 'کپی از روز قبل')
                    )
                  );
                })
              )
            )
          )
        )
      ) : (
        // منطقه‌ی خطر
        h('div', { style: { display: 'grid', gap: 'var(--space-4)' } },
          // آرشیو کردن دوره
          h(B.Card, { padding: 'lg' },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' } },
              h('div', null,
                h('div', { className: 'title' }, 'آرشیو کردن این دوره'),
                h('p', { className: 'body-sm', style: { color: 'var(--text-subtle)' } },
                  'با آرشیو کردن دوره، ثبت روزانه برای آن قفل و فقط‌خواندنی می‌شود، اما امکان دریافت گزارش اکسل باقی می‌ماند.'
                )
              ),
              h(B.Switch, {
                label: cohort.archived ? 'دوره آرشیو شده است' : 'آرشیو نیست',
                checked: !!cohort.archived,
                onChange: function (e) {
                  Store.archiveCohort(cohort.id, e.target.checked);
                  if (toast) toast.show({ intent: 'info', message: e.target.checked ? 'دوره آرشیو شد.' : 'دوره از آرشیو خارج شد.' });
                }
              })
            )
          ),

          // آزمون‌های سیستم
          h(B.Card, { padding: 'lg' },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' } },
              h('div', null,
                h('div', { className: 'title' }, 'آزمون‌های صحت محاسبات'),
                h('p', { className: 'body-sm', style: { color: 'var(--text-subtle)' } },
                  'بررسی ۱۵ تست اجباری موتور امتیازدهی در مرورگر.'
                )
              ),
              h(B.Button, {
                variant: 'secondary',
                iconStart: 'ExternalLink',
                onClick: function () { window.open('tests.html', '_blank'); }
              }, 'اجرای صفحه تست‌ها')
            )
          ),

          // پاکسازی کامل داده‌ها (خطرناک)
          h(B.Card, {
            padding: 'lg',
            style: { border: 'var(--border-width-thin) solid var(--border-danger-subtle)', background: 'var(--surface-overlay)' }
          },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' } },
              h(B.Icon, { name: 'OctagonAlert', size: 'lg', className: 'text-danger' }),
              h('h3', { className: 'heading-sm', style: { color: 'var(--text-danger)' } }, 'منطقه‌ی خطر: پاک‌کردن همه‌ی داده‌ها')
            ),
            h('p', { className: 'body-sm', style: { color: 'var(--text-subtle)', marginBottom: 'var(--space-4)' } },
              'با این کار تمام دوره‌ها، گروه‌ها، افراد و رکوردهای ثبت‌شده در این مرورگر به طور کامل و غیرقابل بازگشت پاک خواهند شد. حتماً قبل از این کار، فایل پشتیبان (بکاپ) دریافت کنید.'
            ),
            h(B.Button, {
              variant: 'danger-bold',
              iconStart: 'Trash2',
              onClick: function () {
                setDangerConfirmText('');
                setDangerModalOpen(true);
              }
            }, 'پاک کردن همه‌ی داده‌ها')
          )
        )
      ),

      // دیالوگ تأیید پاکسازی با عبارت «پاک کن»
      dangerModalOpen && h(B.Dialog, {
        open: dangerModalOpen,
        onClose: function () { setDangerModalOpen(false); },
        title: 'هشدار: حذف کامل تمام اطلاعات برنامه',
        description: 'این عملیات غیرقابل بازگشت است. برای فعال شدن دکمه حذف، عبارت دقیق «پاک کن» را در کادر زیر بنویسید:',
        footer: h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
          h(B.Button, { variant: 'ghost', onClick: function () { setDangerModalOpen(false); } }, 'انصراف'),
          h(B.Button, {
            variant: 'danger-bold',
            disabled: dangerConfirmText.trim() !== 'پاک کن',
            onClick: handleConfirmClearAll
          }, 'پاک کن')
        ),
        size: 'sm',
        alert: true
      },
        h('div', { style: { padding: 'var(--space-2) 0' } },
          h(B.TextField, {
            label: 'عبارت تأیید (پاک کن)',
            value: dangerConfirmText,
            placeholder: 'پاک کن',
            onChange: function (e) { setDangerConfirmText(e.target.value); }
          })
        )
      )
    );
  }

  SupportApp.UISettings = {
    SettingsTab: SettingsTab
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupportApp.UISettings;
  }
})(typeof window !== 'undefined' ? window : globalThis);
