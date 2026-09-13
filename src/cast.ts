declare global {
  const __SCENE_VERSION__: string;
}

export type CastIdle = {
  x: string;
  y: string;
  rot: string;
  dur: string;
  delay: string;
  bob: number;
};

export type Cast = {
  key: string;
  name: string;
  role: string;
  color: string;
  volume: string;
  portrait?: string;
  description?: string;
  personaId?: string;
  themeId?: string;
  themeName?: string;
  idle: CastIdle;
};

export const CASTS: Cast[] = [
  { key: "fox", name: "长答派", role: "万字长答", color: "#414552", volume: "卷一", idle: { x: "2.2%", y: "-1.4%", rot: "-1.8deg", dur: "3.2s", delay: "-0.4s", bob: 3.4 } },
  { key: "bear", name: "拆题派", role: "先重述问题", color: "#1e2b2d", volume: "卷二", idle: { x: "0.8%", y: "-2.4%", rot: "0.7deg", dur: "6.4s", delay: "-1.8s", bob: 2.1 } },
  { key: "cat", name: "盐选派", role: "精选长文", color: "#624936", volume: "卷三", idle: { x: "1.4%", y: "-1.1%", rot: "2.4deg", dur: "4.6s", delay: "-2.2s", bob: 2.8 } },
  { key: "owl", name: "深夜派", role: "三点的诚实", color: "#5b5d37", volume: "卷四", idle: { x: "2.8%", y: "-0.6%", rot: "-2.8deg", dur: "5.6s", delay: "-0.9s", bob: 2.4 } },
  { key: "rabbit", name: "提问派", role: "把问题问清楚", color: "#4a3548", volume: "卷五", idle: { x: "1.1%", y: "-2.8%", rot: "1.1deg", dur: "2.7s", delay: "-1.3s", bob: 4.6 } },
  { key: "penguin", name: "收藏派", role: "先存再看", color: "#1c2838", volume: "卷六", idle: { x: "2.4%", y: "-0.8%", rot: "2.1deg", dur: "4.1s", delay: "-2.8s", bob: 2.6 } },
  { key: "redpanda", name: "圆桌派", role: "把人拉齐", color: "#5c3220", volume: "卷七", idle: { x: "2.6%", y: "-2.1%", rot: "-1.2deg", dur: "3.6s", delay: "-0.2s", bob: 3.1 } },
  { key: "goat", name: "杠精派", role: "先找反例", color: "#3a4030", volume: "卷八", idle: { x: "0.7%", y: "-2.2%", rot: "1.8deg", dur: "4.9s", delay: "-1.6s", bob: 2.9 } },
  { key: "frog", name: "想法派", role: "三百字闪过", color: "#2a4530", volume: "卷九", idle: { x: "1.6%", y: "-3.4%", rot: "-0.8deg", dur: "2.3s", delay: "-0.7s", bob: 5.2 } },
];

export function asset(file: string) {
  return `${import.meta.env.BASE_URL}${file.replace(/^\//, "")}`;
}

export function withVersion(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}v=${__SCENE_VERSION__}`;
}

export function castCardVars(cast: Cast): Record<string, string> {
  return {
    "--card-color": cast.color,
    "--idle-x": cast.idle.x,
    "--idle-y": cast.idle.y,
    "--idle-rot": cast.idle.rot,
    "--idle-dur": cast.idle.dur,
    "--idle-delay": cast.idle.delay,
  };
}

export function castByKey(key: string, casts: readonly Cast[] = CASTS): Cast {
  return casts.find((item) => item.key === key) ?? casts[0] ?? CASTS[0];
}
