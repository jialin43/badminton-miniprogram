import { useCallback, useEffect, useReducer, useState } from 'react';
import { appReducer, createInitialState } from './reducer';
import type { AppAction } from './reducer';
import type { AppState } from '@/types';
import { clearSavedState, loadState, saveState } from '@/lib/storage';

interface Bootstrap {
  state: AppState;
  restoredAt: number | null;
}

/**
 * 启动时读取本地草稿。
 *
 * 只有真正有内容（名单、原文或分组）才提示“已恢复”，
 * 避免用户第一次打开就看到无意义的提示。
 */
function bootstrap(): Bootstrap {
  const saved = loadState();
  if (!saved) {
    return { state: createInitialState(), restoredAt: null };
  }

  const meaningful =
    saved.players.length > 0 ||
    saved.rawText.trim().length > 0 ||
    saved.groups.length > 0;

  return {
    state: saved,
    restoredAt: meaningful ? saved.updatedAt : null,
  };
}

export function useAppState() {
  const [initial] = useState<Bootstrap>(bootstrap);
  const [state, dispatch] = useReducer(appReducer, initial.state);
  const [restoredVisible, setRestoredVisible] = useState(
    initial.restoredAt !== null,
  );

  // 防抖写入，避免每次输入都触发一次同步写存储
  useEffect(() => {
    const timer = setTimeout(() => saveState(state), 300);
    return () => clearTimeout(timer);
  }, [state]);

  const dismissRestore = useCallback(() => setRestoredVisible(false), []);

  const reset = useCallback(() => {
    clearSavedState();
    dispatch({ type: 'RESET' });
    setRestoredVisible(false);
  }, []);

  return {
    state,
    dispatch: dispatch as (action: AppAction) => void,
    restoredAt: restoredVisible ? initial.restoredAt : null,
    dismissRestore,
    reset,
  };
}
