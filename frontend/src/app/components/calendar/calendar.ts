import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { StateService } from '../../state.service';

interface DayCell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  dueCount: number;
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function keyOf(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-calendar',
  imports: [],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Calendar {
  private readonly state = inject(StateService);

  protected readonly weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  protected readonly cursor = signal(firstOfMonth(new Date()));

  protected readonly monthLabel = computed(() =>
    this.cursor().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  );

  // How many open tasks fall on each day, so the grid can flag busy dates.
  private readonly dueCounts = computed<Map<string, number>>(() => {
    const counts = new Map<string, number>();
    for (const card of this.state.boardCards()) {
      if (card.completed || !card.dueDate) continue;
      const key = card.dueDate.slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  });

  protected readonly days = computed<DayCell[]>(() => {
    const cursor = this.cursor();
    const first = firstOfMonth(cursor);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const todayKey = keyOf(new Date());
    const counts = this.dueCounts();

    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = keyOf(date);
      cells.push({
        key,
        day: date.getDate(),
        inMonth: date.getMonth() === cursor.getMonth(),
        isToday: key === todayKey,
        dueCount: counts.get(key) ?? 0,
      });
    }
    return cells;
  });

  protected prev(): void {
    this.cursor.update((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  protected next(): void {
    this.cursor.update((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  protected goToday(): void {
    this.cursor.set(firstOfMonth(new Date()));
  }
}
