import { models } from '../../wailsjs/go/models';

export type Board = models.Board;
export type Column = models.Column;
export type Card = models.Card;
export type BoardInput = models.BoardInput;
export type ColumnInput = models.ColumnInput;
export type CardInput = models.CardInput;
export type Snapshot = models.Snapshot;
export type Reminder = models.Reminder;
export type Settings = models.Settings;
export type BoardView = models.BoardView;

export type Theme = 'dark' | 'light';
export type View = 'kanban' | 'table';

export type Priority = 'low' | 'medium' | 'high';

export interface PriorityMeta {
  label: string;
  color: string;
  icon: string;
}

export const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  high: { label: 'High', color: '#ef4444', icon: 'M12 2 3 20h18L12 2Zm0 6 4.5 9h-9L12 8Z' },
  medium: { label: 'Medium', color: '#f59e0b', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5h-2v6h2V7Zm0 8h-2v2h2v-2Z' },
  low: { label: 'Low', color: '#38bdf8', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z' },
};

export const BOARD_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
];

export const COLUMN_COLORS = [
  '#64748b',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#ef4444',
];

export function priorityMeta(p: string): PriorityMeta {
  return PRIORITY_META[(p as Priority) ?? 'medium'] ?? PRIORITY_META.medium;
}

export type Recurrence = '' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type RecurUnit = 'day' | 'week' | 'month' | 'year';

export interface RecurrenceOption {
  value: Recurrence;
  label: string;
}

export const RECURRENCE_OPTIONS: RecurrenceOption[] = [
  { value: '', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom…' },
];

export const RECUR_UNITS: { value: RecurUnit; label: string }[] = [
  { value: 'day', label: 'day(s)' },
  { value: 'week', label: 'week(s)' },
  { value: 'month', label: 'month(s)' },
  { value: 'year', label: 'year(s)' },
];

/** Short human label for a card's recurrence, or '' when it does not repeat. */
export function recurrenceLabel(recurrence: string, interval: number, unit: string): string {
  switch (recurrence) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
    case 'custom': {
      const n = interval > 0 ? interval : 1;
      const u =
        unit === 'week' ? 'week' : unit === 'month' ? 'month' : unit === 'year' ? 'year' : 'day';
      return `Every ${n} ${u}${n === 1 ? '' : 's'}`;
    }
    default:
      return '';
  }
}

export function parseTags(tags: string): string[] {
  return (tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}
