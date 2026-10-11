import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { StateService } from './state.service';
import { Board } from './components/board/board';
import { BoardDialog } from './components/board-dialog/board-dialog';
import { BoardInput, Board as BoardModel } from './models';

@Component({
  selector: 'app-root',
  imports: [FormsModule, Board, BoardDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly state = inject(StateService);
  protected readonly theme = signal<'dark' | 'light'>('dark');

  protected readonly boardDialogOpen = signal(false);
  protected readonly editingBoard = signal<BoardModel | null>(null);

  constructor() {
    effect(() => {
      document.documentElement.dataset['theme'] = this.theme();
    });
  }

  ngOnInit(): void {
    void this.state.init();
  }

  protected toggleTheme(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
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
