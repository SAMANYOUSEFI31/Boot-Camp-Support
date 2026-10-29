/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import './globals';
import '../ds/bundle.js';
import type { ComponentType, CSSProperties, Key } from 'react';
import type * as D from '../ds/components';
import type { Toast } from './types';

// props مستند دیزاین سیستم + چیزهایی که همهٔ کامپوننت‌ها از پایه می‌پذیرند
type Extra = { className?: string; style?: CSSProperties; key?: Key; dir?: string };
type C<P> = ComponentType<P & Extra>;

export interface BushidoLib {
  Button: C<D.ButtonProps>;
  IconButton: C<D.IconButtonProps>;
  Icon: C<D.IconProps>;
  Badge: C<D.BadgeProps>;
  Card: C<D.CardProps>;
  Stat: C<D.StatProps>;
  TextField: C<D.TextFieldProps>;
  Textarea: C<Omit<D.TextareaProps, 'label'> & { label?: D.TextareaProps['label']; placeholder?: string }>;
  Select: C<Omit<D.SelectProps, 'label'> & { label?: D.SelectProps['label'] }>;
  Checkbox: C<D.CheckboxProps>;
  RadioGroup: C<D.RadioGroupProps>;
  Switch: C<D.SwitchProps>;
  Tabs: C<D.TabsProps>;
  Tag: C<D.TagProps>;
  SegmentedControl: C<D.SegmentedControlProps>;
  Alert: C<D.AlertProps>;
  Dialog: C<D.DialogProps>;
  EmptyState: C<D.EmptyStateProps>;
  Menu: C<D.MenuProps>;
  Table: C<D.TableProps>;
  DatePicker: C<D.DatePickerProps>;
  ToastProvider: C<D.ToastProviderProps>;
  useToast: () => Toast;
  toFa: (n: number | string) => string;
}

declare global {
  interface Window {
    Bushido: BushidoLib;
    ExcelJS?: any;
  }
}

// کامپوننت‌های دیزاین سیستم بوشیدو (window.Bushido)
export const B = window.Bushido;
