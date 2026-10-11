import { Injectable, computed, signal } from '@angular/core';

import * as App from '../../wailsjs/go/main/App';
import {
  Board,
  BoardInput,
  Card,
  CardInput,
  Column,
  ColumnInput,
  Reminder,
  Settings,
  Snapshot,
  Theme,
} from './models';

export interface BoardStat {
  total: number;
  done: number;
  progress: number;
}

// Shared identity for empty columns so the drag & drop directive sees a stable
// array reference between change-detection runs.
const EMPTY_CARDS: Card[] = [];

@Injectable({ providedIn: 'root' })
export class StateService {
  readonly boards = signal<Board[]>([]);
  readonly columns = signal<Column[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly currentBoardId = signal<number | null>(null);
  readonly search = signal('');
  readonly reminders = signal<Reminder[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly dbPath = signal('');
  readonly theme = signal<Theme>('dark');
  readonly showCompleted = signal(false);

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

  // Cards grouped by column (respecting the active search) so the template can
  // look them up in O(1) instead of filtering the full list on every cycle.
  private readonly cardsByColumn = computed<Map<number, Card[]>>(() => {
    const q = this.search().trim().toLowerCase();
    const showDone = this.showCompleted();
    const map = new Map<number, Card[]>();
    for (const c of this.cards()) {
      if (!showDone && c.completed) continue;
      if (q && !this.matches(c, q)) continue;
      const list = map.get(c.columnId);
      if (list) {
        list.push(c);
      } else {
        map.set(c.columnId, [c]);
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  });

  private matches(card: Card, query: string): boolean {
    return (
      card.title.toLowerCase().includes(query) ||
      card.description.toLowerCase().includes(query) ||
      card.tags.toLowerCase().includes(query)
    );
  }

  async init(): Promise<void> {
    try {
      this.dbPath.set(await App.DBPath());
      await this.loadSettings();
      await this.reload();
      await this.refreshReminders();
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
    return this.cardsByColumn().get(columnId) ?? EMPTY_CARDS;
  }

  // Every card in a column in stored order, regardless of the search or
  // "show completed" filters. Drag & drop needs the true ordering so hidden
  // cards keep their slots when the visible ones are rearranged.
  allCardsForColumn(columnId: number): Card[] {
    return this.cards()
      .filter((c) => c.columnId === columnId)
      .sort((a, b) => a.position - b.position);
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  private async loadSettings(): Promise<void> {
    const settings: Settings = await App.GetSettings();
    this.theme.set(settings.theme === 'light' ? 'light' : 'dark');
    this.showCompleted.set(!!settings.showCompleted);
  }

  async setTheme(theme: Theme): Promise<void> {
    this.theme.set(theme);
    await this.runVoid(() => App.SetSetting('theme', theme));
  }

  async toggleShowCompleted(): Promise<void> {
    const next = !this.showCompleted();
    this.showCompleted.set(next);
    await this.runVoid(() => App.SetSetting('show_completed', next ? '1' : '0'));
  }

  // -------------------------------------------------------------------------
  // Reminders
  // -------------------------------------------------------------------------

  private readonly dismissedReminders = new Set<string>();

  private reminderKey(r: Reminder): string {
    return `${r.kind}-${r.id}`;
  }

  async refreshReminders(): Promise<void> {
    try {
      const all = (await App.PendingReminders()) ?? [];
      this.reminders.set(all.filter((r) => !this.dismissedReminders.has(this.reminderKey(r))));
    } catch {
      // Reminders are best-effort; ignore transient failures.
    }
  }

  dismissReminder(reminder: Reminder): void {
    this.dismissedReminders.add(this.reminderKey(reminder));
    this.reminders.update((list) =>
      list.filter((r) => !(r.id === reminder.id && r.kind === reminder.kind)),
    );
  }

  dismissAllReminders(): void {
    for (const r of this.reminders()) this.dismissedReminders.add(this.reminderKey(r));
    this.reminders.set([]);
  }

  openDBFolder(): Promise<void | null> {
    return this.run(() => App.OpenDBFolder());
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
    if (!(await this.runVoid(() => App.DeleteBoard(id)))) return;
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
    if (!(await this.runVoid(() => App.DeleteColumn(id)))) return;
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
    void this.refreshReminders();
  }

  async updateCard(input: CardInput): Promise<void> {
    const card = await this.run(() => App.UpdateCard(input));
    if (!card) return;
    this.cards.update((list) => list.map((c) => (c.id === card.id ? card : c)));
    // Re-arm reminders for this card in case its dates changed.
    this.dismissedReminders.delete(`due-${card.id}`);
    this.dismissedReminders.delete(`reminder-${card.id}`);
    void this.refreshReminders();
  }

  async deleteCard(id: number): Promise<void> {
    if (!(await this.runVoid(() => App.DeleteCard(id)))) return;
    this.cards.update((list) => list.filter((c) => c.id !== id));
    void this.refreshReminders();
  }

  async toggleComplete(id: number): Promise<void> {
    const card = await this.run(() => App.ToggleComplete(id));
    if (!card) return;
    this.cards.update((list) => list.map((c) => (c.id === card.id ? card : c)));
    void this.refreshReminders();
  }

  async moveCard(cardId: number, columnId: number, ids: number[]): Promise<void> {
    const index = ids.indexOf(cardId);
    this.cards.update((list) =>
      list.map((c) => {
        if (c.id === cardId) {
          return { ...c, columnId, position: index === -1 ? c.position : index };
        }
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

  // Methods that only return a Go `error` resolve their promise with `null` on
  // success, so a resolved value can't signal failure. This helper reports
  // success explicitly based on whether the call threw.
  private async runVoid(fn: () => Promise<unknown>): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch (err) {
      this.error.set(this.describe(err));
      setTimeout(() => this.error.set(null), 4000);
      return false;
    }
  }

  private describe(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
