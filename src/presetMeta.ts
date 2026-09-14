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
      left: "数学是在练人的思维",
      center: "AI 能用，但得有人复核",
      right: "AI 已经做出了真数学",
      leftChoice: "警惕AI冲击",
      rightChoice: "拥抱AI协作",
      leftTendency: "更看重想明白",
      rightTendency: "更看重用起来",
    },
    guideHeadline: "这题吵的是：数学家怕人不再自己想，支持者说机器验得过就是真成果。",
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
  // 首个由离线管线自动组装的快照，轴文案随 preset-heritage-state.js 同步。
  "heritage-state": {
    question:
      "北京一独居者离世，无配偶、子女、兄弟姐妹，叔舅姑姨九人争遗产，法院判房产归国家，如何从法律角度解读？",
    axis: {
      left: "我觉得没继承权就该归国家",
      center: "我觉得该给尽扶养义务的…",
      right: "我觉得亲戚来争遗产就是…",
    },
  },
};

export function getPresetMeta(presetId: string): PresetMeta {
  return PRESET_META[presetId] ?? PRESET_META["career-35"];
}
