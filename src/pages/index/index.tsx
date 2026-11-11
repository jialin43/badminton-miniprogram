import { useCallback, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppState } from '@/state/useAppState';
import type { Step } from '@/types';
import { EventSettingsSheet } from '@/components/EventSettingsSheet';
import { GroupStep } from '@/components/GroupStep';
import { ImportStep } from '@/components/ImportStep';
import { PosterStep } from '@/components/PosterStep';
import { ShuttleIcon } from '@/components/Icon';
import { useShare } from '@/hooks/useShare';
import './index.scss';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: '导入' },
  { id: 2, label: '分组' },
  { id: 3, label: '海报' },
];

export default function Index() {
  const { state, dispatch, restoredAt, dismissRestore, reset } = useAppState();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      <View className="hero">
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

        <Text className="hero-title">
          {state.step === 1
            ? '粘一粘识别名单'
            : state.step === 2
              ? '点一点分好场次'
              : '存一存发到群里'}
        </Text>
        <Text className="hero-sub">
          {state.step === 1
            ? '粘贴微信接龙，自动找出昵称和女生标记'
            : state.step === 2
              ? '每场满 6 人，余下自动进后补；点成员可移动或互换'
              : '一键生成 1080px 海报，保存到相册或直接发群'}
        </Text>

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
        />
      ) : null}

      {state.step === 3 ? (
        <PosterStep
          state={state}
          onBack={() => goStep(2)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}

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
