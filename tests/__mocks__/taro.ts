/** 测试用的 Taro Storage 内存实现 */
const store = new Map<string, unknown>();

const Taro = {
  setStorageSync(key: string, value: unknown) {
    store.set(key, value);
  },
  getStorageSync(key: string) {
    return store.has(key) ? store.get(key) : '';
  },
  removeStorageSync(key: string) {
    store.delete(key);
  },
  __reset() {
    store.clear();
  },
};

export default Taro;
export const { setStorageSync, getStorageSync, removeStorageSync } = Taro;
