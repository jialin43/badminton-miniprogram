/**
 * 海报主题调色板。
 *
 * 页面 UI 保持绿色品牌色不变，只有生成的海报换风格。
 * 所以这里只定义海报用到的颜色，不去动 app.scss 的变量。
 *
 * 命名按「用途」而不是「颜色」：切换主题时只换值，渲染代码不用改，
 * 也不会再出现某个地方漏改导致风格不统一。
 */
export interface PosterPalette {
  id: ThemeId;
  name: string;
  /** 一句话描述，用于界面上的副标题 */
  hint: string;

  /** 顶部主题色，用于选择器上的圆形色块 */
  swatch: string;

  /* —— 背景 —— */
  /** 背景渐变的三个停靠色 */
  bgStart: string;
  bgMid: string;
  bgEnd: string;
  /** 背景装饰线的颜色（低透明度强调色） */
  bgLine: string;

  /* —— 头部与页脚的文字 —— */
  /** 主文字：标题、大号数字 */
  onBg: string;
  /** 次级文字 */
  onBgMuted: string;
  /** 更弱的文字：说明、脚注 */
  onBgFaint: string;
  /** 强调色：eyebrow、分隔线、品牌落款 */
  accent: string;
  /** 强调色的弱化版，用于描边 */
  accentSoft: string;
  /** 强调色的半透明版，用于大面积装饰 */
  accentFaint: string;

  /* —— 卡片 —— */
  /** 卡片底色 */
  cardFill: string;
  /** 卡片主文字 */
  cardText: string;
  /** 卡片次级文字：序号、人数 */
  cardMuted: string;
  /** 卡片描边 */
  cardLine: string;

  /* —— 成员格子 —— */
  /** 默认格子底色 */
  cellFill: string;
  /** 女生格子底色 */
  cellFemale: string;
  /** 女生格子描边 */
  cellFemaleLine: string;

  /* —— 提示条 —— */
  noticeFill: string;
  noticeLine: string;

  /* —— 女生标记 —— */
  /** 玫瑰兜底用的单色 */
  rose: string;
}

export type ThemeId =
  | 'forest'
  | 'midnight'
  | 'ember'
  | 'dusk'
  | 'sakura'
  | 'glacier';

