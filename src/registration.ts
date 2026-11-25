import { Names } from './names';
import type { Gender, Participant } from './types';

export const GENDER_LABELS: Record<Gender, string> = { male: 'مرد', female: 'زن' };

export interface RegistrationInput {
  name: string;
  phone: string;
  age: string | number;
  gender: string;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationInput, string>>;

export function normalizeMobile(value: string): string {
  const digits = Names.toLatinDigits(value).replace(/[\s()-]/g, '');
  if (digits.startsWith('+98')) return '0' + digits.slice(3);
  if (digits.startsWith('0098')) return '0' + digits.slice(4);
  if (digits.startsWith('98')) return '0' + digits.slice(2);
  return digits;
}

export function validateRegistration(input: RegistrationInput, participants: Participant[], excludeId?: string) {
  const errors: RegistrationErrors = {};
  const name = input.name.replace(/\s+/g, ' ').trim();
  const phone = normalizeMobile(input.phone);
  const ageText = Names.toLatinDigits(input.age).trim();
  const age = Number(ageText);
  if (!name || name.length > 100) errors.name = 'نام را بنویس؛ حداکثر ۱۰۰ نویسه.';
  if (!/^09\d{9}$/.test(phone)) errors.phone = 'موبایل ایران را با ۱۱ رقم و شروع ۰۹ بنویس.';
  else if (participants.some((p) => p.id !== excludeId && p.phone && normalizeMobile(p.phone) === phone)) {
    errors.phone = 'این موبایل در همین دوره ثبت شده است؛ فرد موجود را ویرایش کن.';
  }
  if (!/^\d+$/.test(ageText) || !Number.isInteger(age) || age < 1 || age > 120) {
    errors.age = 'سن را به سال، با عدد صحیح بین ۱ و ۱۲۰ بنویس.';
  }
  if (input.gender !== 'male' && input.gender !== 'female') errors.gender = 'مرد یا زن را انتخاب کن.';
  return { valid: Object.keys(errors).length === 0, errors, name, phone, age };
}

export function registrationComplete(p: Participant): boolean {
  return !!p.name.trim() && !!p.phone && /^09\d{9}$/.test(p.phone) &&
    Number.isInteger(p.age) && (p.age ?? 0) >= 1 && (p.age ?? 0) <= 120 &&
    (p.gender === 'male' || p.gender === 'female');
}

export function canAssign(p: Participant): boolean {
  return p.groupId === '' && p.status === 'active' && registrationComplete(p);
}

export function matchesRegistrationSearch(p: Participant, search: string): boolean {
  const query = Names.normalizeName(search.trim());
  if (!query) return true;
  return Names.normalizeName(p.name).includes(query) ||
    !!p.phone?.includes(normalizeMobile(search.trim()));
}
