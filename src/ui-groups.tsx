/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { B } from './bushido';
import { Names } from './names';
import { Scoring } from './scoring';
import type { Cohort, Group, Participant, Toast } from './types';
import type { TableProps } from '../ds/components';
import { Store } from './store';
import { HelpHint } from './help-hint';
import { calculateCurrentDayNumber } from './daily/DailyScoringTab';

/**
 * تب اصلی مدیریت گروه‌ها و افراد
 */
interface HabitCountTarget {
  participant: Participant;
  newCount: number | null;
}

function GroupsTab(props: { cohort: Cohort; toast?: Toast }) {
  const cohort = props.cohort;
  const toast = props.toast;

  const [showAllGroups, setShowAllGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // دیالوگ‌های مدال
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<Group | null>(null);

  const [deleteGroupTarget, setDeleteGroupTarget] = useState<Group | null>(null);

  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [participantToEdit, setParticipantToEdit] = useState<Participant | null>(null);
  const [deleteParticipantTarget, setDeleteParticipantTarget] = useState<Participant | null>(null);

  const [habitCountConfirmTarget, setHabitCountConfirmTarget] = useState<HabitCountTarget | null>(null);

  const allGroups = cohort.groups || [];
  const visibleGroups = showAllGroups
    ? allGroups
    : allGroups.filter(function (g) {
        return g.mine;
      });

  // انتخاب پیش‌فرض گروه اول
  useEffect(
    function () {
      if (
        visibleGroups.length &&
        (!selectedGroupId ||
          !visibleGroups.find(function (g) {
            return g.id === selectedGroupId;
          }))
      ) {
        setSelectedGroupId(visibleGroups[0].id);
      }
    },
    [visibleGroups.length, showAllGroups, selectedGroupId]
  );

  const activeGroup =
    allGroups.find(function (g) {
      return g.id === selectedGroupId;
    }) ||
    visibleGroups[0] ||
    null;

  return (
    <div className="bsh-stack bsh-stack--lg">
      <div className="bsh-row">
        <h2 className="heading-md">گروه‌ها و افراد</h2>
        <B.Button
          variant="primary"
          iconStart="Plus"
          onClick={function () {
            setGroupToEdit(null);
            setGroupModalOpen(true);
          }}
        >
          افزودن گروه
        </B.Button>
        <div className="bsh-row__end">
          <B.Switch
            label="نمایش همه گروه‌ها"
            checked={showAllGroups}
            onChange={function (e) {
              setShowAllGroups(e.target.checked);
            }}
          />
          <HelpHint help="mine" />
        </div>
      </div>
      {visibleGroups.length === 0 ? (
        <B.Card padding="lg">
          <B.EmptyState
            icon="Inbox"
            title="گروهی نیست"
            description={
              showAllGroups
                ? 'هنوز گروهی نساخته‌ای. اولین گروه را بساز.'
                : 'گروه منی نیست. «نمایش همه گروه‌ها» را روشن کن یا گروه تازه بساز.'
            }
            action={
              <B.Button
                variant="secondary"
                onClick={function () {
                  setGroupToEdit(null);
                  setGroupModalOpen(true);
                }}
              >
                ساخت اولین گروه
              </B.Button>
            }
          />
        </B.Card>
      ) : (
        <div className="bsh-stack">
          <div
            style={{
              maxWidth: '100%',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingBlock: 'var(--space-1)'
            }}
          >
            {visibleGroups.length > 5 ? (
              <B.Select
                label="گروه"
                options={visibleGroups.map(function (g) {
                  const count = (cohort.participants || []).filter(function (p) {
                    return p.groupId === g.id;
                  }).length;
                  return { value: g.id, label: g.name + ' (' + Names.toPersianDigits(count) + ' نفر)' };
                })}
                value={activeGroup ? activeGroup.id : ''}
                onChange={function (e) {
                  setSelectedGroupId(e.target.value);
                }}
              />
            ) : (
              <B.SegmentedControl
                label="انتخاب گروه"
                items={visibleGroups.map(function (g) {
                  const count = (cohort.participants || []).filter(function (p) {
                    return p.groupId === g.id;
                  }).length;
                  return {
                    id: g.id,
                    label: g.name + ' (' + Names.toPersianDigits(count) + ' نفر)'
                  };
                })}
                value={activeGroup ? activeGroup.id : ''}
                onChange={function (id) {
                  setSelectedGroupId(id);
                }}
              />
            )}
          </div>
          {activeGroup && (
            <GroupDetailsView
              cohort={cohort}
              group={activeGroup}
              allGroups={allGroups}
              onEditGroup={function (g) {
                setGroupToEdit(g);
                setGroupModalOpen(true);
              }}
              onDeleteGroup={function (g) {
                setDeleteGroupTarget(g);
              }}
              onAddPaste={function () {
                setPasteModalOpen(true);
              }}
              onEditParticipant={function (p) {
                setParticipantToEdit(p);
                setParticipantModalOpen(true);
              }}
              onDeleteParticipant={function (p) {
                setDeleteParticipantTarget(p);
              }}
              onRequestHabitCountChange={function (p, newCount) {
                setHabitCountConfirmTarget({ participant: p, newCount: newCount });
              }}
              toast={toast}
            />
          )}
        </div>
      )}
      {groupModalOpen && (
        <GroupModal
          open={groupModalOpen}
          cohort={cohort}
          group={groupToEdit}
          onClose={function () {
            setGroupModalOpen(false);
          }}
          toast={toast}
        />
      )}
      {deleteGroupTarget && (
        <DeleteGroupAlert
          open={!!deleteGroupTarget}
          cohort={cohort}
          group={deleteGroupTarget}
          onClose={function () {
            setDeleteGroupTarget(null);
          }}
          toast={toast}
        />
      )}
      {pasteModalOpen && activeGroup && (
        <PasteParticipantsModal
          open={pasteModalOpen}
          cohort={cohort}
          group={activeGroup}
          onClose={function () {
            setPasteModalOpen(false);
          }}
          toast={toast}
        />
      )}
      {participantModalOpen && (
        <ParticipantModal
          open={participantModalOpen}
          cohort={cohort}
          participant={participantToEdit}
          allGroups={allGroups}
          onClose={function () {
            setParticipantModalOpen(false);
          }}
          toast={toast}
        />
      )}
      {deleteParticipantTarget && (
        <DeleteParticipantAlert
          open={!!deleteParticipantTarget}
          cohort={cohort}
          participant={deleteParticipantTarget}
          onClose={function () {
            setDeleteParticipantTarget(null);
          }}
          toast={toast}
        />
      )}
      {habitCountConfirmTarget && (
        <HabitCountConfirmDialog
          open={!!habitCountConfirmTarget}
          cohort={cohort}
          target={habitCountConfirmTarget}
          onClose={function () {
            setHabitCountConfirmTarget(null);
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

/**
 * نمایش جزئیات و اعضای گروه + ماتریس ۲۱ روزه
 */
interface GroupDetailsViewProps {
  cohort: Cohort;
  group: Group;
  allGroups: Group[];
  onEditGroup: (g: Group) => void;
  onDeleteGroup: (g: Group) => void;
  onAddPaste: () => void;
  onEditParticipant: (p: Participant) => void;
  onDeleteParticipant: (p: Participant) => void;
  onRequestHabitCountChange: (p: Participant, newCount: number | null) => void;
  toast?: Toast;
}

function GroupDetailsView(props: GroupDetailsViewProps) {
  const cohort = props.cohort;
  const group = props.group;
  const allGroups = props.allGroups;
  const onEditGroup = props.onEditGroup;
  const onDeleteGroup = props.onDeleteGroup;
  const onAddPaste = props.onAddPaste;
  const onEditParticipant = props.onEditParticipant;
  const onDeleteParticipant = props.onDeleteParticipant;
  const onRequestHabitCountChange = props.onRequestHabitCountChange;
  const toast = props.toast;

  const [viewMode, setViewMode] = useState('members'); // 'members' یا 'matrix'
  const [statusFilter, setStatusFilter] = useState('all');

  const members = (cohort.participants || []).filter(function (p) {
    if (p.groupId !== group.id) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  // «امروز» = روز جاریِ دوره (نه یک روز ثابت)
  const todayN = calculateCurrentDayNumber(cohort.startDate);
  const todayCfg = (cohort.days || []).find(function (d) {
    return d.n === todayN;
  });
  const summary = Scoring.groupSummary(cohort, group, todayN, true);

  // ستون‌های جدول اعضا
  const columns: TableProps['columns'] = [
    {
      key: 'rowNum',
      label: 'ردیف',
      numeric: true,
      render: function (row) {
        return Names.toPersianDigits(row.rowNum);
      }
    },
    {
      key: 'name',
      label: 'نام و نام خانوادگی',
      render: function (row) {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="body-md" style={{ fontWeight: 600 }}>
              {row.name}
            </span>
            {row.status === 'frozen' && (
              <B.Badge intent="info" emphasis="subtle">
                فریز
              </B.Badge>
            )}
            {row.status === 'left' && (
              <B.Badge intent="neutral" emphasis="subtle">
                خارج‌شده
              </B.Badge>
            )}
          </div>
        );
      }
    },
    {
      key: 'telegram',
      label: 'آیدی تلگرام',
      render: function (row) {
        if (!row.telegram) return <span style={{ color: 'var(--text-subtle)' }}>—</span>;
        return (
          <bdi className="code" dir="ltr">
            {'@' + row.telegram}
          </bdi>
        );
      }
    },
    {
      key: 'habitCount',
      label: 'تعداد عادت',
      numeric: true,
      render: function (row) {
        // سلول ویرایش سریع با انتخاب ۱ تا ۴
        const options = [
          { value: '', label: 'تعیین‌نشده' },
          { value: '1', label: '۱ عادت' },
          { value: '2', label: '۲ عادت' },
          { value: '3', label: '۳ عادت' },
          { value: '4', label: '۴ عادت' }
        ];

        return (
          <div style={{ maxInlineSize: 'calc(var(--space-16) * 2)' }}>
            <B.Select
              size="sm"
              options={options}
              value={row.habitCount != null ? String(row.habitCount) : ''}
              onChange={function (e) {
                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                if (row.habitCount != null && val !== row.habitCount) {
                  // از قبل تعیین شده بوده -> نیاز به دیالوگ تأیید
                  onRequestHabitCountChange(row, val);
                } else {
                  Store.updateParticipant(cohort.id, row.id, { habitCount: val });
                }
              }}
            />
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: 'اقدام',
      render: function (row) {
        return (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <B.IconButton
              icon="Pencil"
              size="sm"
              label={'ویرایش ' + row.name}
              onClick={function () {
                onEditParticipant(row);
              }}
            />
            <B.IconButton
              icon="Trash2"
              size="sm"
              variant="danger"
              label={'حذف ' + row.name}
              onClick={function () {
                onDeleteParticipant(row);
              }}
            />
          </div>
        );
      }
    }
  ];

  return (
    <B.Card padding="lg" style={{ display: 'grid', gap: 'var(--space-4)', minInlineSize: 0 }}>
      <div
        className="bsh-row"
        style={{
          justifyContent: 'space-between',
          borderBlockEnd: 'var(--border-width-thin) solid var(--border-subtle)',
          paddingBlockEnd: 'var(--space-3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <h3 className="heading-sm">{group.name}</h3>
          {group.mine ? (
            <B.Badge intent="brand" emphasis="bold">
              گروه من
            </B.Badge>
          ) : (
            <B.Badge intent="neutral" emphasis="subtle">
              گروه دیگران
            </B.Badge>
          )}
          {todayCfg && todayCfg.type === 'main' && (
            <span className="caption" style={{ color: 'var(--text-subtle)' }}>
              {'امروز ' + Names.toPersianDigits(summary.unrecordedTodayCount) + ' نفر ثبت‌نشده'}
            </span>
          )}
          <HelpHint help="mine" />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <B.Button variant="secondary" size="sm" iconStart="Plus" onClick={onAddPaste}>
            افزودن افراد با لیست
          </B.Button>
          <B.Button
            variant="ghost"
            size="sm"
            iconStart="Pencil"
            onClick={function () {
              onEditGroup(group);
            }}
          >
            ویرایش گروه
          </B.Button>
          <B.Button
            variant="danger"
            size="sm"
            iconStart="Trash2"
            onClick={function () {
              onDeleteGroup(group);
            }}
          >
            حذف گروه
          </B.Button>
        </div>
      </div>
      <div className="bsh-row" style={{ justifyContent: 'space-between' }}>
        <B.Tabs
          items={[
            { id: 'members', label: 'افراد (' + Names.toPersianDigits(members.length) + ' نفر)' },
            { id: 'matrix', label: 'پیشرفت روزها' }
          ]}
          value={viewMode}
          onChange={function (id) {
            setViewMode(id);
          }}
        />
        {viewMode === 'members' && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <B.Select
              size="sm"
              options={[
                { value: 'all', label: 'همه وضعیت‌ها' },
                { value: 'active', label: 'فقط فعال' },
                { value: 'frozen', label: 'فقط فریز' },
                { value: 'left', label: 'فقط خارج‌شده' }
              ]}
              value={statusFilter}
              onChange={function (e) {
                setStatusFilter(e.target.value);
              }}
            />
            <HelpHint help="frozen" />
            <HelpHint help="habitCount" />
          </div>
        )}
      </div>
      {viewMode === 'members' ? (
        members.length === 0 ? (
          <B.EmptyState
            icon="User"
            title="فردی در این گروه نیست"
            description="اسم‌ها را کپی و بچسبان؛ هر خط یک نفر."
            action={
              <B.Button variant="secondary" onClick={onAddPaste}>
                افزودن افراد
              </B.Button>
            }
          />
        ) : (
          <B.Table
            caption={'افراد گروه ' + group.name}
            columns={columns}
            rows={members.map(function (m, idx) {
              return Object.assign({}, m, { rowNum: idx + 1 });
            })}
          />
        )
      ) : (
        <GroupMatrixView cohort={cohort} group={group} members={members} />
      )}
    </B.Card>
  );
}

/**
 * جدول نمای کلی ماتریس ۲۱ روزه با ستون نام چسبان و اسکرول افقی
 */
function GroupMatrixView(props: { cohort: Cohort; group: Group; members: Participant[] }) {
  const cohort = props.cohort;
  const group = props.group;
  const members = props.members;

  const mainDays = (cohort.days || []).filter(function (d) {
    return d.type === 'main';
  });
  const closedDays = group.closedDays || [];

  if (!members.length) {
    return (
      <B.EmptyState
        icon="ChartColumn"
        title="فردی برای نمایش نیست"
        description="اول به این گروه فرد اضافه کن."
      />
    );
  }

  return (
    <div
      className="bsh-matrix-wrap"
      style={{
        overflowX: 'auto',
        maxWidth: '100%',
        border: 'var(--border-width-thin) solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)'
      }}
    >
      <table
        className="bsh-table"
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          minWidth: 'calc(var(--container-md) + var(--space-16) * 2)'
        }}
      >
        <thead>
          <tr>
            <th
              className="label-sm bsh-sticky-right"
              style={{
                borderBlockEnd: 'var(--border-width-thick) solid var(--border-subtle)',
                minWidth: 'calc(var(--space-16) * 2.5)'
              }}
            >
              نام
            </th>
            {mainDays.map(function (d) {
              const isClosed = closedDays.indexOf(d.n) !== -1;
              const dayDate = Names.addDaysToIso(cohort.startDate, d.n - 1);
              const shamsi = Names.formatShamsiShort(dayDate);
              return (
                <th
                  key={d.n}
                  className="label-sm is-num"
                  style={{
                    textAlign: 'center',
                    background: isClosed ? 'var(--bg-neutral-subtle)' : 'var(--surface-raised)',
                    minWidth: 'calc(var(--space-12) + var(--space-1) + var(--space-1))',
                    padding: 'var(--space-2)'
                  }}
                >
                  <div>{'روز ' + Names.toPersianDigits(d.n)}</div>
                  <div className="caption" style={{ color: 'var(--text-subtle)' }}>
                    {shamsi}
                  </div>
                  <div>
                    {isClosed ? (
                      <B.Badge intent="success" emphasis="subtle" icon="Check">
                        بسته
                      </B.Badge>
                    ) : (
                      <B.Badge intent="neutral" emphasis="subtle">
                        باز
                      </B.Badge>
                    )}
                  </div>
                </th>
              );
            })}
            <th className="label-sm is-num" style={{ textAlign: 'center', minWidth: 64 }}>
              مجموع
            </th>
            <th className="label-sm is-num" style={{ textAlign: 'center', minWidth: 64 }}>
              حداکثر
            </th>
            <th className="label-sm is-num" style={{ textAlign: 'center', minWidth: 64 }}>
              درصد
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map(function (p) {
            const totals = Scoring.personTotals(p, cohort, group);
            return (
              <tr key={p.id}>
                <td
                  className="body-sm bsh-sticky-right"
                  style={{
                    fontWeight: 600,
                    borderInlineEnd: 'var(--border-width-thin) solid var(--border-subtle)'
                  }}
                >
                  {p.name}
                  {p.status === 'frozen' && (
                    <span
                      className="caption"
                      style={{ color: 'var(--text-info)', marginInlineStart: 'var(--space-1)' }}
                    >
                      (فریز)
                    </span>
                  )}
                </td>
                {mainDays.map(function (d) {
                  const isClosed = closedDays.indexOf(d.n) !== -1;
                  const rec = (cohort.records && cohort.records[p.id] && cohort.records[p.id][d.n]) || null;
                  const hasRec = rec && (rec.done != null || rec.hard != null || rec.special != null);

                  let content = '—';
                  let cellIntent = null;

                  if (isClosed) {
                    const sc = Scoring.dayScore(p, rec, d);
                    content = Names.toPersianDigits(sc);
                    cellIntent = sc > 0 ? 'var(--text-success)' : 'var(--text-subtlest)';
                  } else if (hasRec) {
                    const tempSc = Scoring.dayScore(p, rec, d);
                    content = Names.toPersianDigits(tempSc);
                    cellIntent = 'var(--text-warning)';
                  }

                  return (
                    <td
                      key={d.n}
                      className="body-sm is-num"
                      style={{
                        textAlign: 'center',
                        color: cellIntent || 'var(--text-subtle)'
                      }}
                    >
                      {content}
                    </td>
                  );
                })}
                <td className="body-sm is-num" style={{ textAlign: 'center', fontWeight: 700 }}>
                  {Names.toPersianDigits(totals.totalScore)}
                </td>
                <td className="body-sm is-num" style={{ textAlign: 'center' }}>
                  {Names.toPersianDigits(totals.totalMax)}
                </td>
                <td className="body-sm is-num" style={{ textAlign: 'center', fontWeight: 700 }}>
                  {Names.toPersianDigits(totals.percent) + '٪'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * دیالوگ افزودن / ویرایش گروه
 */
function GroupModal(props: {
  open: boolean;
  cohort: Cohort;
  group: Group | null;
  onClose: () => void;
  toast?: Toast;
}) {
  const open = props.open;
  const cohort = props.cohort;
  const group = props.group;
  const onClose = props.onClose;
  const toast = props.toast;

  const isEdit = !!group;
  const [name, setName] = useState(isEdit ? group.name : '');
  const [isMine, setIsMine] = useState(isEdit ? group.mine : true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(
    function () {
      if (open) {
        setName(group ? group.name : 'گروه ' + Names.toPersianDigits((cohort.groups || []).length + 1));
        setIsMine(group ? group.mine : true);
        setErrorMsg('');
      }
    },
    [open, group]
  );

  if (!open) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg('نام گروه را بنویس.');
      return;
    }

    if (isEdit) {
      Store.updateGroup(cohort.id, group.id, {
        name: trimmed,
        mine: isMine
      });
      if (toast) toast.show({ intent: 'success', message: 'گروه ذخیره شد.' });
    } else {
      Store.addGroup(cohort.id, {
        name: trimmed,
        mine: isMine
      });
      if (toast) toast.show({ intent: 'success', message: 'گروه افزوده شد.' });
    }
    onClose();
  };

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
      <B.Button variant="ghost" onClick={onClose}>
        انصراف
      </B.Button>
      <B.Button variant="primary" onClick={handleSave}>
        {isEdit ? 'ذخیره تغییرات' : 'افزودن گروه'}
      </B.Button>
    </div>
  );

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'ویرایش گروه' : 'گروه تازه'}
      footer={footer}
      size="sm"
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' }}>
        {errorMsg && <B.Alert intent="danger">{errorMsg}</B.Alert>}
        <B.TextField
          label="نام گروه"
          value={name}
          onChange={function (e) {
            setName(e.target.value);
          }}
          required={true}
        />
        <B.Switch
          label="گروه من (خودم پشتیبانش هستم)"
          checked={isMine}
          onChange={function (e) {
            setIsMine(e.target.checked);
          }}
        />
        <div className="bsh-help-row">
          <HelpHint help="mine" visibleLabel />
        </div>
      </div>
    </B.Dialog>
  );
}

/**
 * دیالوگ حذف گروه (با نمایش تعداد افرادی که پاک می‌شوند)
 */
function DeleteGroupAlert(props: {
  open: boolean;
  cohort: Cohort;
  group: Group | null;
  onClose: () => void;
  toast?: Toast;
}) {
  const open = props.open;
  const cohort = props.cohort;
  const group = props.group;
  const onClose = props.onClose;
  const toast = props.toast;

  if (!open || !group) return null;

  const count = (cohort.participants || []).filter(function (p) {
    return p.groupId === group.id;
  }).length;

  const handleConfirmDelete = () => {
    Store.deleteGroup(cohort.id, group.id);
    if (toast)
      toast.show({
        intent: 'danger',
        message: 'گروه و ' + Names.toPersianDigits(count) + ' فرد آن حذف شد.'
      });
    onClose();
  };

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
      <B.Button variant="ghost" onClick={onClose}>
        انصراف
      </B.Button>
      <B.Button variant="danger-bold" onClick={handleConfirmDelete}>
        حذف گروه و افراد
      </B.Button>
    </div>
  );

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title={'حذف ' + group.name}
      description={
        'گروه و ' +
        Names.toPersianDigits(count) +
        ' فرد آن، با همهٔ امتیازهایشان حذف می‌شود. برگشت ندارد؛ اگر لازم است اول بکاپ بگیر.'
      }
      footer={footer}
      size="sm"
      alert={true}
    />
  );
}

/**
 * افزودن افراد با پیست یک لیست (هر خط یک نام)
 */
function PasteParticipantsModal(props: {
  open: boolean;
  cohort: Cohort;
  group: Group;
  onClose: () => void;
  toast?: Toast;
}) {
  const open = props.open;
  const cohort = props.cohort;
  const group = props.group;
  const onClose = props.onClose;
  const toast = props.toast;

  const [text, setText] = useState('');
  const [habitCount, setHabitCount] = useState('3');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(
    function () {
      if (open) {
        setText('');
        setHabitCount('3');
        setErrorMsg('');
      }
    },
    [open]
  );

  if (!open) return null;

  function handleAdd() {
    const lines = text
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    if (!lines.length) {
      setErrorMsg('نامی ننوشته‌ای. اسم‌ها را بنویس یا بچسبان.');
      return;
    }

    const items = lines.map(function (l) {
      // اگر فرمت شامل تلگرام هم بود مثلاً: علی رضایی @ali
      const parts = l.split(/[@\t,]/);
      const name = parts[0].trim();
      const tel = parts[1] ? parts[1].trim() : '';
      return {
        name: name,
        telegram: tel,
        groupId: group.id,
        habitCount: parseInt(habitCount, 10) || 3
      };
    });

    Store.addParticipants(cohort.id, group.id, items);
    if (toast)
      toast.show({ intent: 'success', message: Names.toPersianDigits(items.length) + ' نفر افزوده شدند.' });
    onClose();
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
      <B.Button variant="ghost" onClick={onClose}>
        انصراف
      </B.Button>
      <B.Button variant="primary" onClick={handleAdd}>
        افزودن به گروه
      </B.Button>
    </div>
  );

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title={'افزودن افراد به ' + group.name}
      description="هر خط یک نفر. آیدی تلگرام را می‌توانی بعد از نام بنویسی."
      footer={footer}
      size="md"
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2) 0' }}>
        {errorMsg && <B.Alert intent="danger">{errorMsg}</B.Alert>}
        <B.Textarea
          label="لیست افراد"
          placeholder={'علی رضایی @ali_rez\nسارا احمدی\nرضا کاظمی'}
          rows={6}
          value={text}
          onChange={function (e) {
            setText(e.target.value);
          }}
        />
        <div className="bsh-field-wrap">
          <B.Select
            label="تعداد عادت این افراد"
            options={[
              { value: '1', label: '۱ عادت' },
              { value: '2', label: '۲ عادت' },
              { value: '3', label: '۳ عادت' },
              { value: '4', label: '۴ عادت' }
            ]}
            value={habitCount}
            onChange={function (e) {
              setHabitCount(e.target.value);
            }}
          />
          <HelpHint help="habitCount" corner />
        </div>
      </div>
    </B.Dialog>
  );
}

/**
 * دیالوگ ویرایش یک فرد
 */
function ParticipantModal(props: {
  open: boolean;
  cohort: Cohort;
  participant: Participant | null;
  allGroups: Group[];
  onClose: () => void;
  toast?: Toast;
}) {
  const open = props.open;
  const cohort = props.cohort;
  const participant = props.participant;
  const allGroups = props.allGroups;
  const onClose = props.onClose;
  const toast = props.toast;

  const [name, setName] = useState(participant ? participant.name : '');
  const [telegram, setTelegram] = useState(participant ? participant.telegram : '');
  const [groupId, setGroupId] = useState(participant ? participant.groupId : '');
  const [status, setStatus] = useState(participant ? participant.status : 'active');
  const [habitCount, setHabitCount] = useState(
    participant && participant.habitCount != null ? String(participant.habitCount) : ''
  );
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(
    function () {
      if (open && participant) {
        setName(participant.name);
        setTelegram(participant.telegram || '');
        setGroupId(participant.groupId);
        setStatus(participant.status || 'active');
        setHabitCount(participant.habitCount != null ? String(participant.habitCount) : '');
        setErrorMsg('');
      }
    },
    [open, participant]
  );

  if (!open || !participant) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg('نام را بنویس.');
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
  };

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
      <B.Button variant="ghost" onClick={onClose}>
        انصراف
      </B.Button>
      <B.Button variant="primary" onClick={handleSave}>
        ذخیره تغییرات
      </B.Button>
    </div>
  );

  return (
    <B.Dialog open={open} onClose={onClose} title="ویرایش مشخصات فرد" footer={footer} size="sm">
      <div style={{ display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
        {errorMsg && <B.Alert intent="danger">{errorMsg}</B.Alert>}
        <B.TextField
          label="نام و نام خانوادگی"
          value={name}
          onChange={function (e) {
            setName(e.target.value);
          }}
          required={true}
        />
        <B.TextField
          label="آیدی تلگرام"
          dir="ltr"
          placeholder="username"
          value={telegram}
          onChange={function (e) {
            setTelegram(e.target.value);
          }}
        />
        <B.Select
          label="گروه"
          options={allGroups.map(function (g) {
            return { value: g.id, label: g.name };
          })}
          value={groupId}
          onChange={function (e) {
            setGroupId(e.target.value);
          }}
        />
        <div className="bsh-field-wrap">
          <B.Select
            label="وضعیت فرد"
            options={[
              { value: 'active', label: 'فعال' },
              { value: 'frozen', label: 'فریز' },
              { value: 'left', label: 'خارج‌شده' }
            ]}
            value={status}
            onChange={function (e) {
              setStatus(e.target.value);
            }}
          />
          <HelpHint help="frozen" corner />
        </div>
        <div className="bsh-field-wrap">
          <B.Select
            label="تعداد عادت (۱ تا ۴)"
            options={[
              { value: '', label: 'تعیین‌نشده' },
              { value: '1', label: '۱ عادت' },
              { value: '2', label: '۲ عادت' },
              { value: '3', label: '۳ عادت' },
              { value: '4', label: '۴ عادت' }
            ]}
            value={habitCount}
            onChange={function (e) {
              setHabitCount(e.target.value);
            }}
          />
          <HelpHint help="habitCount" corner />
        </div>
      </div>
    </B.Dialog>
  );
}

/**
 * دیالوگ حذف یک فرد
 */
function DeleteParticipantAlert(props: {
  open: boolean;
  cohort: Cohort;
  participant: Participant | null;
  onClose: () => void;
  toast?: Toast;
}) {
  const open = props.open;
  const cohort = props.cohort;
  const participant = props.participant;
  const onClose = props.onClose;
  const toast = props.toast;

  if (!open || !participant) return null;

  const handleConfirm = () => {
    Store.deleteParticipant(cohort.id, participant.id);
    if (toast) toast.show({ intent: 'danger', message: '«' + participant.name + '» حذف شد.' });
    onClose();
  };

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
      <B.Button variant="ghost" onClick={onClose}>
        انصراف
      </B.Button>
      <B.Button variant="danger-bold" onClick={handleConfirm}>
        حذف فرد
      </B.Button>
    </div>
  );

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title={'حذف ' + participant.name}
      description="فرد با همهٔ امتیازهایش حذف می‌شود و برگشت ندارد. اگر فقط می‌خواهی از گزارش‌ها کنار برود، وضعیتش را «فریز» یا «خارج‌شده» کن."
      footer={footer}
      size="sm"
      alert={true}
    />
  );
}

/**
 * دیالوگ تأیید تغییر تعداد عادت‌ها (به دلیل قفل بودن برای کل دوره)
 */
function HabitCountConfirmDialog(props: {
  open: boolean;
  cohort: Cohort;
  target: HabitCountTarget | null;
  onClose: () => void;
  toast?: Toast;
}) {
  const open = props.open;
  const cohort = props.cohort;
  const target = props.target; // { participant, newCount }
  const onClose = props.onClose;
  const toast = props.toast;

  if (!open || !target) return null;

  const p = target.participant;
  const newCount = target.newCount;

  const handleConfirm = () => {
    Store.updateParticipant(cohort.id, p.id, { habitCount: newCount });
    if (toast) toast.show({ intent: 'success', message: 'تعداد عادت ' + p.name + ' عوض شد.' });
    onClose();
  };

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
      <B.Button variant="ghost" onClick={onClose}>
        انصراف
      </B.Button>
      <B.Button variant="primary" onClick={handleConfirm}>
        تغییر بده
      </B.Button>
    </div>
  );

  return (
    <B.Dialog
      open={open}
      onClose={onClose}
      title={'تغییر تعداد عادت ' + p.name}
      description={
        'تعداد عادت برای کل دوره است. با تغییر از ' +
        Names.toPersianDigits(p.habitCount) +
        ' به ' +
        (newCount != null ? Names.toPersianDigits(newCount) : 'تعیین‌نشده') +
        '، حداکثر امتیاز روزهای قبل هم دوباره حساب می‌شود.'
      }
      footer={footer}
      size="sm"
    />
  );
}

export { GroupsTab };
