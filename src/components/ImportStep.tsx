import { useState } from 'react';
import { Button, Input, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { AppState } from '@/types';
import type { AppAction } from '@/state/reducer';
import { extractHints, nameKey, parseSignup } from '@/lib/parser';
import { groupCountFor } from '@/lib/grouping';
import { SAMPLE_TEXT } from '@/lib/sample';
import { ActionBar } from './ActionBar';
import { useConfirm, useToast } from './Feedback';
import { Icon } from './Icon';
import { RosterRow } from './RosterRow';

interface ImportStepProps {
  state: AppState;
  dispatch: (action: AppAction) => void;
  onNext: () => void;
  onClearDraft: () => void;
}

export function ImportStep({
  state,
  dispatch,
  onNext,
  onClearDraft,
}: ImportStepProps) {
  const notify = useToast();
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const femaleCount = state.players.filter((player) => player.isFemale).length;
  const groupsNeeded = groupCountFor(state.players.length, state.capacity);
  const report = state.report;

  const parseText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('请先粘贴微信接龙内容，或点击“示例”体验。');
      return;
    }

    const result = parseSignup(trimmed);
    if (result.players.length === 0) {
      setError('没有识别到昵称。请检查是否包含编号或有效名单，也可以手动添加。');
      return;
    }

    if (state.players.length > 0) {
      const ok = await confirm({
        title: '重新识别名单？',
        message: '这会用新识别结果覆盖当前名单和已有分组。',
        confirmLabel: '重新识别',
      });
      if (!ok) return;
    }

    dispatch({
      type: 'SET_ROSTER',
      drafts: result.players,
      report: {
        mode: result.mode,
        duplicates: result.duplicates,
        ignored: result.ignored,
        parsedAt: Date.now(),
      },
      hints: extractHints(trimmed),
    });

    setError(null);
    setNewName('');

    const female = result.players.filter((player) => player.isFemale).length;
    notify(`识别到 ${result.players.length} 人 · ${female} 位女生`);
  };

  const handleSample = async () => {
    dispatch({ type: 'SET_RAW_TEXT', text: SAMPLE_TEXT });
    await parseText(SAMPLE_TEXT);
  };

  const handlePaste = async () => {
    try {
      const { data } = await Taro.getClipboardData();
      const res = (data ?? '').trim();
      if (!res) {
        notify('剪贴板里没有文本');
        return;
      }
      dispatch({ type: 'SET_RAW_TEXT', text: res });
      setError(null);
      notify('已填入，点击“识别名单”即可');
    } catch {
      notify('读取剪贴板失败，请手动粘贴');
    }
  };

  const handleAdd = () => {
    const raw = newName.trim();
    const isFemale = raw.includes('🌹');
    const name = raw.replace(/🌹/gu, '').trim();
    if (!name) {
      notify('请输入成员昵称');
      return;
    }
    if (
      state.players.some(
        (player) =>
          nameKey(player.name) === nameKey(name) &&
          player.isFemale === isFemale,
      )
    ) {
      notify('同名且性别标记相同的成员已经在名单里了');
      return;
    }
    if (state.players.length >= 100) {
      notify('单次最多 100 人');
      return;
    }

    dispatch({ type: 'ADD_PLAYER', name, isFemale });
    setNewName('');
    notify(`已添加 ${name}${isFemale ? ' 🌹' : ''}`);
  };

  const handleNext = () => {
    if (state.players.length === 0) {
      notify('先识别或添加至少 1 位成员');
      return;
    }
    dispatch({ type: 'SET_STEP', step: 2 });
    onNext();
  };

  return (
    <View className="page-content page-content--with-bar">
      <View className="card input-card">
        <View className="panel-head">
          <View>
            <Text className="section-kicker">PASTE THE CHAIN</Text>
            <Text className="panel-title">微信接龙原文</Text>
          </View>
          <Button className="btn btn--sm btn--soft" onClick={() => void handlePaste()}>
            <Icon name="copy" size={20} />
            粘贴
          </Button>
        </View>

        <Textarea
          className={`chain-input ${error ? 'has-error' : ''}`}
          value={state.rawText}
          maxlength={20000}
          placeholder={`#接龙\n10月29日 周四 19:00-21:00 羽毛球\n地点：星光羽毛球馆\n1. 阿哲\n2. 小满🌹\n3、Momo`}
          onInput={(event) => {
            dispatch({ type: 'SET_RAW_TEXT', text: event.detail.value });
            if (error) setError(null);
          }}
        />

        <View className="input-meta">
          <Text className="input-meta__count">
            {state.rawText.length} / 20000
          </Text>
          <Text className="input-meta__hint">🌹 自动标记女生</Text>
        </View>

        {error ? (
          <View className="inline-alert">
            <Icon name="alert" size={22} color="#c9484d" />
            <Text className="inline-alert__text">{error}</Text>
          </View>
        ) : null}

        <View className="input-actions">
          <Button
            className="btn btn--dark btn--block"
            onClick={() => void parseText(state.rawText)}
          >
            <Icon name="sparkle" size={24} />
            识别名单
          </Button>
          <Button
            className="btn btn--soft btn--block"
            onClick={() => void handleSample()}
          >
            用示例看看
          </Button>
        </View>
      </View>

      {state.players.length > 0 ? (
        <>
          <View className="stats">
            <View className="stat">
              <Text className="stat__value">{state.players.length}</Text>
              <Text className="stat__label">已识别</Text>
            </View>
            <View className="stat">
              <Text className="stat__value">{femaleCount}</Text>
              <Text className="stat__label">女生</Text>
            </View>
            <View className="stat">
              <Text className="stat__value">{groupsNeeded}</Text>
              <Text className="stat__label">预计场次</Text>
            </View>
          </View>

          <View className="card roster-card">
            <View className="panel-head">
              <View>
                <Text className="section-kicker">CHECK THE ROSTER</Text>
                <Text className="panel-title">名单校对</Text>
              </View>
              <Text className="badge">
                {report?.mode === 'plain' ? '普通名单' : '按编号识别'}
              </Text>
            </View>

            <Text className="panel-note">
              点昵称可修改，点“男/女”切换标记，点“删”移除。
            </Text>

            <View className="roster-list">
              {state.players.map((player, index) => (
                <RosterRow
                  key={player.id}
                  player={player}
                  index={index}
                  onRename={(id, name) =>
                    dispatch({ type: 'UPDATE_PLAYER', id, name })
                  }
                  onToggleFemale={(id) =>
                    dispatch({ type: 'TOGGLE_FEMALE', id })
                  }
                  onRemove={(id) => dispatch({ type: 'REMOVE_PLAYER', id })}
                />
              ))}
            </View>

            <View className="add-row">
              <View className="add-input-wrap">
                <Text className="add-input__prefix">+</Text>
                <Input
                  className="add-input"
                  value={newName}
                  maxlength={30}
                  placeholder="手动添加成员昵称"
                  confirmType="done"
                  onInput={(event) => setNewName(event.detail.value)}
                  onConfirm={handleAdd}
                />
              </View>
              <Button className="btn btn--sm btn--dark" onClick={handleAdd}>
                添加
              </Button>
            </View>

            {report?.duplicates.length ? (
              <View className="report-box report-box--warn">
                <Text className="report-box__title">
                  已跳过 {report.duplicates.length} 个重复昵称
                </Text>
                {report.duplicates.slice(0, 6).map((entry) => (
                  <Text
                    className="report-line"
                    key={`${entry.name}-${entry.lines.join('-')}`}
                  >
                    {entry.name} · 第 {entry.lines.join('、')} 行
                  </Text>
                ))}
              </View>
            ) : null}

            {report?.ignored.length ? (
              <View className="report-box report-box--muted">
                <Text className="report-box__title">
                  有 {report.ignored.length} 行未识别
                </Text>
                {report.ignored.slice(0, 6).map((entry) => (
                  <Text className="report-line" key={`${entry.line}-${entry.text}`}>
                    L{entry.line} · {entry.text} · {entry.reason}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>

          <Button
            className="btn btn--ghost btn--block danger-action"
            onClick={onClearDraft}
          >
            <Icon name="trash" size={20} />
            清空全部数据
          </Button>
        </>
      ) : (
        <View className="empty">
          <Text className="empty__title">三步搞定一张分组海报</Text>
          <Text className="empty__text">
            粘贴接龙 → 自动分好组 → 保存海报。所有数据只留在你的手机里。
          </Text>
        </View>
      )}

      <ActionBar
        primaryLabel="下一步：分组"
        onPrimary={handleNext}
        primaryDisabled={state.players.length === 0}
        hint={
          state.players.length > 0
            ? `${state.players.length} 人 · 已按顺序分好组`
            : '识别名单后即可开始分组'
        }
      />
    </View>
  );
}
