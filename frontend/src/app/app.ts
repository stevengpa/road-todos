import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
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
import { BoardInput, Board as BoardModel, Reminder } from './models';

@Component({
  selector: 'app-root',
  imports: [FormsModule, Board, BoardDialog, Calendar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, OnDestroy {
  protected readonly state = inject(StateService);
  private readonly zone = inject(NgZone);

  protected readonly boardDialogOpen = signal(false);
  protected readonly editingBoard = signal<BoardModel | null>(null);

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
      return isNaN(d.getTime())
        ? 'Reminder'
        : `Reminder · ${d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    }
    return r.overdue ? `Overdue · due ${r.dueDate}` : 'Due today';
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

  protected async onDeleteBoard(id: number): Promise<void> {
    await this.state.deleteBoard(id);
    this.closeBoardDialog();
  }

  protected countFor(boardId: number): number {
    return this.state.boardCounts().get(boardId)?.total ?? 0;
  }
}
