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
 * 把 canvas 导出成临时文件并存入相册。
 *
 * 小程序里 canvas 必须先 canvasToTempFilePath 拿到本地路径，
 * 再交给 saveImageToPhotosAlbum；首次会触发相册授权弹窗。
 */
export async function saveCanvasToAlbum(canvasId: string): Promise<SaveResult> {
  let tempFilePath = '';

  try {
    tempFilePath = await canvasToTempPath(canvasId);
  } catch {
    return { ok: false, reason: 'failed' };
  }

  if (!tempFilePath) return { ok: false, reason: 'failed' };

  try {
    await Taro.saveImageToPhotosAlbum({ filePath: tempFilePath });
    return { ok: true };
  } catch (error) {
    const message = String((error as { errMsg?: string })?.errMsg ?? error);
    // 用户点了“取消”或之前拒绝过授权
    if (message.includes('auth') || message.includes('deny')) {
      return { ok: false, reason: 'denied' };
    }
    return { ok: false, reason: 'failed' };
  }
}

/**
 * 导出临时图片路径，供“预览大图 → 长按保存”的兜底流程使用。
 * 微信内长按图片保存是最稳的路径，不依赖相册授权。
 */
export async function canvasToTempPath(canvasId: string): Promise<string> {
  const result = await Taro.canvasToTempFilePath({
    canvasId,
    fileType: 'png',
    quality: 1,
  });

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
