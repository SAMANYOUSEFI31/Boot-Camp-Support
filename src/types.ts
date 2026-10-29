/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// مدل داده‌های برنامه (همان ساختاری که در localStorage و فایل بکاپ ذخیره می‌شود)

export type ParticipantStatus = 'active' | 'frozen' | 'left';
export type DayType = 'warmup' | 'main' | 'review';

export interface Participant {
  id: string;
  name: string;
  nameKey: string;
  telegram: string;
  groupId: string;
  status: ParticipantStatus;
  habitCount: number | null;
}

export interface Group {
  id: string;
  name: string;
  order: number;
  mine: boolean;
  closedDays: number[];
}

export interface DayConfig {
  n: number;
  type: DayType;
  hardLevels: number;
  specialMission: boolean;
}

/** رکورد یک روز یک فرد؛ مقدار null یعنی ثبت نشده */
export interface DayRecord {
  done: number | null;
  hard: number | null;
  special: number | null;
}

/** { [شناسهٔ فرد]: { [شمارهٔ روز]: رکورد } } */
export type Records = Record<string, Record<number, DayRecord>>;

export interface Cohort {
  id: string;
  name: string;
  startDate: string;
  archived: boolean;
  days: DayConfig[];
  groups: Group[];
  participants: Participant[];
  records: Records;
}

export interface AppState {
  schemaVersion: number;
  activeCohortId: string | null;
  lastBackupAt: string | null;
  lastChangeAt: string;
  exportedAt?: string;
  cohorts: Cohort[];
}

export type MergeDecision = 'skip' | 'replace' | 'copy';

export interface MergeOptions {
  selected?: Record<number, boolean>;
  decisions?: Record<number, MergeDecision>;
  groupMine?: Record<number, Record<string, boolean>>;
  newId?: () => string;
}

export interface MergeReport {
  added: string[];
  replaced: string[];
  copied: string[];
  skipped: string[];
}

export type ValidateResult = { ok: true; data: AppState } | { ok: false; error: string };

/** رابط toast که از useToast می‌آید */
export interface Toast {
  show(opts: {
    intent?: 'info' | 'success' | 'warning' | 'danger';
    message: string;
    action?: { label: string; onClick?: () => void };
    duration?: number;
  }): string;
  dismiss(id: string): void;
}
