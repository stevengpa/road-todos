import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  BOARD_COLORS,
  Card,
  CardInput,
  Column,
  PRIORITIES,
  Priority,
  RECURRENCE_OPTIONS,
  RECUR_UNITS,
  REMIND_BEFORE_UNITS,
  Recurrence,
  RecurUnit,
  RemindBeforeUnit,
  priorityMeta,
  splitOffset,
  toMinutes,
} from '../../models';

@Component({
  selector: 'app-card-dialog',
  imports: [FormsModule],
  templateUrl: './card-dialog.html',
  styleUrl: './card-dialog.scss',
})
export class CardDialog implements OnInit {
  readonly card = input<Card | null>(null);
  readonly boardId = input.required<number>();
  readonly columns = input<Column[]>([]);
  readonly defaultColumnId = input<number | null>(null);

  readonly save = output<CardInput>();
  readonly remove = output<number>();
  readonly closed = output<void>();

  protected readonly priorities = PRIORITIES;
  protected readonly palette = BOARD_COLORS;
  protected readonly meta = priorityMeta;
  protected readonly recurrenceOptions = RECURRENCE_OPTIONS;
  protected readonly recurUnits = RECUR_UNITS;
  protected readonly remindBeforeUnits = REMIND_BEFORE_UNITS;

  protected readonly confirming = signal(false);
  protected readonly editing = computed(() => this.card() != null);

  protected isCustomRepeat(): boolean {
    return this.recurrence === 'custom';
  }

  protected title = '';
  protected description = '';
  protected priority: Priority = 'medium';
  protected dueDate = '';
  protected dueTime = '';
  protected remindMode: 'none' | 'at' | 'before' = 'none';
  protected remindAt = '';
  protected remindBeforeAmount = 1;
  protected remindBeforeUnit: RemindBeforeUnit = 'day';
  protected tags = '';
  protected columnId = 0;
  protected recurrence: Recurrence = '';
  protected recurInterval = 1;
  protected recurUnit: RecurUnit = 'day';

  ngOnInit(): void {
    const card = this.card();
    if (card) {
      this.title = card.title;
      this.description = card.description;
      this.priority = (card.priority as Priority) ?? 'medium';
      const [dueDate, dueTime] = (card.dueDate ?? '').split('T');
      this.dueDate = dueDate ?? '';
      this.dueTime = dueTime ?? '';
      this.remindAt = card.remindAt;
      if (card.remindBefore > 0) {
        const { amount, unit } = splitOffset(card.remindBefore);
        this.remindMode = 'before';
        this.remindBeforeAmount = amount;
        this.remindBeforeUnit = unit;
      } else if (card.remindAt) {
        this.remindMode = 'at';
      }
      this.tags = card.tags;
      this.columnId = card.columnId;
      this.recurrence = (card.recurrence as Recurrence) ?? '';
      this.recurInterval = card.recurInterval > 0 ? card.recurInterval : 1;
      this.recurUnit = (card.recurUnit as RecurUnit) ?? 'day';
    } else {
      this.columnId = this.defaultColumnId() ?? this.columns()[0]?.id ?? 0;
    }
  }

  protected setPriority(p: Priority): void {
    this.priority = p;
  }

  protected clearDueDate(): void {
    this.dueDate = '';
    this.dueTime = '';
  }

  protected clearReminder(): void {
    this.remindMode = 'none';
    this.remindAt = '';
  }

  protected submit(): void {
    const tags = this.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .join(', ');

    const custom = this.recurrence === 'custom';
    const remindBefore =
      this.remindMode === 'before' ? toMinutes(this.remindBeforeAmount, this.remindBeforeUnit) : 0;
    const dueDate = this.dueDate ? (this.dueTime ? `${this.dueDate}T${this.dueTime}` : this.dueDate) : '';
    this.save.emit({
      id: this.card()?.id ?? 0,
      boardId: this.boardId(),
      columnId: Number(this.columnId),
      title: this.title.trim() || 'Untitled task',
      description: this.description.trim(),
      priority: this.priority,
      dueDate,
      remindAt: this.remindMode === 'at' ? this.remindAt : '',
      remindBefore,
      tags,
      recurrence: this.recurrence,
      recurInterval: custom ? Math.max(1, Number(this.recurInterval) || 1) : 1,
      recurUnit: custom ? this.recurUnit : 'day',
    });
  }

  protected askDelete(): void {
    this.confirming.set(true);
  }

  protected cancelDelete(): void {
    this.confirming.set(false);
  }

  protected confirmDelete(): void {
    const card = this.card();
    if (card) this.remove.emit(card.id);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected stop(event: Event): void {
    event.stopPropagation();
  }
}
