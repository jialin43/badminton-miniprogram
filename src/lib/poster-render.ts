import { formatNumericCN, formatShortCN, formatTimeRange } from './date';

/**
 * 小程序 Canvas 2D 上下文。
 * 用宽松类型避免依赖 DOM lib，同时保留渲染器内部的可读性。
 */
export type PosterCtx = CanvasRenderingContext2D;
import { showRoseBadge } from './player';
import type { PosterLayout } from './poster-layout';
import type { PosterPalette } from './poster-theme';
import { getTheme } from './poster-theme';

export interface PosterPlayerData {
  name: string;
  isFemale: boolean;
}

export interface PosterGroupData {
  label: string;
  players: PosterPlayerData[];
}

export interface PosterData {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  capacity: number;
  notice: string;
  groups: PosterGroupData[];
  waitlist: PosterPlayerData[];
  totalPlayers: number;
  femaleCount: number;
  /** 主题 id；缺省用默认主题，兼容旧状态 */
  themeId?: string;
}

// 小程序 Canvas 走系统字体，只写一个泛指字体族最稳；写多个反而可能整串失效。
const FONT_STACK = 'sans-serif';
const EMOJI_FONT = 'sans-serif';

function setFont(
  ctx: PosterCtx,
  size: number,
  weight = 400,
  family = FONT_STACK,
): void {
  ctx.font = `${weight} ${size}px ${family}`;
}

