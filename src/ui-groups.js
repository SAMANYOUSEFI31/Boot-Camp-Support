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
  var Scoring = SupportApp.Scoring || {};

  /**
   * تب اصلی مدیریت گروه‌ها و افراد
   */
  function GroupsTab(props) {
    var cohort = props.cohort;
    var toast = props.toast;

    var [showAllGroups, setShowAllGroups] = root.React.useState(false);
    var [selectedGroupId, setSelectedGroupId] = root.React.useState(null);

    // دیالوگ‌های مدال
    var [groupModalOpen, setGroupModalOpen] = root.React.useState(false);
    var [groupToEdit, setGroupToEdit] = root.React.useState(null);

    var [deleteGroupTarget, setDeleteGroupTarget] = root.React.useState(null);

    var [pasteModalOpen, setPasteModalOpen] = root.React.useState(false);
    var [participantModalOpen, setParticipantModalOpen] = root.React.useState(false);
    var [participantToEdit, setParticipantToEdit] = root.React.useState(null);
    var [deleteParticipantTarget, setDeleteParticipantTarget] = root.React.useState(null);

    var [habitCountConfirmTarget, setHabitCountConfirmTarget] = root.React.useState(null);

    if (!cohort) return null;

    var allGroups = cohort.groups || [];
    var visibleGroups = showAllGroups ? allGroups : allGroups.filter(function (g) { return g.mine; });

    // انتخاب پیش‌فرض گروه اول
    root.React.useEffect(function () {
      if (visibleGroups.length && (!selectedGroupId || !visibleGroups.find(function (g) { return g.id === selectedGroupId; }))) {
        setSelectedGroupId(visibleGroups[0].id);
      }
    }, [visibleGroups.length, showAllGroups, selectedGroupId]);

    var activeGroup = allGroups.find(function (g) { return g.id === selectedGroupId; }) || visibleGroups[0] || null;

    return h('div', { className: 'bsh-stack bsh-stack--lg' },
      // هدر نوار ابزار گروه‌ها
      h('div', { className: 'bsh-row' },
        h('h2', { className: 'heading-md' }, 'مدیریت گروه‌ها و اعضا'),
        h(B.Button, {
          variant: 'primary',
          iconStart: 'Plus',
          onClick: function () {
            setGroupToEdit(null);
            setGroupModalOpen(true);
          }
        }, 'افزودن گروه'),
        h('div', { className: 'bsh-row__end' },
          h(B.Switch, {
            label: 'نمایش همه گروه‌ها (شامل گروه‌های دیگران)',
            checked: showAllGroups,
            onChange: function (e) { setShowAllGroups(e.target.checked); }
          })
        )
      ),

      // نوار لیست گروه‌ها (تب یا کارت‌های افقی)
      visibleGroups.length === 0 ? (
        h(B.Card, { padding: 'lg' },
          h(B.EmptyState, {
            icon: 'Inbox',
            title: 'هیچ گروهی یافت نشد',
            description: showAllGroups ? 'هنوز گروهی در این دوره تعریف نشده است.' : 'هیچ گروهی با علامت «مال من است» وجود ندارد. «نمایش همه» را بزنید یا گروه جدید بسازید.',
            action: h(B.Button, {
              variant: 'secondary',
              onClick: function () {
                setGroupToEdit(null);
                setGroupModalOpen(true);
              }
            }, 'افزودن اولین گروه')
          })
        )
      ) : (
        h('div', { className: 'bsh-stack' },
          // انتخابگر گروه با اسکرول افقی روی موبایل
          h('div', { style: { maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBlock: 'var(--space-1)' } },
            h(B.SegmentedControl, {
              label: 'انتخاب گروه',
              items: visibleGroups.map(function (g) {
                var count = (cohort.participants || []).filter(function (p) { return p.groupId === g.id; }).length;
                return {
                  id: g.id,
                  label: g.name + ' (' + Names.toPersianDigits(count) + ' نفر)'
                };
              }),
              value: activeGroup ? activeGroup.id : '',
              onChange: function (id) { setSelectedGroupId(id); }
            })
          ),

          // جزئیات گروه فعال
          activeGroup && h(GroupDetailsView, {
            cohort: cohort,
            group: activeGroup,
            allGroups: allGroups,
            onEditGroup: function (g) {
              setGroupToEdit(g);
              setGroupModalOpen(true);
            },
            onDeleteGroup: function (g) {
              setDeleteGroupTarget(g);
            },
            onAddPaste: function () {
              setPasteModalOpen(true);
            },
            onEditParticipant: function (p) {
              setParticipantToEdit(p);
              setParticipantModalOpen(true);
            },
            onDeleteParticipant: function (p) {
              setDeleteParticipantTarget(p);
            },
            onRequestHabitCountChange: function (p, newCount) {
              setHabitCountConfirmTarget({ participant: p, newCount: newCount });
            },
            toast: toast
          })
        )
      ),

      // دیالوگ افزودن / ویرایش گروه
      groupModalOpen && h(GroupModal, {
        open: groupModalOpen,
        cohort: cohort,
        group: groupToEdit,
        onClose: function () { setGroupModalOpen(false); },
        toast: toast
      }),

      // دیالوگ حذف گروه (با اخطار تعداد افراد)
      deleteGroupTarget && h(DeleteGroupAlert, {
        open: !!deleteGroupTarget,
        cohort: cohort,
        group: deleteGroupTarget,
        onClose: function () { setDeleteGroupTarget(null); },
        toast: toast
      }),

      // دیالوگ افزودن افراد با پیست متن
      pasteModalOpen && activeGroup && h(PasteParticipantsModal, {
        open: pasteModalOpen,
        cohort: cohort,
        group: activeGroup,
        onClose: function () { setPasteModalOpen(false); },
        toast: toast
      }),

      // دیالوگ ویرایش یک فرد
      participantModalOpen && h(ParticipantModal, {
        open: participantModalOpen,
        cohort: cohort,
        participant: participantToEdit,
        allGroups: allGroups,
        onClose: function () { setParticipantModalOpen(false); },
        toast: toast
      }),

      // دیالوگ حذف فرد
      deleteParticipantTarget && h(DeleteParticipantAlert, {
        open: !!deleteParticipantTarget,
        cohort: cohort,
        participant: deleteParticipantTarget,
        onClose: function () { setDeleteParticipantTarget(null); },
        toast: toast
      }),

      // دیالوگ تأیید تغییر تعداد عادت‌ها (به دلیل قفل بودن)
      habitCountConfirmTarget && h(HabitCountConfirmDialog, {
        open: !!habitCountConfirmTarget,
        cohort: cohort,
        target: habitCountConfirmTarget,
        onClose: function () { setHabitCountConfirmTarget(null); },
        toast: toast
      })
    );
  }

  /**
   * نمایش جزئیات و اعضای گروه + ماتریس ۲۱ روزه
   */
  function GroupDetailsView(props) {
    var cohort = props.cohort;
    var group = props.group;
    var allGroups = props.allGroups;
    var onEditGroup = props.onEditGroup;
    var onDeleteGroup = props.onDeleteGroup;
    var onAddPaste = props.onAddPaste;
    var onEditParticipant = props.onEditParticipant;
    var onDeleteParticipant = props.onDeleteParticipant;
    var onRequestHabitCountChange = props.onRequestHabitCountChange;
    var toast = props.toast;

    var [viewMode, setViewMode] = root.React.useState('members'); // 'members' یا 'matrix'
    var [statusFilter, setStatusFilter] = root.React.useState('all');

    var members = (cohort.participants || []).filter(function (p) {
      if (p.groupId !== group.id) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });

    var summary = Scoring.groupSummary(cohort, group, 8, true);

    // ستون‌های جدول اعضا
    var columns = [
      {
        key: 'rowNum',
        label: 'ردیف',
        numeric: true,
        render: function (row) { return Names.toPersianDigits(row.rowNum); }
      },
      {
        key: 'name',
        label: 'نام و نام خانوادگی',
        render: function (row) {
          return h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' } },
            h('span', { className: 'body-md', style: { fontWeight: 600 } }, row.name),
            row.status === 'frozen' && h(B.Badge, { intent: 'info', emphasis: 'subtle' }, 'فریز'),
            row.status === 'left' && h(B.Badge, { intent: 'neutral', emphasis: 'subtle' }, 'خارج شده')
          );
        }
      },
      {
        key: 'telegram',
        label: 'آیدی تلگرام',
        render: function (row) {
          if (!row.telegram) return h('span', { style: { color: 'var(--text-subtle)' } }, '—');
          return h('bdi', { className: 'code', dir: 'ltr' }, '@' + row.telegram);
        }
      },
      {
        key: 'habitCount',
        label: 'تعداد عادت‌ها',
        numeric: true,
        render: function (row) {
          // سلول ویرایش سریع با انتخاب ۱ تا ۴
          var options = [
            { value: '', label: 'تعیین نشده' },
            { value: '1', label: '۱ عادت' },
            { value: '2', label: '۲ عادت' },
            { value: '3', label: '۳ عادت' },
            { value: '4', label: '۴ عادت' }
          ];

          return h('div', { style: { maxInlineSize: 'calc(var(--space-16) * 2)' } },
            h(B.Select, {
              size: 'sm',
              options: options,
              value: row.habitCount != null ? String(row.habitCount) : '',
              onChange: function (e) {
                var val = e.target.value ? parseInt(e.target.value, 10) : null;
                if (row.habitCount != null && val !== row.habitCount) {
                  // از قبل تعیین شده بوده -> نیاز به دیالوگ تأیید
                  onRequestHabitCountChange(row, val);
                } else {
                  Store.updateParticipant(cohort.id, row.id, { habitCount: val });
                }
              }
            })
          );
        }
      },
      {
        key: 'actions',
        label: 'عملیات',
        render: function (row) {
          return h('div', { style: { display: 'flex', gap: 'var(--space-2)' } },
            h(B.IconButton, {
              icon: 'Pencil',
              size: 'sm',
              label: 'ویرایش ' + row.name,
              onClick: function () { onEditParticipant(row); }
            }),
            h(B.IconButton, {
              icon: 'Trash2',
              size: 'sm',
              variant: 'danger',
              label: 'حذف ' + row.name,
              onClick: function () { onDeleteParticipant(row); }
            })
          );
        }
      }
    ];

    return h(B.Card, { padding: 'lg', style: { display: 'grid', gap: 'var(--space-4)', minInlineSize: 0 } },
      // مشخصات گروه و دکمه‌های اقدام
      h('div', {
        className: 'bsh-row',
        style: {
          justifyContent: 'space-between',
          borderBlockEnd: 'var(--border-width-thin) solid var(--border-subtle)',
          paddingBlockEnd: 'var(--space-3)'
        }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' } },
          h('h3', { className: 'heading-sm' }, group.name),
          group.mine ? h(B.Badge, { intent: 'brand', emphasis: 'bold' }, 'گروه من') : h(B.Badge, { intent: 'neutral', emphasis: 'subtle' }, 'گروه دیگران'),
          h('span', { className: 'caption', style: { color: 'var(--text-subtle)' } },
            'امروز: ' + Names.toPersianDigits(summary.unrecordedTodayCount) + ' نفر هنوز ثبت نشده‌اند'
          )
        ),
        h('div', { style: { display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' } },
          h(B.Button, {
            variant: 'secondary',
            size: 'sm',
            iconStart: 'Plus',
            onClick: onAddPaste
          }, 'افزودن با پیست لیست'),
          h(B.Button, {
            variant: 'ghost',
            size: 'sm',
            iconStart: 'Pencil',
            onClick: function () { onEditGroup(group); }
          }, 'تنظیمات گروه'),
          h(B.Button, {
            variant: 'danger',
            size: 'sm',
            iconStart: 'Trash2',
            onClick: function () { onDeleteGroup(group); }
          }, 'حذف گروه')
        )
      ),

      // نوار سوئیچ بین جدول اعضا و نمای کلی ۲۱ روزه
      h('div', { className: 'bsh-row', style: { justifyContent: 'space-between' } },
        h(B.Tabs, {
          items: [
            { id: 'members', label: 'لیست اعضا (' + Names.toPersianDigits(members.length) + ' نفر)' },
            { id: 'matrix', label: 'نمای کلی پیشرفت (ماتریس ۲۱ روزه)' }
          ],
          value: viewMode,
          onChange: function (id) { setViewMode(id); }
        }),
        viewMode === 'members' && h('div', { style: { display: 'flex', gap: 'var(--space-2)' } },
          h(B.Select, {
            size: 'sm',
            options: [
              { value: 'all', label: 'همه وضعیت‌ها' },
              { value: 'active', label: 'فقط فعال' },
              { value: 'frozen', label: 'فقط فریز' },
              { value: 'left', label: 'فقط خارج شده' }
            ],
            value: statusFilter,
            onChange: function (e) { setStatusFilter(e.target.value); }
          })
        )
      ),

      // محتوای حالت انتخاب‌شده
      viewMode === 'members' ? (
        members.length === 0 ? (
          h(B.EmptyState, {
            icon: 'User',
            title: 'عضوی در این گروه نیست',
            description: 'می‌توانید با پیست کردن لیست اسامی، اعضای گروه را وارد کنید.',
            action: h(B.Button, { variant: 'secondary', onClick: onAddPaste }, 'افزودن اعضا')
          })
        ) : (
          h(B.Table, {
            caption: 'لیست اعضای ' + group.name,
            columns: columns,
            rows: members.map(function (m, idx) {
              return Object.assign({}, m, { rowNum: idx + 1 });
            })
          })
        )
      ) : (
        h(GroupMatrixView, {
          cohort: cohort,
          group: group,
          members: members
        })
      )
    );
  }

  /**
   * جدول نمای کلی ماتریس ۲۱ روزه با ستون نام چسبان و اسکرول افقی
   */
  function GroupMatrixView(props) {
    var cohort = props.cohort;
    var group = props.group;
    var members = props.members;

    var mainDays = (cohort.days || []).filter(function (d) { return d.type === 'main'; });
    var closedDays = group.closedDays || [];

    if (!members.length) {
      return h(B.EmptyState, {
        icon: 'ChartColumn',
        title: 'عضوی برای نمایش ماتریس وجود ندارد',
        description: 'ابتدا به این گروه عضو اضافه کنید.'
      });
    }

    return h('div', {
      className: 'bsh-matrix-wrap',
      style: {
        overflowX: 'auto',
        maxWidth: '100%',
        border: 'var(--border-width-thin) solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)'
      }
    },
      h('table', {
        className: 'bsh-table',
        style: { borderCollapse: 'collapse', width: '100%', minWidth: 'calc(var(--container-md) + var(--space-16) * 2)' }
      },
        h('thead', null,
          h('tr', null,
            h('th', {
              className: 'label-sm bsh-sticky-right',
              style: {
                borderBlockEnd: 'var(--border-width-thick) solid var(--border-subtle)',
                minWidth: 'calc(var(--space-16) * 2.5)'
              }
            }, 'نام فرد'),
            mainDays.map(function (d) {
              var isClosed = closedDays.indexOf(d.n) !== -1;
              var dayDate = Names.addDaysToIso(cohort.startDate, d.n - 1);
              var shamsi = Names.formatShamsiShort(dayDate);
              return h('th', {
                key: d.n,
                className: 'label-sm is-num',
                style: {
                  textAlign: 'center',
                  background: isClosed ? 'var(--bg-neutral-subtle)' : 'var(--surface-raised)',
                  minWidth: 'calc(var(--space-12) + var(--space-1) + var(--space-1))',
                  padding: 'var(--space-2)'
                }
              },
                h('div', null, 'ر' + Names.toPersianDigits(d.n)),
                h('div', { className: 'caption', style: { color: 'var(--text-subtle)' } }, shamsi),
                h('div', null,
                  isClosed
                    ? h(B.Badge, { intent: 'success', emphasis: 'subtle', icon: 'Check' }, 'بسته')
                    : h(B.Badge, { intent: 'neutral', emphasis: 'subtle' }, 'باز')
                )
              );
            }),
            h('th', { className: 'label-sm is-num', style: { textAlign: 'center', minWidth: 64 } }, 'مجموع'),
            h('th', { className: 'label-sm is-num', style: { textAlign: 'center', minWidth: 64 } }, 'حداکثر'),
            h('th', { className: 'label-sm is-num', style: { textAlign: 'center', minWidth: 64 } }, 'درصد')
          )
        ),
        h('tbody', null,
          members.map(function (p) {
            var totals = Scoring.personTotals(p, cohort, group);
            return h('tr', { key: p.id },
              // ستون نام چسبان
              h('td', {
                className: 'body-sm bsh-sticky-right',
                style: {
                  fontWeight: 600,
                  borderInlineEnd: 'var(--border-width-thin) solid var(--border-subtle)'
                }
              },
                p.name,
                p.status === 'frozen' && h('span', { className: 'caption', style: { color: 'var(--text-info)', marginInlineStart: 'var(--space-1)' } }, '(فریز)')
              ),
              // ستون‌های روزهای اصلی
              mainDays.map(function (d) {
                var isClosed = closedDays.indexOf(d.n) !== -1;
                var rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][d.n]) || null;
                var hasRec = rec && (rec.done != null || rec.hard != null || rec.special != null);

                var content = '—';
                var cellIntent = null;

                if (isClosed) {
                  var sc = Scoring.dayScore(p, rec, d);
                  content = Names.toPersianDigits(sc);
                  cellIntent = sc > 0 ? 'var(--text-success)' : 'var(--text-subtlest)';
                } else if (hasRec) {
                  var tempSc = Scoring.dayScore(p, rec, d);
                  content = Names.toPersianDigits(tempSc);
                  cellIntent = 'var(--text-warning)';
                }

                return h('td', {
                  key: d.n,
                  className: 'body-sm is-num',
                  style: {
                    textAlign: 'center',
                    color: cellIntent || 'var(--text-subtle)'
                  }
                }, content);
              }),
              h('td', { className: 'body-sm is-num', style: { textAlign: 'center', fontWeight: 700 } }, Names.toPersianDigits(totals.totalScore)),
              h('td', { className: 'body-sm is-num', style: { textAlign: 'center' } }, Names.toPersianDigits(totals.totalMax)),
              h('td', { className: 'body-sm is-num', style: { textAlign: 'center', fontWeight: 700 } }, Names.toPersianDigits(totals.percent) + '٪')
            );
          })
        )
      )
    );
  }

  /**
   * دیالوگ افزودن / ویرایش گروه
   */
  function GroupModal(props) {
    var open = props.open;
    var cohort = props.cohort;
    var group = props.group;
    var onClose = props.onClose;
    var toast = props.toast;

    var isEdit = !!group;
    var [name, setName] = root.React.useState(isEdit ? group.name : '');
    var [isMine, setIsMine] = root.React.useState(isEdit ? group.mine : true);
    var [errorMsg, setErrorMsg] = root.React.useState('');

    root.React.useEffect(function () {
      if (open) {
        setName(group ? group.name : 'گروه ' + Names.toPersianDigits((cohort.groups || []).length + 1));
        setIsMine(group ? group.mine : true);
        setErrorMsg('');
      }
    }, [open, group]);

    if (!open) return null;

    function handleSave() {
      var trimmed = name.trim();
      if (!trimmed) {
        setErrorMsg('نام گروه الزامی است.');
        return;
      }

      if (isEdit) {
        Store.updateGroup(cohort.id, group.id, {
          name: trimmed,
          mine: isMine
        });
        if (toast) toast.show({ intent: 'success', message: 'گروه به‌روزرسانی شد.' });
      } else {
        Store.addGroup(cohort.id, {
          name: trimmed,
          mine: isMine
        });
        if (toast) toast.show({ intent: 'success', message: 'گروه افزوده شد.' });
      }
      onClose();
    }

    var footer = h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
      h(B.Button, { variant: 'ghost', onClick: onClose }, 'انصراف'),
      h(B.Button, { variant: 'primary', onClick: handleSave }, isEdit ? 'ذخیره تغییرات' : 'افزودن گروه')
    );

    return h(B.Dialog, {
      open: open,
      onClose: onClose,
      title: isEdit ? 'ویرایش گروه' : 'افزودن گروه جدید',
      footer: footer,
      size: 'sm'
    },
      h('div', { style: { display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' } },
        errorMsg && h(B.Alert, { intent: 'danger' }, errorMsg),
        h(B.TextField, {
          label: 'نام گروه',
          value: name,
          onChange: function (e) { setName(e.target.value); },
          required: true
        }),
        h(B.Switch, {
          label: 'این گروه مال من است (مسئولیت من است)',
          checked: isMine,
          onChange: function (e) { setIsMine(e.target.checked); }
        })
      )
    );
  }

  /**
   * دیالوگ حذف گروه (با نمایش تعداد افرادی که پاک می‌شوند)
   */
  function DeleteGroupAlert(props) {
    var open = props.open;
    var cohort = props.cohort;
    var group = props.group;
    var onClose = props.onClose;
    var toast = props.toast;

    if (!open || !group) return null;

    var count = (cohort.participants || []).filter(function (p) { return p.groupId === group.id; }).length;

    function handleConfirmDelete() {
      Store.deleteGroup(cohort.id, group.id);
      if (toast) toast.show({ intent: 'danger', message: 'گروه و ' + Names.toPersianDigits(count) + ' عضو آن پاک شدند.' });
      onClose();
    }

    var footer = h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
      h(B.Button, { variant: 'ghost', onClick: onClose }, 'انصراف'),
      h(B.Button, { variant: 'danger-bold', onClick: handleConfirmDelete }, 'حذف گروه و اعضا')
    );

    return h(B.Dialog, {
      open: open,
      onClose: onClose,
      title: 'حذف ' + group.name,
      description: 'آیا از حذف این گروه اطمینان دارید؟ با حذف گروه، تمام ' + Names.toPersianDigits(count) + ' عضو این گروه و رکوردهای آنها نیز حذف خواهند شد.',
      footer: footer,
      size: 'sm',
      alert: true
    });
  }

  /**
   * افزودن افراد با پیست یک لیست (هر خط یک نام)
   */
  function PasteParticipantsModal(props) {
    var open = props.open;
    var cohort = props.cohort;
    var group = props.group;
    var onClose = props.onClose;
    var toast = props.toast;

    var [text, setText] = root.React.useState('');
    var [habitCount, setHabitCount] = root.React.useState('3');
    var [errorMsg, setErrorMsg] = root.React.useState('');

    root.React.useEffect(function () {
      if (open) {
        setText('');
        setHabitCount('3');
        setErrorMsg('');
      }
    }, [open]);

    if (!open) return null;

    function handleAdd() {
      var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) {
        setErrorMsg('هیچ نامی وارد نشده است.');
        return;
      }

      var items = lines.map(function (l) {
        // اگر فرمت شامل تلگرام هم بود مثلاً: علی رضایی @ali
        var parts = l.split(/[@\t,]/);
        var name = parts[0].trim();
        var tel = parts[1] ? parts[1].trim() : '';
        return {
          name: name,
          telegram: tel,
          groupId: group.id,
          habitCount: parseInt(habitCount, 10) || 3
        };
      });

      Store.addParticipants(cohort.id, group.id, items);
      if (toast) toast.show({ intent: 'success', message: Names.toPersianDigits(items.length) + ' نفر افزوده شدند.' });
      onClose();
    }

    var footer = h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
      h(B.Button, { variant: 'ghost', onClick: onClose }, 'انصراف'),
      h(B.Button, { variant: 'primary', onClick: handleAdd }, 'افزودن به گروه')
    );

    return h(B.Dialog, {
      open: open,
      onClose: onClose,
      title: 'افزودن اعضا به ' + group.name,
      description: 'نام افراد را وارد کنید (هر خط یک نفر). می‌توانید آیدی تلگرام را هم در ادامه نام بگذارید.',
      footer: footer,
      size: 'md'
    },
      h('div', { style: { display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' } },
        errorMsg && h(B.Alert, { intent: 'danger' }, errorMsg),
        h(B.Textarea, {
          label: 'لیست اسامی (هر خط یک نفر)',
          placeholder: 'علی رضایی @ali_rez\nسارا احمدی\nرضا کاظمی',
          rows: 6,
          value: text,
          onChange: function (e) { setText(e.target.value); }
        }),
        h(B.Select, {
          label: 'تعداد عادت‌های اولیه برای این افراد',
          options: [
            { value: '1', label: '۱ عادت' },
            { value: '2', label: '۲ عادت' },
            { value: '3', label: '۳ عادت' },
            { value: '4', label: '۴ عادت' }
          ],
          value: habitCount,
          onChange: function (e) { setHabitCount(e.target.value); }
        })
      )
    );
  }

  /**
   * دیالوگ ویرایش یک فرد
   */
  function ParticipantModal(props) {
    var open = props.open;
    var cohort = props.cohort;
    var participant = props.participant;
    var allGroups = props.allGroups;
    var onClose = props.onClose;
    var toast = props.toast;

    var [name, setName] = root.React.useState(participant ? participant.name : '');
    var [telegram, setTelegram] = root.React.useState(participant ? participant.telegram : '');
    var [groupId, setGroupId] = root.React.useState(participant ? participant.groupId : '');
    var [status, setStatus] = root.React.useState(participant ? participant.status : 'active');
    var [habitCount, setHabitCount] = root.React.useState(participant && participant.habitCount != null ? String(participant.habitCount) : '');
    var [errorMsg, setErrorMsg] = root.React.useState('');

    root.React.useEffect(function () {
      if (open && participant) {
        setName(participant.name);
        setTelegram(participant.telegram || '');
        setGroupId(participant.groupId);
        setStatus(participant.status || 'active');
        setHabitCount(participant.habitCount != null ? String(participant.habitCount) : '');
        setErrorMsg('');
      }
    }, [open, participant]);

    if (!open || !participant) return null;

    function handleSave() {
      var trimmed = name.trim();
      if (!trimmed) {
        setErrorMsg('نام نمی‌تواند خالی باشد.');
        return;
      }

      Store.updateParticipant(cohort.id, participant.id, {
        name: trimmed,
        telegram: telegram.trim(),
        groupId: groupId,
        status: status,
        habitCount: habitCount ? parseInt(habitCount, 10) : null
      });

      if (toast) toast.show({ intent: 'success', message: 'مشخصات فرد ذخیره شد.' });
      onClose();
    }

    var footer = h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
      h(B.Button, { variant: 'ghost', onClick: onClose }, 'انصراف'),
      h(B.Button, { variant: 'primary', onClick: handleSave }, 'ذخیره تغییرات')
    );

    return h(B.Dialog, {
      open: open,
      onClose: onClose,
      title: 'ویرایش مشخصات فرد',
      footer: footer,
      size: 'sm'
    },
      h('div', { style: { display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-2) 0' } },
        errorMsg && h(B.Alert, { intent: 'danger' }, errorMsg),
        h(B.TextField, {
          label: 'نام و نام خانوادگی',
          value: name,
          onChange: function (e) { setName(e.target.value); },
          required: true
        }),
        h(B.TextField, {
          label: 'آیدی تلگرام',
          dir: 'ltr',
          placeholder: 'username',
          value: telegram,
          onChange: function (e) { setTelegram(e.target.value); }
        }),
        h(B.Select, {
          label: 'گروه اختصاص‌یافته',
          options: allGroups.map(function (g) { return { value: g.id, label: g.name }; }),
          value: groupId,
          onChange: function (e) { setGroupId(e.target.value); }
        }),
        h(B.Select, {
          label: 'وضعیت فرد',
          options: [
            { value: 'active', label: 'فعال' },
            { value: 'frozen', label: 'فریز شده' },
            { value: 'left', label: 'خارج شده' }
          ],
          value: status,
          onChange: function (e) { setStatus(e.target.value); }
        }),
        h(B.Select, {
          label: 'تعداد عادت‌ها (۱ تا ۴)',
          options: [
            { value: '', label: 'تعیین نشده' },
            { value: '1', label: '۱ عادت' },
            { value: '2', label: '۲ عادت' },
            { value: '3', label: '۳ عادت' },
            { value: '4', label: '۴ عادت' }
          ],
          value: habitCount,
          onChange: function (e) { setHabitCount(e.target.value); }
        })
      )
    );
  }

  /**
   * دیالوگ حذف یک فرد
   */
  function DeleteParticipantAlert(props) {
    var open = props.open;
    var cohort = props.cohort;
    var participant = props.participant;
    var onClose = props.onClose;
    var toast = props.toast;

    if (!open || !participant) return null;

    function handleConfirm() {
      Store.deleteParticipant(cohort.id, participant.id);
      if (toast) toast.show({ intent: 'danger', message: '«' + participant.name + '» حذف شد.' });
      onClose();
    }

    var footer = h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
      h(B.Button, { variant: 'ghost', onClick: onClose }, 'انصراف'),
      h(B.Button, { variant: 'danger-bold', onClick: handleConfirm }, 'حذف فرد')
    );

    return h(B.Dialog, {
      open: open,
      onClose: onClose,
      title: 'حذف ' + participant.name,
      description: 'آیا از حذف این فرد از دوره اطمینان دارید؟ تمام رکوردهای ثبت‌شده او نیز حذف خواهند شد.',
      footer: footer,
      size: 'sm',
      alert: true
    });
  }

  /**
   * دیالوگ تأیید تغییر تعداد عادت‌ها (به دلیل قفل بودن برای کل دوره)
   */
  function HabitCountConfirmDialog(props) {
    var open = props.open;
    var cohort = props.cohort;
    var target = props.target; // { participant, newCount }
    var onClose = props.onClose;
    var toast = props.toast;

    if (!open || !target) return null;

    var p = target.participant;
    var newCount = target.newCount;

    function handleConfirm() {
      Store.updateParticipant(cohort.id, p.id, { habitCount: newCount });
      if (toast) toast.show({ intent: 'success', message: 'تعداد عادت‌های ' + p.name + ' تغییر یافت.' });
      onClose();
    }

    var footer = h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' } },
      h(B.Button, { variant: 'ghost', onClick: onClose }, 'انصراف'),
      h(B.Button, { variant: 'primary', onClick: handleConfirm }, 'تأیید تغییر')
    );

    return h(B.Dialog, {
      open: open,
      onClose: onClose,
      title: 'تغییر تعداد عادت‌های ' + p.name,
      description: 'تعداد عادت‌ها برای کل دوره تعیین می‌شود. آیا مطمئنید که می‌خواهید آن را از ' + Names.toPersianDigits(p.habitCount) + ' به ' + (newCount != null ? Names.toPersianDigits(newCount) : 'تعیین‌نشده') + ' تغییر دهید؟ این کار محاسبات حداکثر امتیاز را تغییر می‌دهد.',
      footer: footer,
      size: 'sm'
    });
  }

  SupportApp.UIGroups = {
    GroupsTab: GroupsTab
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupportApp.UIGroups;
  }
})(typeof window !== 'undefined' ? window : globalThis);
