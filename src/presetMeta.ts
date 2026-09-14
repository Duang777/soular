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
  "social-connections": {
    question: "如何更好地社交？",
    axis: {
      left: "减少无效社交",
      center: "保留关系边界",
      right: "主动建立连接",
      leftChoice: "重视独处",
      rightChoice: "主动连接",
      leftTendency: "倾向精简关系",
      rightTendency: "倾向拓展关系",
    },
    guideHeadline: "如何更好地社交：一边主张减少无效关系，一边强调主动练习与建立高质量连接。",
  },
  "ai-programmer-jobs": {
    question: "AI 会导致程序员大批失业吗？",
    axis: {
      left: "岗位大幅收缩",
      center: "职业结构分化",
      right: "程序员角色升级",
      leftChoice: "提前转型",
      rightChoice: "人机协作",
      leftTendency: "倾向替代加速",
      rightTendency: "倾向能力升级",
    },
    guideHeadline: "AI 与程序员就业：多数观点预期岗位收缩，另一侧认为责任、架构与业务判断仍需要人。",
  },
  "city-or-hometown": {
    question: "大学毕业是去大城市好还是回小城市好？",
    axis: {
      left: "回到小城市",
      center: "按阶段选择",
      right: "留在大城市",
      leftChoice: "回乡生活",
      rightChoice: "留城发展",
      leftTendency: "倾向生活安稳",
      rightTendency: "倾向机会成长",
    },
    guideHeadline: "毕业后的城市选择：一边看重家人、成本和安稳，一边选择机会、视野和职业空间。",
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
