import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppState } from '@/state/useAppState';
import type { Step } from '@/types';
import { EventSettingsSheet } from '@/components/EventSettingsSheet';
import { GroupStep } from '@/components/GroupStep';
import { ImportStep } from '@/components/ImportStep';
import { PosterStep } from '@/components/PosterStep';
import { ShuttleIcon } from '@/components/Icon';
import { useShare } from '@/hooks/useShare';
import { useCapsuleMetrics } from '@/hooks/useCapsuleMetrics';
import './index.scss';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: '导入' },
  { id: 2, label: '分组' },
  { id: 3, label: '海报' },
];

export default function Index() {
  const { state, dispatch, restoredAt, dismissRestore, reset } = useAppState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 拖拽期间关掉列表滚动，否则手指一移动整块列表跟着滚，落点判定会漂
  const [dragging, setDragging] = useState(false);

  // 小程序右上角胶囊的实际位置：hero 要按它让出顶部空间，
  // 否则 STEP 标签会被系统胶囊压住。
  const capsule = useCapsuleMetrics();

  // 注册右上角菜单的「转发给好友 / 分享到朋友圈」
  useShare(state);

  const goStep = useCallback(
    (step: Step) => {
      // 跨步跳转交给 reducer 做可达性校验
      dispatch({ type: 'SET_STEP', step });
    },
    [dispatch],
  );

  const handleClearDraft = useCallback(async () => {
    const res = await Taro.showModal({
      title: '清空全部数据？',
      content: '接龙原文、名单、分组和活动信息都会被删除，且无法恢复。',
      confirmText: '清空',
      confirmColor: '#c9484d',
    });
    if (res.confirm) {
      reset();
      Taro.showToast({ title: '已清空', icon: 'none' });
    }
  }, [reset]);

  return (
    <View className="page">
      {/*
       * 分组页把 hero 收成紧凑条：列表要占满剩余高度，
       * hero 保持原尺寸会挤掉一半可视区，拖拽时很难看到目标场次。
       */}
      <View
        className={`hero ${state.step === 2 ? 'hero--compact' : ''}`}
        style={{
          /*
           * 顶部内边距直接算成具体 px 写进行内样式。
           *
           * 不用 CSS 变量 + calc() 的原因：
           * 1. Taro 的 postcss 会把 calc() 里的 px 字面量转成 rpx，
           *    和 JS 注入的 px 混算就对不上了；
           * 2. 微信 WXSS 对 var() 参与 calc() 的兼容性在旧基础库上不稳。
           * 直接给最终值最省心：胶囊底边 + 呼吸空间。
           */
          paddingTop: `${capsule.top + capsule.height + (state.step === 2 ? 6 : 8)}px`,
        }}
      >
        <View className="hero-top">
          <View className="brand">
            <View className="brand-mark">
              <ShuttleIcon size={40} />
            </View>
            <View>
              <Text className="brand-name">羽六</Text>
              <Text className="brand-sub">SHUTTLE SIX</Text>
            </View>
          </View>
          <Text className="step-chip">STEP 0{state.step}</Text>
        </View>

        {state.step !== 2 ? (
          <>
            <Text className="hero-title">
              {state.step === 1 ? '粘一粘识别名单' : '存一存发到群里'}
            </Text>
            <Text className="hero-sub">
              {state.step === 1
                ? '粘贴微信接龙，自动找出昵称和女生标记'
                : '一键生成 1080px 海报，保存到相册或直接发群'}
            </Text>
          </>
        ) : null}

        <View className="steps">
          {STEPS.map((item) => (
            <View
              key={item.id}
              className={`step-item ${state.step === item.id ? 'is-active' : ''} ${
                state.step > item.id ? 'is-done' : ''
              }`}
              onClick={() => goStep(item.id)}
            >
              <View className="step-dot">
                <Text className="step-dot__text">
                  {state.step > item.id ? '✓' : item.id}
                </Text>
              </View>
              <Text className="step-label">{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {restoredAt ? (
        <View className="restore-bar" onClick={dismissRestore}>
          <Text className="restore-bar__text">已恢复上次的编辑内容</Text>
          <Text className="restore-bar__close">知道了</Text>
        </View>
      ) : null}

      {/* 只在列表区滚动：hero 和 ActionBar 固定，页面本身不再有滚动条 */}
      <ScrollView
        className="page-scroll"
        scrollY={!dragging}
        scrollWithAnimation={false}
        enhanced
        showScrollbar={false}
      >
        {state.step === 1 ? (
          <ImportStep
            state={state}
            dispatch={dispatch}
            onNext={() => goStep(2)}
            onClearDraft={() => void handleClearDraft()}
          />
        ) : null}

        {state.step === 2 ? (
          <GroupStep
            state={state}
            dispatch={dispatch}
            onBack={() => goStep(1)}
            onNext={() => goStep(3)}
            onOpenSettings={() => setSettingsOpen(true)}
            onDraggingChange={setDragging}
          />
        ) : null}

        {state.step === 3 ? (
          <PosterStep
            state={state}
            dispatch={dispatch}
            onBack={() => goStep(2)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : null}
      </ScrollView>

      <EventSettingsSheet
        open={settingsOpen}
        event={state.event}
        groupCount={state.groups.length}
        onClose={() => setSettingsOpen(false)}
        onSave={(event) => dispatch({ type: 'SET_EVENT', event })}
      />
    </View>
  );
}
