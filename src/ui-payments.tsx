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
  const kind = 'donation' as const;
  const [amount, setAmount] = useState('');
  const [dayN, setDayN] = useState(props.dayN);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const total = donationTotal(p);
  const life = membership(p);
  const canDonate = total < DONATION_CAP;
  const history = [
    ...(p.donations || []).map((payment) => ({ ...payment, label: 'دونیت' })),
  ].sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  function save() {
    const latin = Names.toLatinDigits(amount).replace(/[٬,]/g, '').trim();
    if (!/^\d+$/.test(latin)) {
      setError(Names.toPersianDigits('مبلغ را به تومان و با عدد صحیح بنویس.'));
      return;
    }
    if (!confirmed) { setError('ابتدا دریافت وجه را تأیید کن.'); return; }
    try {
      Store.recordPayment(cohort.id, p.id, 'donation', Number(latin), dayN);
      toast?.show({ intent: 'success', message: 'دونیت ثبت شد.' });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <B.Dialog open title={'ثبت دونیت ' + p.name} onClose={onClose} size="md"
      footer={<div className="bsh-row">
        <B.Button variant="primary" onClick={save} disabled={!confirmed || !canDonate}>
          تأیید و ثبت پرداخت
        </B.Button>
        <B.Button variant="ghost" onClick={onClose}>بستن</B.Button>
      </div>}>
      <div className="bsh-stack">
<p className="body-md">
          {'دونیت کل: ' + Names.toPersianDigits(total) + ' تومان · ' + Names.toPersianDigits(donationScore(p)) + ' امتیاز'}
        </p>
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
