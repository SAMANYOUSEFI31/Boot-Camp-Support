/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { B } from './bushido';
import { Names } from './names';
import { HelpHint } from './help-hint';
import { analyzeGroups, diffDays, mergeIntoCohort } from './merge-groups';
import type { GroupPlan, GroupPolicy, MergePlan, Side } from './merge-groups';
import type { Cohort } from './types';

const fa = Names.toPersianDigits;

const FIELD_FA = { habitCount: 'تعداد عادت', status: 'وضعیت', telegram: 'آیدی تلگرام' };

const daysText = (days: number[]) =>
  days.length ? 'روز ' + days.map((d) => fa(d)).join(' و ') + ' فرق دارد' : '';

/**
 * پیش‌نمایش ادغام یک دورهٔ فایل در یک دورهٔ موجود:
 * هر گروه به کدام گروه وصل می‌شود، تعارض‌ها، و شمارش آنچه اضافه می‌شود.
 */
export function MergePanel(props: {
  current: Cohort;
  file: Cohort;
  plan: MergePlan;
  onChange: (plan: MergePlan) => void;
}) {
  const { current, file, plan, onChange } = props;
  const analysis = analyzeGroups(current, file, plan);
  const result = mergeIntoCohort(current, file, plan);
  const s = result.stats;
  const daysDiff = diffDays(current, file);

  const setGroup = (id: string, patch: Partial<GroupPlan>) =>
    onChange({ ...plan, groups: { ...plan.groups, [id]: { ...plan.groups[id], ...patch } } });
  const setChoice = (key: string, v: Side) =>
    onChange({ ...plan, personChoices: { ...plan.personChoices, [key]: v } });

  const targetOptions = [{ value: 'new', label: 'گروه جدید' }].concat(
    (current.groups || []).map((g) => ({ value: g.id, label: g.name }))
  );

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {s.nothingNew ? (
        <B.Alert intent="info">چیز تازه‌ای نیست.</B.Alert>
      ) : (
        <B.Alert intent="success" title="با این انتخاب‌ها اضافه می‌شود">
          {fa(s.groupsAdded) +
            ' گروه · ' +
            fa(s.peopleAdded) +
            ' نفر · ' +
            fa(s.recordsAdded + s.recordsReplaced) +
            ' رکورد' +
            (s.fieldsFilled + s.fieldsReplaced
              ? ' · ' + fa(s.fieldsFilled + s.fieldsReplaced) + ' مشخصات فرد'
              : '')}
        </B.Alert>
      )}

      {daysDiff.count > 0 && (
        <B.Card padding="md">
          <B.RadioGroup
            legend="تنظیم روزها (نوع روز، سطح کار سخت) از کدام نسخه بماند؟"
            name={'days-' + file.id}
            orientation="vertical"
            value={plan.days}
            onChange={(v) => onChange({ ...plan, days: v as Side })}
            hint={daysDiff.summary.join('، ')}
            options={[
              { value: 'current', label: 'نسخهٔ فعلی' },
              { value: 'file', label: 'نسخهٔ فایل' }
            ]}
          />
        </B.Card>
      )}

      <div className="bsh-help-row">
        <span className="label-md">گروه‌های فایل</span>
        <HelpHint help="mergeGroups" visibleLabel />
      </div>

      {analysis.map((a) => {
        const gp = plan.groups[a.fileGroupId];
        if (!gp) return null;
        const linked = gp.target !== 'new';
        return (
          <B.Card key={a.fileGroupId} padding="md">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <B.Checkbox
                label={'بیاور — ' + a.name}
                checked={gp.include}
                onChange={(e) => setGroup(a.fileGroupId, { include: e.target.checked })}
              />
              <div
                className="caption"
                style={{
                  color: 'var(--text-subtle)',
                  display: 'flex',
                  gap: 'var(--space-2)',
                  flexWrap: 'wrap'
                }}
              >
                <span>{fa(a.peopleCount) + ' نفر · ' + fa(a.recordCount) + ' رکورد'}</span>
                {!a.hasRecords && (
                  <B.Badge intent="neutral" emphasis="subtle">
                    بدون رکورد
                  </B.Badge>
                )}
                {a.fileMine && (
                  <B.Badge intent="info" emphasis="subtle">
                    گروه من در فایل
                  </B.Badge>
                )}
              </div>
              {gp.include && (
                <>
                  <B.Select
                    size="sm"
                    label="وصل شود به"
                    options={targetOptions}
                    value={gp.target}
                    onChange={(e) => setGroup(a.fileGroupId, { target: e.target.value, policy: 'current' })}
                  />
                  {!linked && (
                    <B.Checkbox
                      label="گروه من"
                      checked={gp.mine}
                      onChange={(e) => setGroup(a.fileGroupId, { mine: e.target.checked })}
                    />
                  )}
                  {linked && a.conflictDays.length > 0 && (
                    <B.Alert intent="warning" title={daysText(a.conflictDays)}>
                      <B.RadioGroup
                        name={'pol-' + a.fileGroupId}
                        orientation="vertical"
                        value={gp.policy}
                        onChange={(v) => setGroup(a.fileGroupId, { policy: v as GroupPolicy })}
                        options={[
                          { value: 'current', label: 'نسخهٔ فعلی' },
                          { value: 'file', label: 'برای هر روز تعارضی، نسخهٔ فایل بیاید' },
                          { value: 'both', label: 'هر دو (نسخهٔ فایل با ـ۲ جدا اضافه می‌شود)' }
                        ]}
                      />
                    </B.Alert>
                  )}
                  {linked &&
                    a.personDiffs.map((d) => (
                      <div
                        key={d.key}
                        style={{
                          display: 'flex',
                          gap: 'var(--space-2)',
                          alignItems: 'flex-end',
                          flexWrap: 'wrap'
                        }}
                      >
                        <span className="body-sm" style={{ flex: 1, minInlineSize: 0 }}>
                          {d.name + ' — ' + FIELD_FA[d.field] + ': ' + d.current + ' ← ' + d.file}
                        </span>
                        <B.Select
                          size="sm"
                          label="کدام نسخه؟"
                          options={[
                            { value: 'current', label: 'نسخهٔ فعلی' },
                            { value: 'file', label: 'نسخهٔ فایل' }
                          ]}
                          value={plan.personChoices[d.key] || 'current'}
                          onChange={(e) => setChoice(d.key, e.target.value as Side)}
                        />
                      </div>
                    ))}
                  {a.overlaps.length > 0 && (
                    <B.Alert intent="info">
                      {fa(a.overlaps.length) +
                        ' نفر در گروه دیگری هم هستند (فقط گزارش): ' +
                        a.overlaps.slice(0, 4).join('، ')}
                    </B.Alert>
                  )}
                </>
              )}
            </div>
          </B.Card>
        );
      })}
    </div>
  );
}
