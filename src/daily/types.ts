/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DayConfig, DayRecord, Cohort, Group, Participant, Toast } from '../types';

export type CellField = 'done' | 'hard' | 'special';
export type CellChange = (participantId: string, field: CellField, value: number | null) => void;

export type HabitToggle = (participantId: string, habitIndex: number) => void;

/** props مشترک نمای کارتی و نمای جدولی */
export interface RowsViewProps {
  cohort: Cohort;
  group: Group;
  dayCfg: DayConfig;
  members: Participant[];
  onCellChange: CellChange;
  onHabitToggle: HabitToggle;
  toast?: Toast;
}

export interface ParticipantCardProps {
  rowIdx: number;
  participant: Participant;
  record: DayRecord | null;
  dayCfg: DayConfig;
  onCellChange: CellChange;
  onHabitToggle: HabitToggle;
  toast?: Toast;
}