function roundedRect(
  ctx: PosterCtx,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawSpacedText(
  ctx: PosterCtx,
  text: string,
  x: number,
  y: number,
  spacing: number,
  size: number,
  weight: number,
  color: string,
): number {
  setFont(ctx, size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';

  let cursor = x;
  for (const char of Array.from(text)) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  }

  return cursor - spacing - x;
}

function wrapChars(
  ctx: PosterCtx,
  text: string,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; overflow: boolean } {
  const chars = Array.from(text);
  const lines: string[] = [];
  let current = '';

  for (const char of chars) {
    const next = current + char;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = char;

      if (lines.length === maxLines) {
        const consumed = Array.from(lines.join('')).length;
        const rest = chars.slice(consumed).join('');
        const last = `${lines[maxLines - 1] ?? ''}`;
        lines[maxLines - 1] = truncateText(
          ctx,
          `${last}${rest}`,
          maxWidth,
        );
        return { lines, overflow: true };
      }
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  if (lines.length === 0) lines.push('');

  return { lines: lines.slice(0, maxLines), overflow: lines.length > maxLines };
}

function truncateText(
  ctx: PosterCtx,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  const ellipsis = '…';
  let chars = Array.from(text);

  while (chars.length > 0) {
    chars = chars.slice(0, -1);
    const candidate = `${chars.join('')}${ellipsis}`;
    if (ctx.measureText(candidate).width <= maxWidth) return candidate;
  }

  return ellipsis;
}

function fitTitle(
  ctx: PosterCtx,
  title: string,
  maxWidth: number,
): { lines: string[]; size: number } {
  const sizes = [80, 72, 64, 56];

  for (const size of sizes) {
    setFont(ctx, size, 800);
    const wrapped = wrapChars(ctx, title, maxWidth, 2);
    if (!wrapped.overflow) {
      return { lines: wrapped.lines, size };
    }
  }

  setFont(ctx, 56, 800);
  return {
    lines: wrapChars(ctx, title, maxWidth, 2).lines,
    size: 56,
  };
}

function fitName(
  ctx: PosterCtx,
  name: string,
  maxWidth: number,
): { text: string; size: number } {
  const sizes = [36, 32, 28, 24];

  for (const size of sizes) {
    setFont(ctx, size, 700);
    if (ctx.measureText(name).width <= maxWidth) {
      return { text: name, size };
    }
  }

  setFont(ctx, 24, 700);
  return { text: truncateText(ctx, name, maxWidth), size: 24 };
}

/**
 * 画 🌹 女生标记。
 *
 * 与界面保持一致：界面用的是 emoji 字形 🌹，
 * 海报早期版本手绘矢量玫瑰（带花茎叶片），观感像“一朵花”，
 * 与卡片上的 emoji 不是同一个东西。这里改回同字形，
 * 保证「界面上看到的」和「海报上印的」是同一个图标。
 *
 * 风险兜底：极少数机型 Canvas 的 fillText 不出彩色 emoji，
 * 会退化成黑白轮廓。用 measureText 探测字形宽度，宽度异常
 * （字体缺字时通常接近 0 或等于 fallback 宽度）才退回矢量绘制。
 */
function drawRose(
  ctx: PosterCtx,
  palette: PosterPalette,
  x: number,
  baseline: number,
  size = 22,
): number {
  const GLYPH = '🌹';

  ctx.save();
  setFont(ctx, size, 400, EMOJI_FONT);
  const width = ctx.measureText(GLYPH).width;

  // 字形缺失：宽度接近 0 或远超字号（缺字 fallback 渲染成方块）
  if (width > size * 0.2 && width < size * 2.2) {
    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(GLYPH, x, baseline);
    ctx.restore();
    return width;
  }

  ctx.restore();

  // —— 兜底：字形不可用时用简洁的粉色玫瑰形圆点，避免整图缺失标记 ——
  const r = size * 0.38;
  const cx = x + r;
  const cy = baseline - size * 0.3;

  ctx.save();
  ctx.fillStyle = palette.rose;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return r * 2;
}

function drawBackground(
  ctx: PosterCtx,
  layout: PosterLayout,
  palette: PosterPalette,
): void {
  const gradient = ctx.createLinearGradient(0, 0, layout.width, layout.height);
  gradient.addColorStop(0, palette.bgStart);
  gradient.addColorStop(0.55, palette.bgMid);
  gradient.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, layout.width, layout.height);

  ctx.save();
  ctx.strokeStyle = palette.bgLine;
  ctx.lineWidth = 2;
  ctx.strokeRect(42, 42, layout.width - 84, layout.height - 84);

  ctx.beginPath();
  ctx.moveTo(layout.width * 0.72, 0);
  ctx.lineTo(layout.width * 0.72, layout.height);
  ctx.moveTo(0, layout.height * 0.52);
  ctx.lineTo(layout.width, layout.height * 0.52);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(layout.width * 0.86, 190, 250, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = palette.accentFaint;
  ctx.beginPath();
  ctx.arc(layout.width * 0.86, 190, 176, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 右上角的羽毛球线稿
  ctx.save();
  ctx.translate(902, 156);
  ctx.rotate(-0.18);
  ctx.strokeStyle = palette.accentSoft;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  for (let index = -3; index <= 3; index += 1) {
    ctx.beginPath();
    ctx.moveTo(index * 9, 8);
    ctx.lineTo(index * 25, -96);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.ellipse(0, 18, 38, 30, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-24, 40);
  ctx.quadraticCurveTo(0, 72, 24, 40);
  ctx.stroke();
  ctx.restore();
}

function drawHeader(
  ctx: PosterCtx,
  data: PosterData,
  layout: PosterLayout,
  palette: PosterPalette,
): void {
  const { header, padding } = layout;
  const maxWidth = layout.width - padding * 2;

  ctx.fillStyle = palette.accent;
  roundedRect(ctx, padding, header.eyebrowY - 18, 12, 12, 3);
  ctx.fill();

  const eyebrowWidth = drawSpacedText(
    ctx,
    'SHUTTLE SIX',
    padding + 24,
    header.eyebrowY,
    3.2,
    22,
    700,
    palette.accent,
  );

  ctx.fillStyle = palette.onBgFaint;
  ctx.fillRect(
    padding + 24 + eyebrowWidth + 18,
    header.eyebrowY - 8,
    34,
    2,
  );

  setFont(ctx, 20, 500);
  ctx.fillStyle = palette.onBgMuted;
  ctx.fillText(
    '羽球分组',
    padding + 24 + eyebrowWidth + 66,
    header.eyebrowY,
  );

  const title = fitTitle(ctx, data.title || '羽毛球分组', maxWidth);
  setFont(ctx, title.size, 800);
  ctx.fillStyle = palette.onBg;
  ctx.textAlign = 'left';
  title.lines.forEach((line, index) => {
    ctx.fillText(line, padding, header.titleY + index * header.titleLineHeight);
  });

  const dateLabel = formatShortCN(data.date) || '日期待定';
  setFont(ctx, 28, 700);
  const dateWidth = ctx.measureText(dateLabel).width;
  const pillWidth = dateWidth + 44;
  const pillHeight = 44;
  const pillY = header.metaY - 32;

  ctx.fillStyle = palette.accent;
  roundedRect(ctx, padding, pillY, pillWidth, pillHeight, 22);
  ctx.fill();

  setFont(ctx, 28, 800);
  ctx.fillStyle = palette.bgMid;
  ctx.fillText(dateLabel, padding + 22, header.metaY);

  setFont(ctx, 30, 600);
  ctx.fillStyle = palette.onBg;
  ctx.fillText(
    formatTimeRange(data.startTime, data.endTime),
    padding + pillWidth + 22,
    header.metaY,
  );

  setFont(ctx, 26, 500);
  ctx.strokeStyle = palette.onBgMuted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(padding + 8, header.venueY - 9, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(padding + 8, header.venueY - 2);
  ctx.lineTo(padding + 8, header.venueY + 8);
  ctx.stroke();

  ctx.fillStyle = palette.onBgMuted;
  ctx.fillText(
    truncateText(ctx, data.venue || '场地待定', maxWidth - 32),
    padding + 28,
    header.venueY,
  );

  ctx.strokeStyle = palette.bgLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding, 430);
  ctx.lineTo(layout.width - padding, 430);
  ctx.stroke();
}

function drawCard(
  ctx: PosterCtx,
  group: PosterGroupData,
  layout: PosterLayout,
  cardIndex: number,
  capacity: number,
  palette: PosterPalette,
): void {
  const card = layout.cards[cardIndex];
  if (!card) return;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = palette.cardFill;
  roundedRect(ctx, card.x, card.y, card.w, card.h, 26);
  ctx.fill();
  ctx.restore();

  const padding = layout.grid.columns === 1 ? 28 : 24;

  const countText = `${group.players.length}/${capacity}`;
  const countFontSize = 22;
  setFont(ctx, countFontSize, 700);

  // 按字体实际度量撑开胶囊，避免数字贴边或溢出；再用 alphabetic 基线精确垂直居中。
  const metrics = ctx.measureText(countText);
  const ascent = metrics.actualBoundingBoxAscent || countFontSize * 0.73;
  const descent = metrics.actualBoundingBoxDescent || countFontSize * 0.22;
  const textHeight = ascent + descent;
  const countHeight = Math.max(
    38,
    Math.ceil(textHeight + Math.round(countFontSize * 0.72)),
  );
  const textPadX = Math.round(countFontSize * 0.72);
  const countWidth = Math.max(
    68,
    Math.ceil(metrics.width + textPadX * 2),
  );
  const countX = card.x + card.w - padding - countWidth;
  const countY = card.y + 23;
  const capRadius = countHeight / 2;

  ctx.fillStyle = palette.accent;
  roundedRect(ctx, card.x + padding, card.y + 28, 10, 34, 5);
  ctx.fill();

  setFont(ctx, 36, 800);
  ctx.fillStyle = palette.cardText;
  ctx.textAlign = 'left';
  const labelMax = card.w - padding * 2 - countWidth - 34;
  ctx.fillText(
    truncateText(ctx, group.label, labelMax),
    card.x + padding + 22,
    card.y + 62,
  );

  ctx.fillStyle = palette.bgMid;
  roundedRect(ctx, countX, countY, countWidth, countHeight, capRadius);
  ctx.fill();

  // 让文字视觉中心与胶囊中心重合：基线 = 胶囊中心 + (ascent - descent) / 2
  const countBaseline =
    countY + countHeight / 2 + (ascent - descent) / 2;
  setFont(ctx, countFontSize, 700);
  ctx.fillStyle = palette.accent;
  ctx.textAlign = 'center';
  ctx.fillText(countText, countX + countWidth / 2, countBaseline);

  // 分隔线跟着胶囊底部走，胶囊变高时也不会被压住。
  const dividerY = Math.max(card.y + 78, countY + countHeight + 12);
  ctx.strokeStyle = palette.cardLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(card.x + padding, dividerY);
  ctx.lineTo(card.x + card.w - padding, dividerY);
  ctx.stroke();

  for (let index = 0; index < capacity; index += 1) {
    const cell = card.cells[index];
    if (!cell) continue;

    const player = group.players[index];

    if (!player) {
      roundedRect(ctx, cell.x, cell.y, cell.w, cell.h, 12);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = palette.cardLine;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      setFont(ctx, 19, 500);
      ctx.fillStyle = palette.cardMuted;
      ctx.textAlign = 'center';
      ctx.fillText('空位', cell.x + cell.w / 2, cell.y + cell.h / 2 + 7);
      continue;
    }

    ctx.fillStyle = player.isFemale ? palette.cellFemale : palette.cellFill;
    roundedRect(ctx, cell.x, cell.y, cell.w, cell.h, 12);
    ctx.fill();

    if (player.isFemale) {
      ctx.strokeStyle = palette.cellFemaleLine;
      ctx.lineWidth = 1.2;
      roundedRect(ctx, cell.x, cell.y, cell.w, cell.h, 12);
      ctx.stroke();
    }

    setFont(ctx, 18, 600);
    ctx.fillStyle = palette.cardMuted;
    ctx.textAlign = 'left';
    ctx.fillText(
      String(index + 1).padStart(2, '0'),
      cell.x + 12,
      cell.y + cell.h / 2 + 6,
    );

    const nameX = cell.x + (card.columns === 3 ? 44 : 40);
    const roseSpace = showRoseBadge(player.name, player.isFemale) ? 26 : 0;
    const nameMax = cell.w - (nameX - cell.x) - 10 - roseSpace;
    const name = fitName(ctx, player.name, nameMax);

    setFont(ctx, name.size, 700);
    ctx.fillStyle = palette.cardText;
    const baseline = cell.y + cell.h / 2 + name.size * 0.35;
    ctx.fillText(name.text, nameX, baseline);
    const nameWidth = ctx.measureText(name.text).width;

    if (showRoseBadge(player.name, player.isFemale)) {
      drawRose(ctx, palette, nameX + nameWidth + 4, baseline - 1, 21);
    }
  }
}

function drawWaitlist(
  ctx: PosterCtx,
  data: PosterData,
  layout: PosterLayout,
  palette: PosterPalette,
): void {
  const waitlist = layout.waitlist;
  if (!waitlist || data.waitlist.length === 0) return;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = palette.cardFill;
  roundedRect(ctx, waitlist.x, waitlist.y, waitlist.w, waitlist.h, 22);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = palette.accent;
  roundedRect(ctx, waitlist.x + 24, waitlist.y + 24, 8, 30, 4);
  ctx.fill();

  setFont(ctx, 32, 800);
  ctx.fillStyle = palette.cardText;
  ctx.textAlign = 'left';
  ctx.fillText('后补名单', waitlist.x + 46, waitlist.y + 48);

  setFont(ctx, 24, 600);
  ctx.fillStyle = palette.cardMuted;
  ctx.textAlign = 'right';
  ctx.fillText(
    `${data.waitlist.length} 人`,
    waitlist.x + waitlist.w - 24,
    waitlist.y + 46,
  );

  data.waitlist.forEach((player, index) => {
    const cell = waitlist.cells[index];
    if (!cell) return;

    ctx.fillStyle = player.isFemale ? palette.cellFemale : palette.cellFill;
    roundedRect(ctx, cell.x, cell.y, cell.w, cell.h, 9);
    ctx.fill();

    if (player.isFemale) {
      ctx.strokeStyle = palette.cellFemaleLine;
      ctx.lineWidth = 1.2;
      roundedRect(ctx, cell.x, cell.y, cell.w, cell.h, 9);
      ctx.stroke();
    }

    setFont(ctx, 15, 600);
    ctx.fillStyle = palette.cardMuted;
    ctx.textAlign = 'left';
    ctx.fillText(
      String(index + 1).padStart(2, '0'),
      cell.x + 10,
      cell.y + cell.h / 2 + 5,
    );

    const nameX = cell.x + 34;
    const roseSpace = showRoseBadge(player.name, player.isFemale) ? 19 : 0;
    const nameMax = cell.w - 44 - roseSpace;
    const name = fitName(ctx, player.name, nameMax);
    setFont(ctx, Math.min(name.size, 25), 700);
    ctx.fillStyle = palette.cardText;
    const baseline = cell.y + cell.h / 2 + Math.min(name.size, 25) * 0.34;
    ctx.fillText(name.text, nameX, baseline);

    if (showRoseBadge(player.name, player.isFemale)) {
      drawRose(ctx, palette, nameX + ctx.measureText(name.text).width + 3, baseline - 1, 17);
    }
  });
}

function drawNotice(
  ctx: PosterCtx,
  data: PosterData,
  layout: PosterLayout,
  palette: PosterPalette,
): void {
  const notice = layout.notice;
  const text =
    data.notice.trim().replace(/\s+/g, ' ') ||
    '两上两下，合理串场，不允许打架，停车免费。';

  ctx.fillStyle = palette.noticeFill;
  roundedRect(ctx, notice.x, notice.y, notice.w, notice.h, 20);
  ctx.fill();

  ctx.strokeStyle = palette.noticeLine;
  ctx.lineWidth = 1.5;
  roundedRect(ctx, notice.x, notice.y, notice.w, notice.h, 20);
  ctx.stroke();

  ctx.fillStyle = palette.bgMid;
  roundedRect(ctx, notice.x + 24, notice.y + 26, 6, 26, 3);
  ctx.fill();

  setFont(ctx, 19, 800);
  ctx.fillStyle = palette.cardMuted;
  ctx.textAlign = 'left';
  ctx.fillText('球局提示', notice.x + 44, notice.y + 45);

  setFont(ctx, 26, 600);
  ctx.fillStyle = palette.cardText;
  const lines = wrapChars(ctx, text, notice.w - 68, 2).lines;
  lines.forEach((line, index) => {
    ctx.fillText(line, notice.x + 44, notice.y + 76 + index * 30);
  });
}

function drawFooter(
  ctx: PosterCtx,
  data: PosterData,
  layout: PosterLayout,
  palette: PosterPalette,
): void {
  const { footer, padding, width } = layout;

  ctx.strokeStyle = palette.bgLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding, footer.dividerY);
  ctx.lineTo(width - padding, footer.dividerY);
  ctx.stroke();

  const waitlistText =
    data.waitlist.length > 0
      ? `后补 ${data.waitlist.length} 人`
      : `每组 ${data.capacity} 人`;

  setFont(ctx, 29, 600);
  ctx.fillStyle = palette.onBgMuted;
  ctx.textAlign = 'left';
  ctx.fillText(
    `共 ${data.totalPlayers} 人 · ${data.groups.length} 场 · ${waitlistText}`,
    padding,
    footer.statsY,
  );

  setFont(ctx, 27, 600);
  const femaleText = `女生 ${data.femaleCount} 人`;
  const femaleWidth = ctx.measureText(femaleText).width;
  const roseSize = 24;
  setFont(ctx, roseSize, 400, EMOJI_FONT);
  const roseWidth = ctx.measureText('🌹').width;
  const right = width - padding;
  drawRose(ctx, palette, right - femaleWidth - roseWidth - 4, footer.statsY - 1, roseSize);
  setFont(ctx, 27, 600);
  ctx.fillStyle = palette.onBgMuted;
  ctx.textAlign = 'left';
  ctx.fillText(femaleText, right - femaleWidth, footer.statsY);

  setFont(ctx, 18, 600);
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.55;
  ctx.fillText('SHUTTLE SIX · 羽球分组', padding, footer.brandY);
  ctx.globalAlpha = 1;

  setFont(ctx, 18, 500);
  ctx.fillStyle = palette.onBgFaint;
  ctx.textAlign = 'right';
  ctx.fillText(formatNumericCN(data.date) || '', width - padding, footer.brandY);
}

/**
 * 海报渲染入口。
 *
 * 小程序 Canvas 2D 的 ctx 与 Web 标准实现基本一致，
 * 因此这里不再持有 canvas 元素，只接收已就绪的绘图上下文，
 * 由调用方负责创建节点、设置宽高。
 */
export function renderPoster(
  ctx: PosterCtx,
  data: PosterData,
  layout: PosterLayout,
): void {
  // 主题只影响海报，页面 UI 保持绿色品牌色不变
  const palette = getTheme(data.themeId);

  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = 'alphabetic';
  drawBackground(ctx, layout, palette);
  drawHeader(ctx, data, layout, palette);

  data.groups.forEach((group, index) => {
    drawCard(ctx, group, layout, index, data.capacity, palette);
  });

  drawWaitlist(ctx, data, layout, palette);
  drawNotice(ctx, data, layout, palette);
  drawFooter(ctx, data, layout, palette);
}
