import { useId, useState } from 'react';
import { B } from './bushido';
import { Names } from './names';
import { Store } from './store';
import { errorMessage } from './errors';
import { GENDER_LABELS, canAssign, matchesRegistrationSearch, registrationComplete, validateRegistration } from './registration';
import type { RegistrationErrors, RegistrationInput } from './registration';
import type { Cohort, Participant, Toast } from './types';
import type { TableProps } from '../ds/components';

const PAGE_SIZE = 12;
const ageLabel = (p: Participant) => p.age !== undefined ? Names.toPersianDigits(p.age) + ' سال' : 'سن ثبت نشده';
const genderLabel = (p: Participant) => p.gender ? GENDER_LABELS[p.gender] : 'جنسیت ثبت نشده';

function ProfileDetails({ participant: p }: { participant: Participant }) {
  return <dl className="bsh-profile-details">
    <div><dt>موبایل</dt><dd>{p.phone ? <bdi className="code" dir="ltr">{p.phone}</bdi> : 'ثبت نشده'}</dd></div>
    <div><dt>سن</dt><dd>{ageLabel(p)}</dd></div>
    <div><dt>جنسیت</dt><dd>{genderLabel(p)}</dd></div>
    <div><dt>تلگرام</dt><dd>{p.telegram ? <bdi dir="ltr">@{p.telegram}</bdi> : 'ثبت نشده'}</dd></div>
  </dl>;
}

