import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';

import { StateService } from '../../state.service';
import { CardDialog } from '../card-dialog/card-dialog';
import { Card, CardInput, Column, View, parseTags, priorityMeta } from '../../models';

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
  protected readonly columnIds = computed(() => this.columns().map((c) => c.id));

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

  protected async changeColor(column: Column, event: Event): Promise<void> {
    const value = (event.target as HTMLInputElement).value;
    if (value && value !== column.color) {
      await this.state.updateColumn({ id: column.id, boardId: column.boardId, name: column.name, color: value });
    }
  }

  protected async commitRename(column: Column): Promise<void> {
    if (this.editingColumn() !== column.id) return;
    const name = this.columnDraft.trim();
    this.editingColumn.set(null);
    if (name && name !== column.name) {
      await this.state.updateColumn({ id: column.id, boardId: column.boardId, name, color: column.color });
    }
  }

  protected async askDeleteColumn(column: Column): Promise<void> {
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

  protected onColumnDrop(event: CdkDragDrop<number[]>): void {
    const ids = [...event.container.data];
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    void this.state.reorderColumns(ids);
  }

  protected onDrop(event: CdkDragDrop<Card[]>, column: Column): void {
    const card = event.item.data as Card;

    // The drop lists show a filtered view (search, hidden completed tasks) but
    // the store keeps the true ordering. We stitch the visible reorder back into
    // the full column list so hidden cards keep their slots and never collide.
    const visible = event.container.data.map((c) => c.id);

    if (event.previousContainer === event.container) {
      const reordered = [...visible];
      moveItemInArray(reordered, event.previousIndex, event.currentIndex);

      const full = this.state.allCardsForColumn(column.id).map((c) => c.id);
      const visibleSet = new Set(visible);
      const merged: number[] = [];
      let vi = 0;
      for (const id of full) {
        merged.push(visibleSet.has(id) ? reordered[vi++] : id);
      }
      void this.state.reorderCards(column.id, merged);
      return;
    }

    const full = this.state.allCardsForColumn(column.id).map((c) => c.id);
    // Drop before whichever card currently occupies the target index; a drop at
    // the end appends after every visible card.
    const anchor = event.currentIndex < visible.length ? visible[event.currentIndex] : null;
    const insertAt = anchor === null ? full.length : full.indexOf(anchor);
    const merged = [...full];
    merged.splice(insertAt < 0 ? full.length : insertAt, 0, card.id);
    void this.state.moveCard(card.id, column.id, merged);
  }

  protected async toggle(card: Card, event: Event): Promise<void> {
    event.stopPropagation();
    await this.state.toggleComplete(card.id);
  }

  protected setView(view: View): void {
    void this.state.setView(view);
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
