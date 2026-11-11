import { useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import type { AppState } from '@/types';

const SHARE_TITLE = '羽六 · 羽毛球接龙分组海报';
const SHARE_PATH = '/pages/index/index';

interface SharePayload {
  title: string;
  path: string;
  imageUrl?: string;
}

/**
 * 生成分享文案。
 *
 * 有分组时把场次信息写进标题，好友看到就知道是什么局；
 * 没有内容时用通用文案，避免分享出去一片空白。
 */
export function buildSharePayload(
  state: AppState,
  posterTempPath?: string | null,
): SharePayload {
  const payload: SharePayload = { title: SHARE_TITLE, path: SHARE_PATH };

  const fullGroups = state.groups.filter(
    (group) => group.playerIds.length >= state.capacity,
  ).length;

  if (fullGroups > 0) {
    const venue = state.event.venue.trim();
    const parts = [
      `${state.players.length} 人`,
      `${fullGroups} 场`,
      venue || null,
    ].filter((item): item is string => Boolean(item));

    payload.title = `羽毛球分组已排好 · ${parts.join(' · ')}`;
  }

  // 海报生成后带上图片，好友看到的是直观的分享卡片
  if (posterTempPath) payload.imageUrl = posterTempPath;

  return payload;
}

/**
 * 注册分享能力。
 *
 * useShareAppMessage 的回调在分享瞬间同步调用，
 * 所以这里只做纯函数计算，不触发异步。
 */
export function useShare(
  state: AppState,
  posterTempPath?: string | null,
): void {
  useShareAppMessage(() => buildSharePayload(state, posterTempPath));
  useShareTimeline(() => buildSharePayload(state, posterTempPath));
}