export const POSTER_THEMES: PosterPalette[] = [
  {
    id: 'forest',
    name: '森野绿',
    hint: '经典羽球绿，最百搭',
    swatch: '#d9f36b',
    bgStart: '#0b241a',
    bgMid: '#0e2a1f',
    bgEnd: '#14382a',
    bgLine: 'rgba(217, 243, 107, 0.07)',
    onBg: '#f7f3e6',
    onBgMuted: 'rgba(247, 243, 230, 0.68)',
    onBgFaint: 'rgba(247, 243, 230, 0.44)',
    accent: '#d9f36b',
    accentSoft: 'rgba(217, 243, 107, 0.28)',
    accentFaint: 'rgba(217, 243, 107, 0.12)',
    cardFill: '#f7f3e6',
    cardText: '#14271f',
    cardMuted: '#7c847a',
    cardLine: 'rgba(14, 42, 31, 0.12)',
    cellFill: '#ece7d7',
    cellFemale: '#fad9dc',
    cellFemaleLine: 'rgba(199, 96, 112, 0.42)',
    noticeFill: '#e9f2c8',
    noticeLine: 'rgba(155, 182, 52, 0.32)',
    rose: '#d94f73',
  },
  {
    id: 'midnight',
    name: '午夜蓝',
    hint: '冷静克制，适合正式局',
    swatch: '#7cc6ff',
    bgStart: '#0a1526',
    bgMid: '#0d1e33',
    bgEnd: '#12294a',
    bgLine: 'rgba(124, 198, 255, 0.07)',
    onBg: '#eef4fd',
    onBgMuted: 'rgba(238, 244, 253, 0.68)',
    onBgFaint: 'rgba(238, 244, 253, 0.44)',
    accent: '#7cc6ff',
    accentSoft: 'rgba(124, 198, 255, 0.3)',
    accentFaint: 'rgba(124, 198, 255, 0.12)',
    cardFill: '#f2f6fc',
    cardText: '#12233a',
    cardMuted: '#7186a0',
    cardLine: 'rgba(18, 35, 58, 0.12)',
    cellFill: '#e4ebf5',
    cellFemale: '#fadfe8',
    cellFemaleLine: 'rgba(190, 96, 130, 0.42)',
    noticeFill: '#dce9fb',
    noticeLine: 'rgba(90, 150, 220, 0.35)',
    rose: '#e0608c',
  },
  {
    id: 'ember',
    name: '暖魄橙',
    hint: '活力热度，周末场首选',
    swatch: '#ffb35c',
    bgStart: '#2a1206',
    bgMid: '#3a1a09',
    bgEnd: '#54260d',
    bgLine: 'rgba(255, 179, 92, 0.08)',
    onBg: '#fdeee0',
    onBgMuted: 'rgba(253, 238, 224, 0.7)',
    onBgFaint: 'rgba(253, 238, 224, 0.45)',
    accent: '#ffb35c',
    accentSoft: 'rgba(255, 179, 92, 0.32)',
    accentFaint: 'rgba(255, 179, 92, 0.13)',
    cardFill: '#fdf4ea',
    cardText: '#3a1d0a',
    cardMuted: '#9a7c62',
    cardLine: 'rgba(58, 29, 10, 0.12)',
    cellFill: '#f3e7d8',
    cellFemale: '#fadfdd',
    cellFemaleLine: 'rgba(198, 96, 92, 0.42)',
    noticeFill: '#fdeccf',
    noticeLine: 'rgba(214, 150, 60, 0.35)',
    rose: '#e0654f',
  },
  {
    id: 'dusk',
    name: '暮色紫',
    hint: '夜场气质，安静高级',
    swatch: '#c9a6ff',
    bgStart: '#1a0f2b',
    bgMid: '#251438',
    bgEnd: '#33204d',
    bgLine: 'rgba(201, 166, 255, 0.08)',
    onBg: '#f3ecfd',
    onBgMuted: 'rgba(243, 236, 253, 0.7)',
    onBgFaint: 'rgba(243, 236, 253, 0.45)',
    accent: '#c9a6ff',
    accentSoft: 'rgba(201, 166, 255, 0.32)',
    accentFaint: 'rgba(201, 166, 255, 0.13)',
    cardFill: '#f7f2fd',
    cardText: '#251438',
    cardMuted: '#8a7ba3',
    cardLine: 'rgba(37, 20, 56, 0.12)',
    cellFill: '#ebe3f7',
    cellFemale: '#f9dcea',
    cellFemaleLine: 'rgba(186, 100, 150, 0.42)',
    noticeFill: '#ece2fb',
    noticeLine: 'rgba(160, 120, 215, 0.35)',
    rose: '#cf5f9c',
  },
  {
    id: 'sakura',
    name: '樱粉',
    hint: '轻盈柔和，女生局友好',
    swatch: '#ff9ec0',
    bgStart: '#2b1220',
    bgMid: '#3b1a2c',
    bgEnd: '#53263c',
    bgLine: 'rgba(255, 158, 192, 0.09)',
    onBg: '#fdeef3',
    onBgMuted: 'rgba(253, 238, 243, 0.72)',
    onBgFaint: 'rgba(253, 238, 243, 0.46)',
    accent: '#ff9ec0',
    accentSoft: 'rgba(255, 158, 192, 0.34)',
    accentFaint: 'rgba(255, 158, 192, 0.14)',
    cardFill: '#fef5f8',
    cardText: '#3b1a2c',
    cardMuted: '#a37f90',
    cardLine: 'rgba(59, 26, 44, 0.12)',
    cellFill: '#f7e8ee',
    cellFemale: '#fcd9e4',
    cellFemaleLine: 'rgba(214, 110, 150, 0.42)',
    noticeFill: '#fde8f0',
    noticeLine: 'rgba(220, 130, 165, 0.35)',
    rose: '#e05e8e',
  },
  {
    id: 'glacier',
    name: '冰川青',
    hint: '清爽通透，夏天很搭',
    swatch: '#7fe3d4',
    bgStart: '#062022',
    bgMid: '#0a2d30',
    bgEnd: '#0e4247',
    bgLine: 'rgba(127, 227, 212, 0.08)',
    onBg: '#e8fbf8',
    onBgMuted: 'rgba(232, 251, 248, 0.7)',
    onBgFaint: 'rgba(232, 251, 248, 0.45)',
    accent: '#7fe3d4',
    accentSoft: 'rgba(127, 227, 212, 0.32)',
    accentFaint: 'rgba(127, 227, 212, 0.13)',
    cardFill: '#eefaf8',
    cardText: '#0a2d30',
    cardMuted: '#6f8f8c',
    cardLine: 'rgba(10, 45, 48, 0.12)',
    cellFill: '#ddf2ef',
    cellFemale: '#f6dde6',
    cellFemaleLine: 'rgba(190, 100, 140, 0.42)',
    noticeFill: '#d9f5ef',
    noticeLine: 'rgba(80, 180, 165, 0.35)',
    rose: '#dd6291',
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'forest';

export function getTheme(id: ThemeId | string | undefined): PosterPalette {
  return POSTER_THEMES.find((theme) => theme.id === id) ?? POSTER_THEMES[0]!;
}
