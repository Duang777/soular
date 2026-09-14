import type { PresetAxis } from "./shareMatch";

export type PresetMeta = {
  question: string;
  axis: PresetAxis;
  guideHeadline?: string;
};

const PRESET_META: Readonly<Record<string, PresetMeta>> = {
  "career-35": {
    question: "35 岁程序员该不该转行？",
    axis: {
      left: "必须转行",
      center: "中立观察",
      right: "深耕不转",
      leftChoice: "转行",
      rightChoice: "深耕",
      leftTendency: "倾向转行",
      rightTendency: "倾向深耕",
    },
    guideHeadline: "35 岁要不要转行：一边是趁早换赛道，一边是继续深耕技术护城河。",
  },
  "ai-math": {
    question: "AI 是否正在毁掉数学？",
    axis: {
      left: "警惕生态伤害",
      center: "审慎协作",
      right: "拥抱研究加速",
      leftChoice: "警惕AI冲击",
      rightChoice: "拥抱AI协作",
      leftTendency: "倾向审慎治理",
      rightTendency: "倾向人机协同",
    },
    guideHeadline: "AI 与数学：数学家担忧研究方法与共同体，支持者看到的是验证、协作与加速。",
  },
  "scholars-ai-math": {
    question: "如何看待现在有学者用 AI 做数学科研？",
    axis: {
      left: "质疑 AI 科研",
      center: "审慎试用",
      right: "积极拥抱",
      leftChoice: "警惕滥用",
      rightChoice: "拥抱工具",
      leftTendency: "倾向人工把关",
      rightTendency: "倾向工具先行",
    },
  },
};

export function getPresetMeta(presetId: string): PresetMeta {
  return PRESET_META[presetId] ?? PRESET_META["career-35"];
}
