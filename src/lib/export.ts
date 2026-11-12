import Taro from '@tarojs/taro';

/** 海报文件名（不含扩展名，小程序保存相册时用不到扩展名）。 */
export function posterFileName(date: string): string {
  return `羽毛球分组_${date || '未命名'}.png`;
}

export interface SaveResult {
  ok: boolean;
  /** 用户拒绝授权时为 denied，便于界面给出针对性提示 */
  reason?: 'denied' | 'failed';
}

/**
 * Canvas 2D 节点。type="2d" 的画布导出时必须把这个实例传回
 * canvasToTempFilePath，只给 canvasId 字符串微信会找不到画布。
 */
export interface CanvasNode {
  width: number;
  height: number;
  getContext: (type: '2d') => CanvasRenderingContext2D | null;
}

/**
 * 保存前主动申请相册权限。
 *
 * 微信里 saveImageToPhotosAlbum 本身会按需弹授权框，但存在两个坑：
 * - 曾经拒绝过就不再有弹窗，直接 fail 且 errMsg 可能不含 auth 字样；
 * - 部分机型/基础库在直接调用 save 时不弹框。
 * 因此先查 getSetting，未决状态才调用 authorize 主动弹框。
 *
 * 返回值：granted 表示已授权（或本就不需要），denied 表示用户明确拒绝，
 * skip 表示授权流程本身不可用（交给后续 save 自行尝试）。
 */
export type AuthorizeResult = 'granted' | 'denied' | 'skip';

export async function ensureAlbumPermission(): Promise<AuthorizeResult> {
  try {
    const setting = await Taro.getSetting();
    const current = setting.authSetting['scope.writePhotosAlbum'];

    if (current === true) return 'granted';
    if (current === false) return 'denied';

    // undefined 表示尚未决定 → 主动申请
    await Taro.authorize({ scope: 'scope.writePhotosAlbum' });
    return 'granted';
  } catch (error) {
    const message = String((error as { errMsg?: string })?.errMsg ?? error);
    if (message.includes('deny') || message.includes('cancel')) {
      return 'denied';
    }
    // 不支持 authorize 的环境：让 save 自己走按需授权
    return 'skip';
  }
}

/**
 * 把 canvas 导出成临时文件并存入相册。
 *
 * 小程序里 canvas 必须先 canvasToTempFilePath 拿到本地路径，
 * 再交给 saveImageToPhotosAlbum；首次会触发相册授权弹窗。
 */
export async function saveCanvasToAlbum(
  canvasId: string,
  node?: CanvasNode | null,
): Promise<SaveResult> {
  let tempFilePath = '';

  try {
    tempFilePath = await canvasToTempPath(canvasId, node);
  } catch (error) {
    console.warn('[export] canvasToTempFilePath failed', error);
    return { ok: false, reason: 'failed' };
  }

  if (!tempFilePath) return { ok: false, reason: 'failed' };

  const permission = await ensureAlbumPermission();
  if (permission === 'denied') return { ok: false, reason: 'denied' };

  try {
    await Taro.saveImageToPhotosAlbum({ filePath: tempFilePath });
    return { ok: true };
  } catch (error) {
    const message = String((error as { errMsg?: string })?.errMsg ?? error);
    // 用户点了“取消”或之前拒绝过授权
    if (
      message.includes('auth') ||
      message.includes('deny') ||
      message.includes('cancel')
    ) {
      return { ok: false, reason: 'denied' };
    }
    console.warn('[export] saveImageToPhotosAlbum failed', error);
    return { ok: false, reason: 'failed' };
  }
}

/**
 * 导出临时图片路径，供“预览大图 → 长按保存”的兜底流程使用。
 * 微信内长按图片保存是最稳的路径，不依赖相册授权。
 *
 * Canvas 2D 画布必须传 node（画布节点实例）：
 * 只传 canvasId 在 type="2d" 下会报 canvas is empty。
 */
export async function canvasToTempPath(
  canvasId: string,
  node?: CanvasNode | null,
): Promise<string> {
  // Canvas 2D 的节点实例类型由运行时提供，Taro 的 Canvas 类型声明更严格，
  // 这里按运行时实际入参传递，避免在组件里重复实现一份完整 Canvas 类型。
  const options = {
    canvasId,
    fileType: 'png' as const,
    quality: 1,
    ...(node ? { canvas: node } : {}),
  };

  const result = await Taro.canvasToTempFilePath(
    options as unknown as Parameters<typeof Taro.canvasToTempFilePath>[0],
  );

  return result.tempFilePath;
}

/** 打开系统预览，用户可以长按保存或转发给好友。 */
export async function previewPoster(filePath: string): Promise<void> {
  await Taro.previewImage({ urls: [filePath], current: filePath });
}

/**
 * 引导用户去设置页打开相册权限。
 * 用户第一次拒绝后，再次调用 saveImageToPhotosAlbum 不会弹窗，
 * 只能引导到设置页手动开启。
 */
export async function openAlbumSetting(): Promise<void> {
  try {
    const setting = await Taro.getSetting();
    if (setting.authSetting['scope.writePhotosAlbum'] === false) {
      await Taro.openSetting();
    }
  } catch {
    // 用户取消，忽略
  }
}
