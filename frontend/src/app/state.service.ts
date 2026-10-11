import { Injectable, computed, signal } from '@angular/core';

import * as App from '../../wailsjs/go/main/App';
import {
  Board,
  BoardInput,
  Card,
  CardInput,
  Column,
  ColumnInput,
  Snapshot,
} from './models';

export interface BoardStat {
  total: number;
  done: number;
  progress: number;
}

@Injectable({ providedIn: 'root' })
export class StateService {
  readonly boards = signal<Board[]>([]);
  readonly columns = signal<Column[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly currentBoardId = signal<number | null>(null);
  readonly search = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly dbPath = signal('');

  readonly currentBoard = computed<Board | null>(() => {
    const id = this.currentBoardId();
    return this.boards().find((b) => b.id === id) ?? null;
  });

  readonly boardColumns = computed<Column[]>(() => {
    const id = this.currentBoardId();
    return this.columns()
      .filter((c) => c.boardId === id)
      .sort((a, b) => a.position - b.position);
  });

  readonly boardCards = computed<Card[]>(() => {
    const id = this.currentBoardId();
    return this.cards().filter((c) => c.boardId === id);
  });

  readonly stats = computed<BoardStat>(() => {
    const cards = this.boardCards();
    const total = cards.length;
    const done = cards.filter((c) => c.completed).length;
    return { total, done, progress: total ? Math.round((done / total) * 100) : 0 };
  });

  readonly boardCounts = computed<Map<number, BoardStat>>(() => {
    const map = new Map<number, BoardStat>();
    for (const board of this.boards()) {
      const cards = this.cards().filter((c) => c.boardId === board.id);
      const total = cards.length;
      const done = cards.filter((c) => c.completed).length;
      map.set(board.id, { total, done, progress: total ? Math.round((done / total) * 100) : 0 });
    }
    return map;
  });

  async init(): Promise<void> {
    try {
      this.dbPath.set(await App.DBPath());
      await this.reload();
      const boards = this.boards();
      if (boards.length && this.currentBoardId() === null) {
        this.currentBoardId.set(boards[0].id);
      }
    } catch (err) {
      this.error.set(this.describe(err));
    } finally {
      this.loading.set(false);
    }
  }

  cardsForColumn(columnId: number): Card[] {
    const q = this.search().trim().toLowerCase();
    return this.cards()
      .filter((c) => c.columnId === columnId)
      .filter((c) => {
        if (!q) return true;
        return (
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.position - b.position);
  }

  selectBoard(id: number): void {
    this.currentBoardId.set(id);
  }

  // -------------------------------------------------------------------------
  // Boards
  // -------------------------------------------------------------------------

  async createBoard(input: BoardInput): Promise<void> {
    const board = await this.run(() => App.CreateBoard(input));
    if (!board) return;
    await this.reload();
    this.currentBoardId.set(board.id);
  }

  async updateBoard(input: BoardInput): Promise<void> {
    const board = await this.run(() => App.UpdateBoard(input));
    if (!board) return;
    this.boards.update((list) => list.map((b) => (b.id === board.id ? board : b)));
  }

  async deleteBoard(id: number): Promise<void> {
    const ok = await this.run(() => App.DeleteBoard(id));
    if (ok === null) return;
    await this.reload();
    const boards = this.boards();
    if (this.currentBoardId() === id) {
      this.currentBoardId.set(boards.length ? boards[0].id : null);
    }
  }

  // -------------------------------------------------------------------------
  // Columns
  // -------------------------------------------------------------------------

  async createColumn(input: ColumnInput): Promise<void> {
    const column = await this.run(() => App.CreateColumn(input));
    if (!column) return;
    this.columns.update((list) => [...list, column]);
  }

  async updateColumn(input: ColumnInput): Promise<void> {
    const column = await this.run(() => App.UpdateColumn(input));
    if (!column) return;
    this.columns.update((list) => list.map((c) => (c.id === column.id ? column : c)));
  }

  async deleteColumn(id: number): Promise<void> {
    const ok = await this.run(() => App.DeleteColumn(id));
    if (ok === null) return;
    this.columns.update((list) => list.filter((c) => c.id !== id));
    this.cards.update((list) => list.filter((c) => c.columnId !== id));
  }

  async reorderColumns(ids: number[]): Promise<void> {
    const boardId = this.currentBoardId();
    if (boardId === null) return;
    this.columns.update((list) =>
      list.map((c) => {
        const idx = ids.indexOf(c.id);
        return idx === -1 ? c : { ...c, position: idx };
      }),
    );
    await this.run(() => App.ReorderColumns(boardId, ids));
  }

  // -------------------------------------------------------------------------
  // Cards
  // -------------------------------------------------------------------------

  async createCard(input: CardInput): Promise<void> {
    const card = await this.run(() => App.CreateCard(input));
    if (!card) return;
    this.cards.update((list) => [...list, card]);
  }

  async updateCard(input: CardInput): Promise<void> {
    const card = await this.run(() => App.UpdateCard(input));
    if (!card) return;
    this.cards.update((list) => list.map((c) => (c.id === card.id ? card : c)));
  }

  async deleteCard(id: number): Promise<void> {
    const ok = await this.run(() => App.DeleteCard(id));
    if (ok === null) return;
    this.cards.update((list) => list.filter((c) => c.id !== id));
  }

  async toggleComplete(id: number): Promise<void> {
    const card = await this.run(() => App.ToggleComplete(id));
    if (!card) return;
    this.cards.update((list) => list.map((c) => (c.id === card.id ? card : c)));
  }

  async moveCard(cardId: number, columnId: number, ids: number[]): Promise<void> {
    const index = ids.indexOf(cardId);
    this.cards.update((list) =>
      list.map((c) => {
        if (c.id === cardId) return { ...c, columnId };
        const idx = ids.indexOf(c.id);
        return idx === -1 ? c : { ...c, position: idx };
      }),
    );
    await this.run(() => App.MoveCard(cardId, columnId, index));
  }

  async reorderCards(columnId: number, ids: number[]): Promise<void> {
    this.cards.update((list) =>
      list.map((c) => {
        const idx = ids.indexOf(c.id);
        return c.columnId === columnId && idx !== -1 ? { ...c, position: idx } : c;
      }),
    );
    await this.run(() => App.ReorderCards(columnId, ids));
  }

  // -------------------------------------------------------------------------

  private async reload(): Promise<void> {
    const snap: Snapshot = await App.GetSnapshot();
    this.boards.set(snap.boards);
    this.columns.set(snap.columns);
    this.cards.set(snap.cards);
    const id = this.currentBoardId();
    if (id !== null && !snap.boards.some((b) => b.id === id)) {
      this.currentBoardId.set(snap.boards.length ? snap.boards[0].id : null);
    }
  }

  private async run<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      this.error.set(this.describe(err));
      setTimeout(() => this.error.set(null), 4000);
      return null;
    }
  }

  private describe(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
