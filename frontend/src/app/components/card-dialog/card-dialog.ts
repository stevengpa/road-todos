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
  Recurrence,
  RecurUnit,
  priorityMeta,
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

  protected readonly confirming = signal(false);
  protected readonly editing = computed(() => this.card() != null);

  protected isCustomRepeat(): boolean {
    return this.recurrence === 'custom';
  }

  protected title = '';
  protected description = '';
  protected priority: Priority = 'medium';
  protected dueDate = '';
  protected remindAt = '';
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
      this.dueDate = card.dueDate;
      this.remindAt = card.remindAt;
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
  }

  protected clearReminder(): void {
    this.remindAt = '';
  }

  protected submit(): void {
    const tags = this.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .join(', ');

    const custom = this.recurrence === 'custom';
    this.save.emit({
      id: this.card()?.id ?? 0,
      boardId: this.boardId(),
      columnId: Number(this.columnId),
      title: this.title.trim() || 'Untitled task',
      description: this.description.trim(),
      priority: this.priority,
      dueDate: this.dueDate,
      remindAt: this.remindAt,
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
