import { Injectable, computed, signal } from '@angular/core';

import * as App from '../../wailsjs/go/main/App';
import {
  Board,
  BoardInput,
  BoardView,
  Card,
  CardInput,
  Column,
  ColumnInput,
  Reminder,
  Settings,
  SMART_VIEWS,
  SmartView,
  Snapshot,
  Theme,
  User,
  View,
  dayKey,
  localDayKey,
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
  readonly user = signal<User | null>(null);
  readonly authToken = signal<string>(localStorage.getItem('road-todo-token') || '');
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

  // The active smart view (Agenda-style filters). When set, the main area shows
  // a dedicated list instead of the current board. Selecting a board clears it.
  readonly activeView = signal<SmartView | null>(null);

  // A specific calendar day selected from the sidebar. Shares the same list
  // presentation as the smart views but filters by an exact due date.
  readonly activeDate = signal<string | null>(null);

  // Per-board layout preference, keyed by board id. The active view is derived
  // from whichever board is currently selected.
  readonly boardViews = signal<ReadonlyMap<number, View>>(new Map());
  readonly view = computed<View>(() => this.boardViews().get(this.currentBoardId() ?? -1) ?? 'kanban');

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

  // Flat, ordered list of the current board's cards after applying the search
  // and "show completed" filters. Drives the table view.
  readonly visibleBoardCards = computed<Card[]>(() => {
    const showDone = this.showCompleted();
    const q = this.search().trim().toLowerCase();
    const colPos = new Map<number, number>(
      this.boardColumns().map((c) => [c.id, c.position]),
    );
    return this.boardCards()
      .filter((c) => (showDone || !c.completed) && (!q || this.matches(c, q)))
      .sort((a, b) => {
        const pa = colPos.get(a.columnId) ?? 0;
        const pb = colPos.get(b.columnId) ?? 0;
        return pa - pb || a.position - b.position || a.id - b.id;
      });
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

  // -------------------------------------------------------------------------
  // Smart views
  // -------------------------------------------------------------------------

  private matchesView(card: Card, view: SmartView, today: string, next: string): boolean {
    if (card.completed) return false;
    const day = dayKey(card.dueDate);
    switch (view) {
      case 'today':
        return day === today;
      case 'overdue':
        return this.isOverdueDue(card.dueDate, today);
      case 'noDue':
        return card.dueDate === '';
      case 'nextWeek':
        return day !== '' && day > today && day <= next;
    }
  }

  // A timed due value is overdue once its instant passes; a date-only value is
  // only overdue after its whole day has elapsed.
  private isOverdueDue(dueDate: string, today: string): boolean {
    if (!dueDate) return false;
    if (dueDate.includes('T')) return new Date(dueDate).getTime() < Date.now();
    return dayKey(dueDate) < today;
  }

  readonly viewCounts = computed<Map<SmartView, number>>(() => {
    const today = localDayKey();
    const next = localDayKey(new Date(), 7);
    const map = new Map<SmartView, number>(SMART_VIEWS.map((v) => [v.key, 0]));
    for (const card of this.cards()) {
      for (const v of SMART_VIEWS) {
        if (this.matchesView(card, v.key, today, next)) {
          map.set(v.key, (map.get(v.key) ?? 0) + 1);
        }
      }
    }
    return map;
  });

  readonly activeViewCards = computed<Card[]>(() => {
    const view = this.activeView();
    const date = this.activeDate();
    if (!view && !date) return EMPTY_CARDS;
    const today = localDayKey();
    const next = localDayKey(new Date(), 7);
    const q = this.search().trim().toLowerCase();
    return this.cards()
      .filter((c) => {
        if (q && !this.matches(c, q)) return false;
        if (date) return !c.completed && dayKey(c.dueDate) === date;
        return this.matchesView(c, view as SmartView, today, next);
      })
      .sort(
        (a, b) =>
          (a.dueDate || '9999').localeCompare(b.dueDate || '9999') ||
          a.position - b.position ||
          a.id - b.id,
      );
  });

  selectView(view: SmartView): void {
    this.activeDate.set(null);
    this.activeView.set(this.activeView() === view ? null : view);
  }

  selectDate(date: string): void {
    this.activeView.set(null);
    this.activeDate.set(this.activeDate() === date ? null : date);
  }

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

    const views: BoardView[] = (await App.BoardViews()) ?? [];
    this.boardViews.set(
      new Map(views.map((v) => [v.boardId, v.view === 'table' ? 'table' : 'kanban'])),
    );
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

  async setView(view: View): Promise<void> {
    const id = this.currentBoardId();
    if (id === null) return;
    this.boardViews.update((map) => {
      const next = new Map(map);
      next.set(id, view);
      return next;
    });
    await this.runVoid(() => App.SetBoardView(id, view));
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
    this.activeView.set(null);
    this.activeDate.set(null);
    this.currentBoardId.set(id);
  }

  // -------------------------------------------------------------------------
  // Boards
  // -------------------------------------------------------------------------

  async createBoard(input: BoardInput): Promise<void> {
    const board = await this.run(() => App.CreateBoard(input));
    if (!board) return;
    await this.reload();
    this.activeView.set(null);
    this.activeDate.set(null);
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
    this.boardViews.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
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
    const snap: Snapshot = await App.GetSnapshot() as any;
    this.user.set(snap.user || null);
    this.boards.set(snap.boards || []);
    this.columns.set(snap.columns || []);
    this.cards.set(snap.cards || []);
    const id = this.currentBoardId();
    if (id !== null && !this.boards().some((b) => b.id === id)) {
      this.currentBoardId.set(this.boards().length ? this.boards()[0].id : null);
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

  async register(username: string, password: string): Promise<boolean> {
    try {
      await App.RegisterUser(username, password);
      return this.login(username, password);
    } catch (err) {
      this.error.set(this.describe(err));
      setTimeout(() => this.error.set(null), 4000);
      return false;
    }
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      const res: any = await App.LoginUser(username, password);
      const token = res?.token || res?.sessionId || res?.session?.id || res?.Token || '';
      if (token) {
        this.authToken.set(token);
        localStorage.setItem('road-todo-token', token);
      }
      const user = res?.user || res?.User || (token ? await App.CurrentUser(token).catch(() => null) : null);
      if (user) {
        this.user.set(user);
      }
      await this.reload();
      await this.refreshReminders();
      const boards = this.boards();
      if (boards.length && this.currentBoardId() === null) {
        this.currentBoardId.set(boards[0].id);
      }
      if (!this.user()) {
        // try to reload snapshot again
        await this.reload();
      }
      return !!this.user();
    } catch (err) {
      this.error.set(this.describe(err));
      setTimeout(() => this.error.set(null), 4000);
      return false;
    }
  }

  async logout(): Promise<void> {
    const t = this.authToken();
    if (t) {
      try {
        await App.LogoutUser(t);
      } catch {}
    }
    this.authToken.set('');
    localStorage.removeItem('road-todo-token');
    this.user.set(null);
    await this.reload();
  }

  async deleteAccount(): Promise<boolean> {
    const t = this.authToken();
    if (!t) return false;
    const ok = await this.runVoid(() => App.DeleteAccount(t));
    if (ok) {
      this.authToken.set('');
      localStorage.removeItem('road-todo-token');
      this.user.set(null);
      await this.reload();
    }
    return ok;
  }
}
