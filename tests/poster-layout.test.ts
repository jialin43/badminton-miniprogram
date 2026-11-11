import { describe, expect, it } from 'vitest';
import {
  POSTER_PADDING,
  POSTER_WIDTH,
  buildPosterLayout,
} from '../src/lib/poster-layout';

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe('buildPosterLayout', () => {
  it.each([1, 2, 3, 6, 8, 12])('为 %i 个小组生成正确数量的卡片', (count) => {
    const layout = buildPosterLayout(count);

    expect(layout.cards).toHaveLength(count);
    expect(layout.width).toBe(POSTER_WIDTH);
    expect(layout.height).toBeGreaterThanOrEqual(1200);

    layout.cards.forEach((card) => {
      expect(card.x).toBeGreaterThanOrEqual(POSTER_PADDING);
      expect(card.x + card.w).toBeLessThanOrEqual(POSTER_WIDTH - POSTER_PADDING);
      expect(card.y + card.h).toBeLessThan(layout.footer.dividerY);
      expect(card.cells).toHaveLength(6);

      card.cells.forEach((cell) => {
        expect(cell.x).toBeGreaterThanOrEqual(card.x);
        expect(cell.x + cell.w).toBeLessThanOrEqual(card.x + card.w);
        expect(cell.y + cell.h).toBeLessThanOrEqual(card.y + card.h);
      });
    });
  });

  it('卡片之间不会重叠', () => {
    const layout = buildPosterLayout(8);

    for (let i = 0; i < layout.cards.length; i += 1) {
      for (let j = i + 1; j < layout.cards.length; j += 1) {
        expect(overlaps(layout.cards[i]!, layout.cards[j]!)).toBe(false);
      }
    }
  });

  it('1 组和 2 组使用单列大卡片，3 组以上使用双列', () => {
    expect(buildPosterLayout(1).grid.columns).toBe(1);
    expect(buildPosterLayout(2).grid.columns).toBe(1);
    expect(buildPosterLayout(3).grid.columns).toBe(2);
    expect(buildPosterLayout(6).grid.columns).toBe(2);
  });

  it('后补名单和球局提示布局在卡片与页脚之间', () => {
    const layout = buildPosterLayout(2, 9);

    expect(layout.waitlist).not.toBeNull();
    expect(layout.waitlist!.cells).toHaveLength(9);
    expect(layout.cards[1]!.y + layout.cards[1]!.h).toBeLessThan(
      layout.waitlist!.y,
    );
    expect(layout.waitlist!.y + layout.waitlist!.h).toBeLessThan(
      layout.notice.y,
    );
    expect(layout.notice.y + layout.notice.h).toBeLessThan(
      layout.footer.dividerY,
    );

    layout.waitlist!.cells.forEach((cell) => {
      expect(cell.x).toBeGreaterThanOrEqual(layout.waitlist!.x);
      expect(cell.x + cell.w).toBeLessThanOrEqual(
        layout.waitlist!.x + layout.waitlist!.w,
      );
      expect(cell.y + cell.h).toBeLessThanOrEqual(
        layout.waitlist!.y + layout.waitlist!.h,
      );
    });
  });

  it('没有后补时不生成后补区域', () => {
    const layout = buildPosterLayout(3, 0);
    expect(layout.waitlist).toBeNull();
  });

  it('组数增加时高度不会变小', () => {
    const heights = [1, 2, 3, 4, 6, 8, 10].map(
      (count) => buildPosterLayout(count).height,
    );

    for (let index = 1; index < heights.length; index += 1) {
      expect(heights[index]!).toBeGreaterThanOrEqual(heights[index - 1]!);
    }
  });

  it('0 个小组也能返回安全的空布局', () => {
    const layout = buildPosterLayout(0);
    expect(layout.cards).toEqual([]);
    expect(layout.height).toBeGreaterThan(0);
  });
});
