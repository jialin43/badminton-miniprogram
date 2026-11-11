export default defineAppConfig({
  pages: ['pages/index/index'],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#0e2a1f',
    navigationBarTitleText: '羽六 · 分组海报',
    navigationBarTextStyle: 'white',
    backgroundColor: '#f3efe2',
  },
  permission: {
    'scope.writePhotosAlbum': {
      desc: '用于把分组海报保存到你的相册',
    },
  },
  requiredPrivateInfos: [],
});
