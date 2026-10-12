import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import * as Runtime from '../../wailsjs/runtime/runtime';
import { StateService } from './state.service';
import { Board } from './components/board/board';
import { BoardDialog } from './components/board-dialog/board-dialog';
import { Calendar } from './components/calendar/calendar';
import { CardDialog } from './components/card-dialog/card-dialog';
import {
  BoardInput,
  Board as BoardModel,
  Card,
  CardInput,
  Column,
  Reminder,
  SMART_VIEWS,
  SmartView,
  dayKey,
  formatDateTime,
  formatDue,
  localDayKey,
  offsetLabel,
  parseTags,
  priorityMeta,
  recurrenceLabel,
} from './models';

@Component({
  selector: 'app-root',
  imports: [FormsModule, Board, BoardDialog, Calendar, CardDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, OnDestroy {
  protected readonly state = inject(StateService);
  private readonly zone = inject(NgZone);

  protected readonly smartViews = SMART_VIEWS;
  protected readonly dueLabel = formatDue;
  protected readonly priority = priorityMeta;
  protected readonly tags = parseTags;
  protected readonly repeat = recurrenceLabel;

  protected readonly boardDialogOpen = signal(false);
  protected readonly editingBoard = signal<BoardModel | null>(null);

  // Sidebar visibility, remembered between launches.
  protected readonly collapsed = signal(readCollapsed());

  // Card modal opened from a smart view. The dialog needs the card's own board
  // and that board's stages, which may differ from the currently selected board.
  protected readonly cardDialogOpen = signal(false);
  protected readonly editingViewCard = signal<Card | null>(null);

  protected readonly viewCardColumns = computed<Column[]>(() => {
    const card = this.editingViewCard();
    if (!card) return [];
    return this.state
      .columns()
      .filter((c) => c.boardId === card.boardId)
      .sort((a, b) => a.position - b.position);
  });

  private offReminder?: () => void;
  private onFocus?: () => void;

  constructor() {
    effect(() => {
      document.documentElement.dataset['theme'] = this.state.theme();
    });
  }

  ngOnInit(): void {
    void this.state.init();

    this.offReminder = Runtime.EventsOn('reminder:fired', () => {
      this.zone.run(() => void this.state.refreshReminders());
    });

    this.onFocus = () => this.zone.run(() => void this.state.refreshReminders());
    window.addEventListener('focus', this.onFocus);
  }

  ngOnDestroy(): void {
    this.offReminder?.();
    if (this.onFocus) window.removeEventListener('focus', this.onFocus);
  }

  protected openDBFolder(): void {
    void this.state.openDBFolder();
  }

  protected reminderLabel(r: Reminder): string {
    if (r.kind === 'reminder') {
      const d = new Date(r.remindAt);
      return isNaN(d.getTime()) ? 'Reminder' : `Reminder · ${formatDateTime(r.remindAt)}`;
    }
    return r.overdue ? `Overdue · due ${formatDue(r.dueDate)}` : 'Due today';
  }

  protected viewReminder(r: Reminder): void {
    this.state.selectBoard(r.boardId);
    this.state.dismissReminder(r);
  }

  protected toggleTheme(): void {
    void this.state.setTheme(this.state.theme() === 'dark' ? 'light' : 'dark');
  }

  protected toggleCompleted(): void {
    void this.state.toggleShowCompleted();
  }

  protected toggleSidebar(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem('road-todo.sidebar', next ? 'collapsed' : 'open');
    } catch {
      /* storage unavailable; state stays in-memory */
    }
  }

  protected openNewBoard(): void {
    this.editingBoard.set(null);
    this.boardDialogOpen.set(true);
  }

  protected openEditBoard(): void {
    this.editingBoard.set(this.state.currentBoard());
    this.boardDialogOpen.set(true);
  }

  protected closeBoardDialog(): void {
    this.boardDialogOpen.set(false);
    this.editingBoard.set(null);
  }

  protected async onSaveBoard(input: BoardInput): Promise<void> {
    if (input.id) {
      await this.state.updateBoard(input);
    } else {
      await this.state.createBoard(input);
    }
    this.closeBoardDialog();
  }

  protected async changeBoardColor(board: BoardModel, event: Event): Promise<void> {
    const value = (event.target as HTMLInputElement).value;
    if (value && value !== board.color) {
      await this.state.updateBoard({ id: board.id, name: board.name, description: board.description, color: value });
    }
  }

  protected async onDeleteBoard(id: number): Promise<void> {
    await this.state.deleteBoard(id);
    this.closeBoardDialog();
  }

  protected countFor(boardId: number): number {
    return this.state.boardCounts().get(boardId)?.total ?? 0;
  }

  // -- smart views ----------------------------------------------------------

  protected selectView(view: SmartView): void {
    this.state.selectView(view);
  }

  protected viewCount(view: SmartView): number {
    return this.state.viewCounts().get(view) ?? 0;
  }

  protected viewLabel(view: SmartView): string {
    return SMART_VIEWS.find((v) => v.key === view)?.label ?? '';
  }

  // Title for whichever list the main area is showing (a smart view or a day).
  protected listTitle(): string {
    const date = this.state.activeDate();
    if (date) return formatDue(date);
    const view = this.state.activeView();
    return view ? this.viewLabel(view) : '';
  }

  protected boardName(card: Card): string {
    return this.state.boards().find((b) => b.id === card.boardId)?.name ?? '';
  }

  protected columnName(card: Card): string {
    return this.state.columns().find((c) => c.id === card.columnId)?.name ?? '';
  }

  protected isOverdue(card: Card): boolean {
    if (!card.dueDate) return false;
    if (card.dueDate.includes('T')) return new Date(card.dueDate).getTime() < Date.now();
    return dayKey(card.dueDate) < localDayKey();
  }

  protected remindText(card: Card): string {
    if (card.remindBefore > 0) return `${offsetLabel(card.remindBefore)} before due`;
    return formatDateTime(card.remindAt);
  }

  protected toggleCard(card: Card): void {
    void this.state.toggleComplete(card.id);
  }

  // -- card modal from a view -----------------------------------------------

  protected openViewCard(card: Card): void {
    this.editingViewCard.set(card);
    this.cardDialogOpen.set(true);
  }

  protected closeViewCard(): void {
    this.cardDialogOpen.set(false);
    this.editingViewCard.set(null);
  }

  protected async onSaveViewCard(input: CardInput): Promise<void> {
    if (input.id) {
      await this.state.updateCard(input);
    } else {
      await this.state.createCard(input);
    }
    this.closeViewCard();
  }

  protected async onDeleteViewCard(id: number): Promise<void> {
    await this.state.deleteCard(id);
    this.closeViewCard();
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem('road-todo.sidebar') === 'collapsed';
  } catch {
    return false;
  }
}
