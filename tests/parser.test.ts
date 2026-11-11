import { describe, expect, it } from 'vitest';
import { extractHints, isMetaLine, nameKey, parseSignup } from '../src/lib/parser';

describe('parseSignup', () => {
  it('解析标准编号接龙，提取昵称、女生与重复项', () => {
    const input = `#接龙
10月29日 周四 19:00-21:00 羽毛球
地点：星光羽毛球馆
1. 阿哲
2. 小满🌹
3、Momo
4）大鹏🌹
5. 周予安
6. 阿哲`;

    const result = parseSignup(input);

    expect(result.mode).toBe('numbered');
    expect(result.players.map((player) => player.name)).toEqual([
      '阿哲',
      '小满',
      'Momo',
      '大鹏',
      '周予安',
    ]);
    expect(result.players.filter((player) => player.isFemale)).toHaveLength(2);
    expect(result.duplicates).toEqual([{ name: '阿哲', lines: [4, 9] }]);
    expect(result.ignored).toHaveLength(0);
  });

  it('兼容多种编号分隔符', () => {
    const result = parseSignup(`1、阿哲
2)小满🌹
3：Momo
4 大鹏
5. 周予安`);

    expect(result.players.map((player) => player.name)).toEqual([
      '阿哲',
      '小满',
      'Momo',
      '大鹏',
      '周予安',
    ]);
  });

  it('无编号时使用宽松模式，并过滤头部信息', () => {
    const result = parseSignup(`周五羽毛球
阿哲
小满🌹
Momo`);

    expect(result.mode).toBe('plain');
    expect(result.players.map((player) => player.name)).toEqual([
      '阿哲',
      '小满',
      'Momo',
    ]);
  });

  it('日期、时间、场馆等行不会进入名单', () => {
    const result = parseSignup(`10.29 周四 19:00-21:00
19:00-21:00 羽毛球
地点：星光羽毛球馆
费用：AA
1. 阿哲
2. 小满🌹`);

    expect(result.players).toHaveLength(2);
    expect(result.ignored).toHaveLength(0);
  });

  it('严格模式下未编号的普通行会进入未识别列表', () => {
    const result = parseSignup(`1. 阿哲
2. 小满🌹
候补：大鹏`);

    expect(result.players).toHaveLength(2);
    expect(result.ignored).toHaveLength(1);
    expect(result.ignored[0]?.reason).toBe('未使用编号');
  });

  it('去掉玫瑰但保留其他 Emoji 和英文内部空格', () => {
    const result = parseSignup(`1. 小满🌹🌹
2. John Doe
3. Momo 🏸`);

    expect(result.players.map((player) => player.name)).toEqual([
      '小满',
      'John Doe',
      'Momo 🏸',
    ]);
    expect(result.players[0]?.isFemale).toBe(true);
    expect(result.players[2]?.isFemale).toBe(false);
  });

  it('按归一化昵称去重，保留首次出现的顺序', () => {
    const result = parseSignup(`1. Kai
2. kai
3. K ai`);

    expect(result.players).toHaveLength(1);
    expect(result.players[0]?.name).toBe('Kai');
    expect(result.duplicates[0]?.lines).toEqual([1, 2, 3]);
  });

  it('同名但 🌹 不同视为两位报名者', () => {
    const result = parseSignup(`1. 小满🌹
2. 小满
3. 小满`);

    expect(result.players.map((player) => player.name)).toEqual(['小满', '小满']);
    expect(result.players.map((player) => player.isFemale)).toEqual([true, false]);
    expect(result.duplicates).toEqual([{ name: '小满', lines: [2, 3] }]);
  });

  it('编号行中的“周一”不会被当成日期头部', () => {
    const result = parseSignup(`1. 周一
2. 周二`);

    expect(result.players.map((player) => player.name)).toEqual(['周一', '周二']);
  });

  it('空输入和只有头部的文本返回空名单', () => {
    expect(parseSignup('').players).toHaveLength(0);
    expect(
      parseSignup(`#接龙
10月29日 周四
地点：星光羽毛球馆`).players,
    ).toHaveLength(0);
  });

  it('纯表情昵称也会被识别，纯符号和超长昵称仍会忽略', () => {
    const result = parseSignup(`1. 🌹
2. 🏸
3. 🐱🐱
4. ---
5. ${'很长的昵称'.repeat(10)}`);

    expect(result.players.map((player) => player.name)).toEqual([
      '🌹',
      '🏸',
      '🐱🐱',
    ]);
    expect(result.players[0]?.isFemale).toBe(true);
    expect(result.ignored).toHaveLength(2);
  });

  it('纯表情接龙各自算一个人，不会被当成重复吞掉', () => {
    const result = parseSignup(`1. 🌹
2. 🌹
3. 👍
4. 👍
5. 🏸🏸`);

    expect(result.players.map((player) => player.name)).toEqual([
      '🌹',
      '🌹',
      '👍',
      '👍',
      '🏸🏸',
    ]);
    expect(result.duplicates).toHaveLength(0);
    expect(result.players[0]?.isFemale).toBe(true);
  });

  it('表情加暗号的接龙也能识别，+1 会补成可读昵称', () => {
    const result = parseSignup(`1. 🎾
2. ＋1
3. 👌🏻
4. 加一`);

    expect(result.players.map((player) => player.name)).toEqual([
      '🎾',
      '表情接龙',
      '👌🏻',
      '表情接龙',
    ]);
    expect(result.duplicates).toHaveLength(0);
  });

  it('文字昵称仍按 nameKey 去重，不受纯表情放行影响', () => {
    const result = parseSignup(`1. 阿哲
2. 阿哲
3. 👍`);

    expect(result.players.map((player) => player.name)).toEqual(['阿哲', '👍']);
    expect(result.duplicates).toEqual([{ name: '阿哲', lines: [1, 2] }]);
  });

  it('以“时间/地点”等词开头的昵称不会被当成头部信息丢掉', () => {
    const result = parseSignup(`1. 时间管理
2. 地点阿哲
3. 人均30
4. 费用AA`);

    expect(result.players.map((player) => player.name)).toEqual([
      '时间管理',
      '地点阿哲',
      '人均30',
      '费用AA',
    ]);
  });

  it('带分隔符的元信息行仍然会被过滤', () => {
    const result = parseSignup(`时间：19:00-21:00
地点：星光羽毛球馆
费用：AA
1. 阿哲`);

    expect(result.players.map((player) => player.name)).toEqual(['阿哲']);
    expect(result.ignored).toHaveLength(0);
  });

  it('超过 100 人时截断并给出提示', () => {
    const lines = Array.from({ length: 105 }, (_, index) => `${index + 1}. 球友${index + 1}`);
    const result = parseSignup(lines.join('\n'));

    expect(result.players).toHaveLength(100);
    expect(result.ignored.some((entry) => entry.reason.includes('上限'))).toBe(true);
  });

  it('标题里的 10.29 不会被误识别为第 10 号球员', () => {
    const result = parseSignup(`10.29 周四 羽毛球
1. 阿哲
2. 小满🌹`);

    expect(result.players.map((player) => player.name)).toEqual(['阿哲', '小满']);
  });
});

describe('parser helpers', () => {
  it('isMetaLine 识别常见头部信息', () => {
    expect(isMetaLine('#接龙')).toBe(true);
    expect(isMetaLine('时间：19:00-21:00')).toBe(true);
    expect(isMetaLine('地点：星光羽毛球馆')).toBe(true);
    expect(isMetaLine('周五羽毛球')).toBe(true);
    expect(isMetaLine('阿哲')).toBe(false);
    expect(isMetaLine('周一')).toBe(false);
  });

  it('nameKey 忽略大小写、空格与标点', () => {
    expect(nameKey('K ai')).toBe(nameKey('kai'));
    expect(nameKey('小 满')).toBe(nameKey('小满'));
  });

  it('extractHints 提取日期、时间和场馆建议', () => {
    const hints = extractHints(`#接龙
2026.10.29 周四 19:00-21:00 羽毛球
地点：星光羽毛球馆`);

    expect(hints).toMatchObject({
      date: '2026-10-29',
      startTime: '19:00',
      endTime: '21:00',
      venue: '星光羽毛球馆',
    });
  });
});
