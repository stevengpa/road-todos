import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';

import { StateService } from '../../state.service';
import { CardDialog } from '../card-dialog/card-dialog';
import { Card, CardInput, Column, parseTags, priorityMeta } from '../../models';

@Component({
  selector: 'app-board',
  imports: [DragDropModule, FormsModule, CardDialog],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board {
  protected readonly state = inject(StateService);

  readonly edit = output<void>();

  protected readonly columns = this.state.boardColumns;
  protected readonly stats = this.state.stats;
  protected readonly isFiltering = computed(() => this.state.search().trim().length > 0);

  protected readonly dialogOpen = signal(false);
  protected readonly editingCard = signal<Card | null>(null);
  protected readonly dialogColumnId = signal<number | null>(null);

  protected readonly editingColumn = signal<number | null>(null);
  protected readonly confirmColumn = signal<number | null>(null);
  protected columnDraft = '';

  protected readonly addingColumn = signal(false);
  protected newColumnName = '';

  // -- card dialog ----------------------------------------------------------

  protected openNewCard(column: Column): void {
    this.editingCard.set(null);
    this.dialogColumnId.set(column.id);
    this.dialogOpen.set(true);
  }

  protected openNewTask(): void {
    const first = this.columns()[0];
    if (first) this.openNewCard(first);
  }

  protected openCard(card: Card): void {
    this.editingCard.set(card);
    this.dialogColumnId.set(card.columnId);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.editingCard.set(null);
  }

  protected async onSaveCard(input: CardInput): Promise<void> {
    if (input.id) {
      await this.state.updateCard(input);
    } else {
      await this.state.createCard(input);
    }
    this.closeDialog();
  }

  protected async onDeleteCard(id: number): Promise<void> {
    await this.state.deleteCard(id);
    this.closeDialog();
  }

  // -- column editing -------------------------------------------------------

  protected startRename(column: Column): void {
    this.columnDraft = column.name;
    this.editingColumn.set(column.id);
  }

  protected cancelRename(): void {
    this.editingColumn.set(null);
  }

  protected async commitRename(column: Column): Promise<void> {
    if (this.editingColumn() !== column.id) return;
    const name = this.columnDraft.trim();
    this.editingColumn.set(null);
    if (name && name !== column.name) {
      await this.state.updateColumn({ id: column.id, boardId: column.boardId, name, color: column.color });
    }
  }

  protected askDeleteColumn(column: Column): void {
    this.confirmColumn.set(column.id);
  }

  protected cancelDeleteColumn(): void {
    this.confirmColumn.set(null);
  }

  protected async deleteColumn(column: Column): Promise<void> {
    this.confirmColumn.set(null);
    await this.state.deleteColumn(column.id);
  }

  protected startNewColumn(): void {
    this.newColumnName = '';
    this.addingColumn.set(true);
  }

  protected cancelNewColumn(): void {
    this.addingColumn.set(false);
  }

  protected async commitNewColumn(): Promise<void> {
    const board = this.state.currentBoard();
    if (!board || !this.addingColumn()) return;
    const name = this.newColumnName.trim();
    this.addingColumn.set(false);
    if (name) {
      await this.state.createColumn({ id: 0, boardId: board.id, name, color: '#64748b' });
    }
  }

  // -- drag & drop ----------------------------------------------------------

  protected onDrop(event: CdkDragDrop<Card[]>, column: Column): void {
    const card = event.item.data as Card;

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.state.reorderCards(
        column.id,
        event.container.data.map((c) => c.id),
      );
      return;
    }

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
    this.state.moveCard(
      card.id,
      column.id,
      event.container.data.map((c) => c.id),
    );
  }

  protected async toggle(card: Card, event: Event): Promise<void> {
    event.stopPropagation();
    await this.state.toggleComplete(card.id);
  }

  // -- presentation helpers -------------------------------------------------

  protected priority = priorityMeta;
  protected tags = parseTags;

  protected dueLabel(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  protected remindLabel(value: string): string {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  protected isOverdue(card: Card): boolean {
    if (card.completed || !card.dueDate) return false;
    const due = new Date(`${card.dueDate}T00:00:00`).getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today.getTime();
  }
}
