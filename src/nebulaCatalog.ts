export type ShowcaseGalaxy = {
  id: string;
  serial: string;
  kind: "real" | "mock";
  question: string;
  signalCount: number;
  axisLeft: string;
  axisRight: string;
  blurb: string;
};

export const SHOWCASE_GALAXIES: ShowcaseGalaxy[] = [
  {
    id: "ai-math",
    serial: "02",
    kind: "real",
    question: "AI 是否正在毁掉数学？",
    signalCount: 31,
    axisLeft: "警惕生态伤害",
    axisRight: "拥抱研究加速",
    blurb: "陶哲轩等数学家联名发声，真实回答沿观点光谱排开。",
  },
  {
    id: "career-35",
    serial: "01",
    kind: "mock",
    question: "35 岁程序员该不该转行？",
    signalCount: 48,
    axisLeft: "必须转行",
    axisRight: "深耕不转",
    blurb: "示例星云，演示点赞、星位与人格卡完整流程。",
  },
];
