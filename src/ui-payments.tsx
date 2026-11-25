import { useState } from 'react';
import { B } from './bushido';
import { Names } from './names';
import { Store } from './store';
import { errorMessage } from './errors';
import { DONATION_CAP, LIFE_PRICE, donationScore, donationTotal, membership } from './membership';
import type { Cohort, Participant, Toast } from './types';

export function PaymentDialog(props: {
  cohort: Cohort; participant: Participant; dayN: number; onClose: () => void; toast?: Toast;
}) {
  const { cohort, participant: p, onClose, toast } = props;
  const [kind, setKind] = useState<'donation' | 'life'>(p.expelledForWarnings ? 'life' : 'donation');
  const [amount, setAmount] = useState('');
  const [dayN, setDayN] = useState(props.dayN);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const total = donationTotal(p);
  const life = membership(p);
  const canBuyLife = !!p.expelledForWarnings && life.remaining === 0;
  const canDonate = total < DONATION_CAP;
  const history = [
    ...(p.donations || []).map((payment) => ({ ...payment, label: 'دونیت' })),
    ...(p.lifePayments || []).map((payment) => ({ ...payment, label: 'خرید یک جان' }))
  ].sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  function save() {
    const latin = Names.toLatinDigits(amount).replace(/[٬,]/g, '').trim();
    if (kind === 'donation' && !/^\d+$/.test(latin)) {
      setError('مبلغ را به تومان و با عدد صحیح بنویس.');
      return;
    }
    if (!confirmed) { setError('ابتدا دریافت وجه را تأیید کن.'); return; }
    try {
      Store.recordPayment(cohort.id, p.id, kind, kind === 'life' ? LIFE_PRICE : Number(latin), dayN);
      toast?.show({ intent: 'success', message: kind === 'life' ? 'یک جان ثبت شد؛ فرد به گروه برگشت.' : 'دونیت ثبت شد.' });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <B.Dialog open title={'پرداخت‌ها و جان‌های ' + p.name} onClose={onClose} size="md"
      footer={<div className="bsh-row">
        <B.Button variant="primary" onClick={save} disabled={!confirmed || (kind === 'life' ? !canBuyLife : !canDonate)}>
          تأیید و ثبت پرداخت
        </B.Button>
        <B.Button variant="ghost" onClick={onClose}>بستن</B.Button>
      </div>}>
      <div className="bsh-stack">
        <B.Alert intent={p.expelledForWarnings ? 'warning' : 'info'}
          title={Names.toPersianDigits(life.warnings) + ' اخطار · ' + Names.toPersianDigits(life.remaining) + ' جان باقی‌مانده'}>
          هر روز ناقص فقط یک اخطار دارد. سه جان اولیه؛ هر خرید، فقط یک جان اضافه می‌کند.
          {p.warningDays?.length ? ' روزهای اخطار: ' + p.warningDays.map(Names.toPersianDigits).join('، ') : ''}
        </B.Alert>
        <p className="body-md">
          {'دونیت کل: ' + Names.toPersianDigits(total) + ' تومان · ' + Names.toPersianDigits(donationScore(p)) + ' از ۵ امتیاز'}
        </p>
        <B.SegmentedControl label="نوع پرداخت" value={kind}
          items={[{ id: 'donation', label: 'دونیت' }, { id: 'life', label: 'خرید یک جان' }]}
          onChange={(id) => { setKind(id === 'life' ? 'life' : 'donation'); setConfirmed(false); setError(''); }} />
        {kind === 'donation' ? (
          <>
            <B.TextField label="مبلغ دونیت (تومان)" inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value)} disabled={!canDonate} />
            <p className="body-sm">{'باقی‌مانده تا سقف: ' + Names.toPersianDigits(DONATION_CAP - total) + ' تومان. هر ۲۰۰٬۰۰۰ تومان یک امتیاز؛ مبالغ کوچک‌تر با هم جمع می‌شوند.'}</p>
          </>
        ) : (
          <B.Alert intent={canBuyLife ? 'info' : 'warning'}>
            {canBuyLife ? '۲۰۰٬۰۰۰ تومان برای یک جان. این پرداخت دونیت نیست و امتیاز ندارد.' :
              'خرید جان فقط وقتی امکان دارد که فرد به دلیل تمام شدن جان‌ها خارج شده باشد.'}
          </B.Alert>
        )}
        <B.Select label="روز دریافت وجه" value={String(dayN)}
          options={cohort.days.map((d) => ({ value: String(d.n), label: 'روز ' + Names.toPersianDigits(d.n) }))}
          onChange={(e) => setDayN(Number(e.target.value))} />
        <B.Checkbox label="دریافت وجه را تأیید می‌کنم" checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)} />
        {error && <B.Alert intent="danger">{error}</B.Alert>}
        <h3 className="heading-sm">سابقهٔ پرداخت‌ها</h3>
        {history.length ? history.map((payment) => (
          <p className="body-sm" key={payment.id}>
            {payment.label + ' · ' + Names.toPersianDigits(payment.amount) + ' تومان · روز ' +
              Names.toPersianDigits(payment.dayN) + ' · ' + Names.formatShamsiShort(payment.paidAt.slice(0, 10))}
          </p>
        )) : <p className="body-sm">پرداختی ثبت نشده است.</p>}
      </div>
    </B.Dialog>
  );
}
