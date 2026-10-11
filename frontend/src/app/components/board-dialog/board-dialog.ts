import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { BOARD_COLORS, Board, BoardInput } from '../../models';

@Component({
  selector: 'app-board-dialog',
  imports: [FormsModule],
  templateUrl: './board-dialog.html',
  styleUrl: './board-dialog.scss',
})
export class BoardDialog implements OnInit {
  readonly board = input<Board | null>(null);

  readonly save = output<BoardInput>();
  readonly remove = output<number>();
  readonly closed = output<void>();

  protected readonly palette = BOARD_COLORS;
  protected readonly confirming = signal(false);
  protected readonly editing = computed(() => this.board() != null);

  protected name = '';
  protected description = '';
  protected color = BOARD_COLORS[0];

  ngOnInit(): void {
    const board = this.board();
    if (board) {
      this.name = board.name;
      this.description = board.description;
      this.color = board.color || BOARD_COLORS[0];
    }
  }

  protected setColor(color: string): void {
    this.color = color;
  }

  protected submit(): void {
    this.save.emit({
      id: this.board()?.id ?? 0,
      name: this.name.trim() || 'Untitled board',
      description: this.description.trim(),
      color: this.color,
    });
  }

  protected askDelete(): void {
    this.confirming.set(true);
  }

  protected cancelDelete(): void {
    this.confirming.set(false);
  }

  protected confirmDelete(): void {
    const board = this.board();
    if (board) this.remove.emit(board.id);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected stop(event: Event): void {
    event.stopPropagation();
  }
}
