import { useEffect, useState } from 'react';
import { B } from './bushido';
import { Names } from './names';
import { Store } from './store';
import { errorMessage } from './errors';
import { DONATION_CAP, DONATION_STEP, donationScore, donationTotal } from './membership';
import type { Cohort, Participant, Toast } from './types';

export function PaymentDialog(props: {
  cohort: Cohort; participant: Participant; dayN: number; onClose: () => void; toast?: Toast;
}) {
  const { cohort, onClose, toast } = props;
  const participant = cohort.participants.find((item) => item.id === props.participant.id) || props.participant;
  const [amount, setAmount] = useState('');
  const [dayN, setDayN] = useState(props.dayN);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setAmount('');
    setDayN(props.dayN);
    setConfirmed(false);
    setError('');
  }, [participant.id, props.dayN]);

  const total = donationTotal(participant);
  const score = donationScore(participant);
  const remainingCap = Math.max(0, DONATION_CAP - total);
  const canDonate = remainingCap > 0;
  const history = [
    ...(participant.donations || []).map((payment) => ({ ...payment, label: 'دونیت' })),
  ].sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  function save() {
    setError('');
    if (!canDonate) {
      setError('سقف دونیت دوره (' + Names.toPersianDigits(DONATION_CAP) + ' تومان / ۵ امتیاز) تکمیل شده است.');
      return;
    }
    const latin = Names.toLatinDigits(amount).replace(/[٬,\s]/g, '').trim();
    if (!/^\d+$/.test(latin)) {
      setError('مبلغ را به تومان و با عدد صحیح بنویس.');
      return;
    }
    const parsedAmount = Number(latin);
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) {
      setError('مبلغ باید عدد صحیح و بیشتر از صفر باشد.');
      return;
    }
    if (total + parsedAmount > DONATION_CAP) {
      setError('مجموع دونیت نمی‌تواند بیشتر از ' + Names.toPersianDigits(DONATION_CAP) + ' تومان باشد (باقیمانده مجاز: ' + Names.toPersianDigits(remainingCap) + ' تومان).');
      return;
    }
    if (!confirmed) {
      setError('ابتدا دریافت وجه را تأیید کن.');
      return;
    }
    try {
      Store.recordPayment(cohort.id, participant.id, 'donation', parsedAmount, dayN);
      toast?.show({ intent: 'success', message: 'دونیت ثبت شد.' });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <B.Dialog open title={'ثبت دونیت ' + participant.name} onClose={onClose} size="md"
      footer={<div className="bsh-row">
        <B.Button variant="primary" onClick={save} disabled={!confirmed || !canDonate}>
          تأیید و ثبت پرداخت
        </B.Button>
        <B.Button variant="ghost" onClick={onClose}>بستن</B.Button>
      </div>}>
      <div className="bsh-stack">
        <p className="body-md">
          {'دونیت کل: ' + Names.toPersianDigits(total) + ' تومان · ' + Names.toPersianDigits(score) + ' از ۵ امتیاز'}
        </p>
        <p className="caption" style={{ color: 'var(--text-subtle)' }}>
          {'هر ' + Names.toPersianDigits(DONATION_STEP) + ' تومان ۱ امتیاز؛ سقف دوره ' + Names.toPersianDigits(DONATION_CAP) + ' تومان (۵ امتیاز). باقیمانده مجاز: ' + Names.toPersianDigits(remainingCap) + ' تومان.'}
        </p>
        {!canDonate && (
          <B.Alert intent="info">
            این فرد به سقف کامل دونیت و ۵ امتیاز رسیده است.
          </B.Alert>
        )}
        <B.TextField
          label="مبلغ دونیت (تومان)"
          value={amount}
          disabled={!canDonate}
          placeholder={Names.toPersianDigits(Math.min(DONATION_STEP, remainingCap || DONATION_STEP))}
          inputMode="numeric"
          onChange={(e) => {
            setAmount(e.target.value);
            if (error) setError('');
          }}
        />
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
