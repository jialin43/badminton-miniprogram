export const POSTER_WIDTH = 1080;
export const POSTER_PADDING = 64;
export const POSTER_HEADER_BOTTOM = 460;

export interface PosterCellLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PosterCardLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  columns: number;
  rows: number;
  cellW: number;
  cellH: number;
  cells: PosterCellLayout[];
}

export interface PosterWaitlistLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  columns: number;
  rows: number;
  cellW: number;
  cellH: number;
  cells: PosterCellLayout[];
}

export interface PosterNoticeLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PosterLayout {
  width: number;
  height: number;
  padding: number;
  header: {
    eyebrowY: number;
    titleY: number;
    titleLineHeight: number;
    metaY: number;
    venueY: number;
  };
  grid: {
    columns: number;
    rows: number;
    cardW: number;
    cardH: number;
    gapX: number;
    gapY: number;
    startY: number;
  };
  cards: PosterCardLayout[];
  waitlist: PosterWaitlistLayout | null;
  notice: PosterNoticeLayout;
  footer: {
    dividerY: number;
    statsY: number;
    brandY: number;
  };
}

const GAP = 24;
const CONTENT_WIDTH = POSTER_WIDTH - POSTER_PADDING * 2;

function makeCards(
  groupCount: number,
  columns: number,
  cardW: number,
  cardH: number,
  startY: number,
  cellColumns: number,
  cellRows: number,
  cellH: number,
  padding: number,
  listTop: number,
): PosterCardLayout[] {
  const cards: PosterCardLayout[] = [];
  const gapX = 8;
  const gapY = 6;
  const cellW = (cardW - padding * 2 - gapX * (cellColumns - 1)) / cellColumns;

  for (let index = 0; index < groupCount; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = POSTER_PADDING + column * (cardW + GAP);
    const y = startY + row * (cardH + GAP);
    const cells: PosterCellLayout[] = [];

    for (let cellIndex = 0; cellIndex < cellColumns * cellRows; cellIndex += 1) {
      const cellRow = Math.floor(cellIndex / cellColumns);
      const cellColumn = cellIndex % cellColumns;
      cells.push({
        x: x + padding + cellColumn * (cellW + gapX),
        y: y + listTop + cellRow * (cellH + gapY),
        w: cellW,
        h: cellH,
      });
    }

    cards.push({
      x,
      y,
      w: cardW,
      h: cardH,
      columns: cellColumns,
      rows: cellRows,
      cellW,
      cellH,
      cells,
    });
  }

  return cards;
}

function makeWaitlist(count: number, y: number): PosterWaitlistLayout {
  const columns = 4;
  const rows = Math.ceil(count / columns);
  const padding = 24;
  const gap = 8;
  const cellH = 40;
  const rowGap = 6;
  const cellW = (CONTENT_WIDTH - padding * 2 - gap * (columns - 1)) / columns;
  const height = 64 + rows * cellH + Math.max(0, rows - 1) * rowGap + 18;
  const cells: PosterCellLayout[] = [];

  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    cells.push({
      x: POSTER_PADDING + padding + column * (cellW + gap),
      y: y + 64 + row * (cellH + rowGap),
      w: cellW,
      h: cellH,
    });
  }

  return {
    x: POSTER_PADDING,
    y,
    w: CONTENT_WIDTH,
    h: height,
    columns,
    rows,
    cellW,
    cellH,
    cells,
  };
}

export function buildPosterLayout(
  groupCount: number,
  waitlistCount = 0,
): PosterLayout {
  const safeCount = Math.max(0, Math.floor(groupCount));
  const safeWaitlist = Math.max(0, Math.floor(waitlistCount));
  const singleColumn = safeCount <= 2;
  const columns = singleColumn ? 1 : 2;
  const cardW = singleColumn ? CONTENT_WIDTH : 464;
  const cardH = singleColumn ? 258 : 306;
  const cellColumns = singleColumn ? 3 : 2;
  const cellRows = singleColumn ? 2 : 3;
  const cellH = singleColumn ? 62 : 58;
  const padding = singleColumn ? 28 : 24;
  const listTop = singleColumn ? 100 : 96;

  const rows = safeCount === 0 ? 0 : Math.ceil(safeCount / columns);
  const gridHeight = rows * cardH + Math.max(0, rows - 1) * GAP;
  const startY = POSTER_HEADER_BOTTOM;
  const gridEnd = startY + gridHeight;

  let cursor = gridEnd;
  let waitlist: PosterWaitlistLayout | null = null;

  if (safeWaitlist > 0) {
    cursor += 24;
    waitlist = makeWaitlist(safeWaitlist, cursor);
    cursor += waitlist.h;
  }

  cursor += 24;
  const notice: PosterNoticeLayout = {
    x: POSTER_PADDING,
    y: cursor,
    w: CONTENT_WIDTH,
    h: 116,
  };
  cursor += notice.h;

  const minHeight = safeCount <= 1 ? 1200 : safeCount === 2 ? 1280 : 1440;
  const height = Math.max(minHeight, cursor + 190);

  return {
    width: POSTER_WIDTH,
    height,
    padding: POSTER_PADDING,
    header: {
      eyebrowY: 98,
      titleY: 190,
      titleLineHeight: 82,
      metaY: 356,
      venueY: 408,
    },
    grid: {
      columns,
      rows,
      cardW,
      cardH,
      gapX: GAP,
      gapY: GAP,
      startY,
    },
    cards: makeCards(
      safeCount,
      columns,
      cardW,
      cardH,
      startY,
      cellColumns,
      cellRows,
      cellH,
      padding,
      listTop,
    ),
    waitlist,
    notice,
    footer: {
      dividerY: height - 140,
      statsY: height - 84,
      brandY: height - 36,
    },
  };
}