export function RegistrationsTab(props: { cohort: Cohort; toast?: Toast; onGoToGroups: () => void; onOpenImport: () => void }) {
  const { cohort, toast } = props;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [gender, setGender] = useState('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Participant | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Participant | null>(null);
  const [assignment, setAssignment] = useState<string[] | null>(null);
  const members = cohort.participants;
  const unassigned = members.filter((p) => !p.groupId);
  const incomplete = members.filter((p) => !registrationComplete(p));
  const filtered = members.filter((p) =>
    matchesRegistrationSearch(p, search) &&
    (gender === 'all' || p.gender === gender) &&
    (filter === 'all' || (filter === 'unassigned' ? !p.groupId :
      filter === 'assigned' ? !!p.groupId : !registrationComplete(p))));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const groupName = (p: Participant) => cohort.groups.find((g) => g.id === p.groupId)?.name || 'بدون گروه';

  const actions = (p: Participant) => <div className="bsh-row bsh-person-actions">
    <B.Button variant="secondary" size="sm" iconStart="Pencil" onClick={() => setEditing(p)}>
      {registrationComplete(p) ? 'ویرایش ثبت‌نام' : 'تکمیل ثبت‌نام'}
    </B.Button>
    {canAssign(p) && <B.Button variant="secondary" size="sm" onClick={() => setAssignment([p.id])}>انتخاب گروه</B.Button>}
    <B.IconButton icon="Trash2" size="sm" label={'حذف ثبت‌نام ' + p.name} variant="danger" onClick={() => setDeleting(p)} />
  </div>;
  const columns: TableProps['columns'] = [
    { key: 'name', label: 'نام و نام خانوادگی' },
    { key: 'phone', label: 'موبایل', render: (row) => row.phone ? <bdi dir="ltr" className="code">{row.phone}</bdi> : 'ثبت نشده' },
    { key: 'age', label: 'سن', render: (row) => ageLabel(row) },
    { key: 'gender', label: 'جنسیت', render: (row) => genderLabel(row) },
    { key: 'telegram', label: 'تلگرام', render: (row) => row.telegram ? <bdi dir="ltr">@{row.telegram}</bdi> : 'ثبت نشده' },
    { key: 'group', label: 'گروه', render: (row) => groupName(row) },
    { key: 'actions', label: 'اقدام', render: (row) => {
      const p = visible.find((p) => p.id === row.id);
      return p ? actions(p) : null;
    } }
  ];

  return <section className="bsh-stack bsh-stack--lg" aria-labelledby="registration-title">
    <div className="bsh-workflow-heading">
      <div><h2 id="registration-title" className="heading-md">ثبت‌نام افراد</h2>
        <p className="body-md bsh-muted">ابتدا ثبت‌نام، سپس انتخاب افراد و گروه‌بندی.</p></div>
      <B.Button variant="primary" iconStart="Plus" onClick={() => setEditing(null)}>ثبت‌نام جدید</B.Button>
    </div>
    <div className="bsh-workflow-stats">
      <B.Stat label="کل افراد دوره" value={Names.toPersianDigits(members.length)} />
      <B.Stat label="بدون گروه" value={Names.toPersianDigits(unassigned.length)} />
      <B.Stat label="گروه‌بندی‌شده" value={Names.toPersianDigits(members.length - unassigned.length)} />
      <B.Stat label="نیازمند تکمیل مشخصات" value={Names.toPersianDigits(incomplete.length)} />
    </div>
    <B.Alert intent="info" title="مشخصات ثبت‌نام خصوصی است">
      موبایل، سن و جنسیت فقط در مدیریت داخلی و بکاپ ذخیره می‌شوند؛ در گزارش عمومی روزانه و تصویر گروه نمایش داده نمی‌شوند.
      فایل بکاپ را فقط با افراد مجاز به اشتراک بگذار.
    </B.Alert>
    <B.Card padding="md">
      <div className="bsh-stack">
        <div className="bsh-registration-toolbar">
          <B.TextField label="جست‌وجوی نام یا موبایل" iconStart="Search" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <B.Select label="وضعیت گروه‌بندی" value={filter} options={[
            { value: 'all', label: 'همهٔ افراد' }, { value: 'unassigned', label: 'بدون گروه' },
            { value: 'assigned', label: 'گروه‌بندی‌شده' }, { value: 'incomplete', label: 'ثبت‌نام ناقص' }
          ]} onChange={(e) => { setFilter(e.target.value); setPage(1); }} />
          <B.Select label="جنسیت" value={gender} options={[
            { value: 'all', label: 'همه' }, { value: 'male', label: 'مرد' }, { value: 'female', label: 'زن' }
          ]} onChange={(e) => { setGender(e.target.value); setPage(1); }} />
        </div>
        <div className="bsh-row">
          <span className="body-sm">{Names.toPersianDigits(filtered.length) + ' نفر در فهرست'}</span>
          <B.Button variant="secondary" onClick={() => setAssignment([])} disabled={!members.some(canAssign)}>
            گروه‌بندی ثبت‌نامی‌ها
          </B.Button>
          <B.Button variant="secondary" onClick={props.onGoToGroups}>مدیریت گروه‌ها</B.Button>
          <B.Button variant="secondary" iconStart="Inbox" onClick={props.onOpenImport}>ورود فایل / دانلود قالب</B.Button>
        </div>
      </div>
    </B.Card>
    {!visible.length ? <B.Card padding="lg"><B.EmptyState icon="User"
      title={members.length ? 'فردی با این فیلترها پیدا نشد' : 'هنوز ثبت‌نامی نداریم'}
      description={members.length ? 'جست‌وجو یا فیلترها را تغییر بده.' : 'نام، موبایل، سن و جنسیت اولین فرد را ثبت کن.'}
      action={<B.Button variant="secondary" onClick={() => {
        if (members.length) { setSearch(''); setFilter('all'); setGender('all'); }
        else setEditing(null);
      }}>{members.length ? 'پاک کردن فیلترها' : 'ثبت اولین فرد'}</B.Button>} /></B.Card> :
      <>
        <div className="bsh-desktop-table bsh-table-align-fix"><B.Table caption="فهرست ثبت‌نامی‌های دوره" columns={columns} rows={visible.map((p) => ({ ...p }))} /></div>
        <div className="bsh-responsive-cards">
          {visible.map((p) => <B.Card key={p.id} padding="md">
            <div className="bsh-stack">
              <div className="bsh-row"><h3 className="heading-sm bsh-wrap-text">{p.name}</h3>
                <B.Badge intent={registrationComplete(p) ? 'neutral' : 'warning'}>
                  {registrationComplete(p) ? groupName(p) : 'مشخصات ناقص'}
                </B.Badge></div>
              <ProfileDetails participant={p} />
              {actions(p)}
            </div>
          </B.Card>)}
        </div>
      </>}
    {pageCount > 1 && <B.Pagination label="صفحه‌های ثبت‌نامی‌ها" page={currentPage} pageCount={pageCount} onChange={setPage} />}
    {editing !== undefined && <RegistrationDialog cohort={cohort} participant={editing} toast={toast} onClose={() => setEditing(undefined)} />}
    {assignment !== null && <AssignmentDialog cohort={cohort} initialIds={assignment} toast={toast} onClose={() => setAssignment(null)} />}
    {deleting && <B.Dialog open alert size="sm" title={'حذف ثبت‌نام ' + deleting.name}
      description="مشخصات، گروه‌بندی و همهٔ ثبت‌ها و پرداخت‌های این فرد حذف می‌شود و برگشت ندارد. در صورت نیاز ابتدا بکاپ بگیر."
      onClose={() => setDeleting(null)} footer={<div className="bsh-row">
        <B.Button variant="danger-bold" onClick={() => {
          Store.deleteParticipant(cohort.id, deleting.id);
          toast?.show({ intent: 'success', message: 'ثبت‌نام حذف شد.' });
          setDeleting(null);
        }}>حذف ثبت‌نام و داده‌ها</B.Button>
        <B.Button variant="ghost" onClick={() => setDeleting(null)}>انصراف</B.Button>
      </div>} />}
  </section>;
}

export function RegistrationDialog(props: { cohort: Cohort; participant: Participant | null; onClose: () => void; toast?: Toast }) {
  const { cohort, participant: p, onClose, toast } = props;
  const formId = useId();
  const [input, setInput] = useState<RegistrationInput>({
    name: p?.name || '', phone: p?.phone || '', age: p?.age !== undefined ? String(p.age) : '', gender: p?.gender || '',
    telegram: p?.telegram || ''
  });
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [error, setError] = useState('');
  const change = (field: keyof RegistrationInput, value: string) => {
    setInput((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setError('');
  };
  function save() {
    const result = validateRegistration(input, cohort.participants, p?.id);
    setErrors(result.errors);
    if (!result.valid) { setError('مشخصات علامت‌گذاری‌شده را اصلاح کن.'); return; }
    try {
      Store.saveRegistration(cohort.id, input, p?.id);
      toast?.show({ intent: 'success', message: p ? 'مشخصات ثبت‌نام ذخیره شد.' : 'ثبت‌نام انجام شد؛ فرد آمادهٔ گروه‌بندی است.' });
      onClose();
    } catch (err) { setError(errorMessage(err)); }
  }
  return <B.Dialog open size="md" title={p ? 'ویرایش مشخصات ثبت‌نام' : 'ثبت‌نام جدید'} onClose={onClose}
    description={p ? 'مشخصات فرد را اصلاح کن؛ گروه، امتیازها و پرداخت‌ها حفظ می‌شوند.' : 'هر چهار مشخصه الزامی است. گروه را در مرحلهٔ بعد انتخاب می‌کنی.'}
    footer={<div className="bsh-dialog-actions">
      <B.Button variant="primary" type="submit" form={formId}>{p ? 'ذخیره مشخصات' : 'ثبت فرد'}</B.Button>
      <B.Button variant="ghost" onClick={onClose}>انصراف</B.Button>
    </div>}>
    <form id={formId} className="bsh-stack" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
      {error && <B.Alert intent="danger">{error}</B.Alert>}
      <div className="bsh-registration-form">
        <B.TextField label="نام و نام خانوادگی" required autoFocus autoComplete="off" maxLength={100}
          value={input.name} error={errors.name} onChange={(e) => change('name', e.target.value)} />
        <B.TextField label="موبایل ایران" required type="tel" inputMode="tel" dir="ltr" autoComplete="off"
          placeholder="09123456789" hint="۰۹ یا ‎+۹۸؛ ارقام فارسی هم پذیرفته می‌شوند."
          value={input.phone} error={errors.phone} onChange={(e) => change('phone', e.target.value)} />
        <B.TextField label="سن (سال)" required inputMode="numeric" maxLength={3}
          value={input.age} error={errors.age} onChange={(e) => change('age', e.target.value)} />
        <B.TextField label="آیدی تلگرام (اختیاری)" dir="ltr" autoComplete="off" maxLength={33}
          hint="نام کاربری با یا بدون @؛ نه شماره یا شناسه عددی."
          value={input.telegram} error={errors.telegram} onChange={(e) => change('telegram', e.target.value)} />
        <B.RadioGroup legend="جنسیت" name={formId + '-gender'} required orientation="horizontal"
          value={input.gender} error={errors.gender} options={[{ value: 'male', label: 'مرد' }, { value: 'female', label: 'زن' }]}
          onChange={(value) => change('gender', value)} />
      </div>
    </form>
  </B.Dialog>;
}

export function AssignmentDialog(props: {
  cohort: Cohort; groupId?: string; initialIds?: string[]; onClose: () => void; toast?: Toast;
}) {
  const { cohort, onClose, toast } = props;
  const [target, setTarget] = useState(props.groupId || '');
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('all');
  const [selected, setSelected] = useState(new Set(props.initialIds || []));
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const eligible = cohort.participants.filter(canAssign);
  const filtered = eligible.filter((p) => matchesRegistrationSearch(p, search) && (gender === 'all' || p.gender === gender));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedCount = [...selected].filter((id) => eligible.some((p) => p.id === id)).length;
  const visibleSelected = visible.filter((p) => selected.has(p.id)).length;
  const allVisible = visible.length > 0 && visibleSelected === visible.length;
  const fixedGroup = cohort.groups.find((g) => g.id === props.groupId);
  function assign() {
    try {
      Store.assignRegistrants(cohort.id, [...selected], target);
      toast?.show({ intent: 'success', message: Names.toPersianDigits(selectedCount) + ' نفر به گروه اضافه شدند.' });
      onClose();
    } catch (err) { setError(errorMessage(err)); }
  }
  return <B.Dialog open size="lg" title={fixedGroup ? 'افزودن ثبت‌نامی به ' + fixedGroup.name : 'گروه‌بندی ثبت‌نامی‌ها'}
    description="فقط افراد فعال با ثبت‌نام کامل و بدون گروه قابل انتخاب‌اند. انتخاب‌ها با جست‌وجو، فیلتر و تغییر صفحه حفظ می‌شوند."
    onClose={onClose} footer={<div className="bsh-dialog-actions">
      <B.Button variant="primary" disabled={!selectedCount || !target} onClick={assign}>
        {'افزودن ' + Names.toPersianDigits(selectedCount) + ' نفر به گروه'}
      </B.Button>
      <B.Button variant="ghost" onClick={onClose}>انصراف</B.Button>
    </div>}>
    <div className="bsh-stack">
      {error && <B.Alert intent="danger">{error}</B.Alert>}
      {!cohort.groups.length && <B.Alert intent="warning">ابتدا در بخش «گروه‌بندی» یک گروه بساز.</B.Alert>}
      <div className="bsh-registration-form">
        <B.Select label="گروه مقصد" value={target} disabled={!!fixedGroup} placeholder="گروه را انتخاب کن"
          options={[{ value: '', label: 'گروه را انتخاب کن' }, ...cohort.groups.map((g) => ({ value: g.id, label: g.name }))]}
          onChange={(e) => { setTarget(e.target.value); setError(''); }} />
        <B.TextField label="جست‌وجوی ثبت‌نامی" iconStart="Search" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <B.Select label="جنسیت ثبت‌نامی‌ها" value={gender} options={[
          { value: 'all', label: 'همه' }, { value: 'male', label: 'مرد' }, { value: 'female', label: 'زن' }
        ]} onChange={(e) => { setGender(e.target.value); setPage(1); }} />
      </div>
      <div className="bsh-row">
        <B.Checkbox label="انتخاب همهٔ افراد این صفحه" checked={allVisible} disabled={!visible.length}
          indeterminate={visibleSelected > 0 && !allVisible} onChange={(e) => {
            const checked = e.target.checked;
            setSelected((previous) => {
              const next = new Set(previous);
              for (const p of visible) { if (checked) next.add(p.id); else next.delete(p.id); }
              return next;
            });
          }} />
        <span className="body-sm" aria-live="polite">{Names.toPersianDigits(selectedCount) + ' نفر انتخاب شده'}</span>
        {selected.size > 0 && <B.Button variant="ghost" onClick={() => setSelected(new Set())}>پاک کردن انتخاب‌ها</B.Button>}
      </div>
      {!visible.length ? <B.EmptyState icon="User" title="ثبت‌نامی آمادهٔ گروه‌بندی پیدا نشد"
        description="جست‌وجو را تغییر بده یا در بخش ثبت‌نام، مشخصات افراد بدون گروه را تکمیل کن." /> :
        <div className="bsh-assignment-grid">
          {visible.map((p) => <B.Card key={p.id} padding="md">
            <div className="bsh-stack">
              <B.Checkbox label={p.name} checked={selected.has(p.id)} onChange={(e) => {
                const checked = e.target.checked;
                setSelected((previous) => {
                  const next = new Set(previous);
                  if (checked) next.add(p.id); else next.delete(p.id);
                  return next;
                });
              }} />
              <ProfileDetails participant={p} />
            </div>
          </B.Card>)}
        </div>}
      {pageCount > 1 && <B.Pagination label="صفحه‌های انتخاب ثبت‌نامی" page={currentPage} pageCount={pageCount} onChange={setPage} />}
    </div>
  </B.Dialog>;
}




