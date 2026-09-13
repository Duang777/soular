import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const VERSION = "20260914";
const ROOT = resolve(import.meta.dirname, "..");
const AVATAR_ROOT = resolve(ROOT, "public/nebula-scene/avatars");

const CATALOG = [
  {
    exportName: "TAO_AI_TRADITION",
    id: "tao-ai-tradition",
    serial: "03",
    question: "陶哲轩发文称「AI 正杀死数学百年开放传统」，你如何看待这一观点？",
    peopleLabel: "真实回答观点",
    sourceQuestion: "https://www.zhihu.com/question/2081393640379893635",
    axis: {
      left: "警惕传统受损",
      center: "审慎观察",
      right: "接受 AI 加速",
      leftChoice: "守护开放传统",
      rightChoice: "拥抱研究加速",
      leftTendency: "倾向生态治理",
      rightTendency: "倾向技术乐观",
    },
    people: [
      {
        name: "芝了",
        stance: -0.88,
        cast: "bear",
        claim: "AI 公司追逐基准成绩，与数学共同体积累方法和理解的目标严重错位。",
        answerId: "2082061701990691214",
        votes: 50,
        avatarUrl: "https://picx.zhimg.com/v2-27bfcba90e66db79ce8768ab807e017e_l.jpg",
        copyFrom: "ai-math/u08.jpg",
      },
      {
        name: "数学人生",
        stance: -0.7,
        cast: "owl",
        claim: "菲奖得主联合声明揭示 AI 公司目标与数学共同体错位，仓促公布解答会冲击百年开放传统。",
        answerId: "2082018346443318688",
        votes: 324,
        avatarUrl: "https://pic1.zhimg.com/132f5d0d10e0c5ad4079633336b33eb8_l.jpg",
      },
      {
        name: "Urvin",
        stance: -0.25,
        cast: "penguin",
        claim: "AI 成果建立在人类既有成果上，归属和贡献必须被清楚标注。",
        answerId: "2082143563639477339",
        votes: 16,
        avatarUrl: "https://picx.zhimg.com/v2-33aea8a2a965c950b32b8621c475a988_l.jpg",
        copyFrom: "ai-math/u16.jpg",
      },
      {
        name: "知乎用户",
        stance: 0.74,
        cast: "fox",
        claim: "陶哲轩急了：AI 已能独食论文署名，不再需要大师背书与翻译。",
        answerId: "2082055499969737052",
        votes: 1318,
        avatarUrl: "https://picx.zhimg.com/v2-abed1a8c04700ba7d72b45195223e0ff_l.jpg",
      },
      {
        name: "草莓猫塔菲",
        stance: 0.9,
        cast: "cat",
        claim: "人类大脑局限明显，AI 推科技树是好事，不必依赖自然涌现的天才。",
        answerId: "2082148261247432120",
        votes: 396,
        avatarUrl: "https://picx.zhimg.com/v2-ccf6b8e33dda439226eb24f1c81f01bc_l.jpg",
      },
    ],
  },
  {
    exportName: "PANGDONGLAI_LABOR",
    id: "pangdonglai-labor",
    serial: "04",
    question:
      "如何看待于东来发文称胖东来再招员工都是学员性质，合同四年，不续签？意味着什么？",
    peopleLabel: "真实回答观点",
    sourceQuestion: "https://www.zhihu.com/question/2082478357984421508",
    axis: {
      left: "质疑学员制",
      center: "保留观望",
      right: "理解经营选择",
      leftChoice: "质疑四年制",
      rightChoice: "理解不续签",
      leftTendency: "倾向劳动权益",
      rightTendency: "倾向企业自主",
    },
    people: [
      {
        name: "允执厥中",
        stance: -0.82,
        cast: "owl",
        claim: "四年不续签本质是提前声明的裁员免责，别拿培养人才当借口。",
        answerId: "2082493589620258102",
        votes: 1444,
        avatarUrl: "https://picx.zhimg.com/v2-a4ef4d8bdb85512f8860e4693b60c902_l.jpg",
      },
      {
        name: "法途萤光",
        stance: -0.38,
        cast: "bear",
        claim: "学员制想解决温室与市场的错配，但胖东来文化本身很难被外部职场复制。",
        answerId: "2082497362510061912",
        votes: 310,
        avatarUrl: "https://pic1.zhimg.com/v2-fdb0486b8ed0dd00d64eec59f834e3a0_l.jpg",
      },
      {
        name: "blc",
        stance: 0.76,
        cast: "fox",
        claim: "离职率极低却仍持续招人，苛刻条件下仍有人入职，说明同行更差。",
        answerId: "2082499044320999069",
        votes: 1758,
        avatarUrl: "https://pica.zhimg.com/v2-c95450f7a95f2a8a0ff11630e18ff10c_l.jpg",
      },
    ],
  },
  {
    exportName: "AI_MATH_REVOLUTION",
    id: "ai-math-revolution",
    serial: "05",
    question: "数学已经被 AI 彻底革命了么？",
    peopleLabel: "真实回答观点",
    sourceQuestion: "https://www.zhihu.com/question/2081004982103270003",
    axis: {
      left: "尚未彻底革命",
      center: "变革进行中",
      right: "革命已经发生",
      leftChoice: "变革尚早",
      rightChoice: "已被革命",
      leftTendency: "倾向审慎判断",
      rightTendency: "倾向承认突破",
    },
    people: [
      {
        name: "黄嘉树",
        stance: -0.52,
        cast: "bear",
        claim: "数学下游的计算机教学已被 AI 冲击，但数学本体是否革命仍难说。",
        answerId: "2081506349289152741",
        votes: 1468,
        avatarUrl: "https://pic1.zhimg.com/v2-9bd25ef46f078abb57ae478bc66dce94_l.jpg",
      },
      {
        name: "店员assistance",
        stance: 0.18,
        cast: "frog",
        claim: "数学正在发生深刻变化，但称之为彻底革命仍需要更多时间。",
        answerId: "2081694766933329478",
        votes: 4,
        avatarUrl: "https://picx.zhimg.com/v2-abed1a8c04700ba7d72b45195223e0ff_l.jpg",
        copyFrom: "ai-math/u20.jpg",
      },
      {
        name: "Yuhang Liu",
        stance: 0.56,
        cast: "bear",
        claim: "无需寻找人类独占任务，关键是最大化人类与 AI 的互补优势。",
        answerId: "2081019747441951589",
        votes: 324,
        avatarUrl: "https://pic1.zhimg.com/v2-df50a10f39ec642c480fd0d50c6d9986_l.jpg",
        copyFrom: "ai-math/u24.jpg",
      },
      {
        name: "啵啊啵",
        stance: 0.72,
        cast: "goat",
        claim: "NS 方程被解决标志着纯数氪金时代开启，时代浪潮将迫使数学家重新思考应用。",
        answerId: "2081204597889225899",
        votes: 431,
        avatarUrl: "https://pic1.zhimg.com/v2-4d4b53e877861d53697bd41bf84234d9_l.jpg",
      },
      {
        name: "Dunkirk",
        stance: 0.95,
        cast: "owl",
        claim: "从奥数到千禧难题，AI 做顶尖数学研究的能力已无法否认。",
        answerId: "2081787241567885047",
        votes: 394,
        avatarUrl: "https://picx.zhimg.com/v2-590f5f83edb9a0584d368e2df4465c79_l.jpg",
        copyFrom: "ai-math/u31.jpg",
      },
    ],
  },
  {
    exportName: "IMU_AI_DECLARATION",
    id: "imu-ai-declaration",
    serial: "06",
    question:
      "国际数学联盟发布《人工智能与数学莱顿宣言》，回应 AI 对数学研究影响的问题，如何理解这份宣言？",
    peopleLabel: "真实回答观点",
    sourceQuestion: "https://www.zhihu.com/question/2045460062915621128",
    axis: {
      left: "认同宣言审慎",
      center: "平衡协作",
      right: "呼吁拥抱变化",
      leftChoice: "支持审慎立场",
      rightChoice: "主动适应 AI",
      leftTendency: "倾向风险治理",
      rightTendency: "倾向主动变革",
    },
    people: [
      {
        name: "Physhan",
        stance: -0.62,
        cast: "frog",
        claim: "AI 进入数学后，原有的审查与信任机制可能被大量似是而非内容冲垮。",
        answerId: "2045794878756591109",
        votes: 84,
        avatarUrl: "https://picx.zhimg.com/v2-abed1a8c04700ba7d72b45195223e0ff_l.jpg",
        copyFrom: "ai-math/u12.jpg",
      },
      {
        name: "Celeris Peritus",
        stance: -0.48,
        cast: "bear",
        claim: "数学适合验证 AI 推理，但不能因此把数学只当作模型的试验场。",
        answerId: "2045609376120041834",
        votes: 5,
        avatarUrl: "https://pic1.zhimg.com/v2-df50a10f39ec642c480fd0d50c6d9986_l.jpg",
        copyFrom: "ai-math/u14.jpg",
      },
      {
        name: "知乎用户",
        stance: -0.15,
        cast: "penguin",
        claim: "证明终究要人类把关署名，但带学生和审稿方式都要随 AI 辅助而变。",
        answerId: "2045948431831770660",
        votes: 334,
        avatarUrl: "https://picx.zhimg.com/v2-abed1a8c04700ba7d72b45195223e0ff_l.jpg",
      },
      {
        name: "klam",
        stance: 0.42,
        cast: "cat",
        claim: "数学家负责提出想法和规划路线，AI 可以承担计算与形式化苦工。",
        answerId: "2045490158766666070",
        votes: 93,
        avatarUrl: "https://pic1.zhimg.com/v2-df50a10f39ec642c480fd0d50c6d9986_l.jpg",
        copyFrom: "ai-math/u23.jpg",
      },
      {
        name: "Yves S",
        stance: 0.88,
        cast: "fox",
        claim: "宣言过于保守，当务之急是主动寻找人类新位置，而非一味强调 AI 缺陷。",
        answerId: "2045581157182526220",
        votes: 621,
        avatarUrl: "https://picx.zhimg.com/v2-33aea8a2a965c950b32b8621c475a988_l.jpg",
      },
    ],
  },
];

function downloadAvatar(url, dest) {
  const normalized = url.includes("?") ? url : `${url}?source=1def8aca`;
  execFileSync(
    "curl",
    [
      "-fsSL",
      "-H",
      "Referer: https://www.zhihu.com/",
      "-H",
      "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "-o",
      dest,
      normalized,
    ],
    { stdio: "pipe" },
  );
}

function buildPresetFile(entry) {
  const sortedPeople = entry.people.slice().sort((left, right) => left.stance - right.stance);
  const people = sortedPeople.map((person) => [
    person.name,
    person.stance,
    person.cast,
    person.claim,
    `${entry.sourceQuestion}/answer/${person.answerId}`,
    entry.question,
    person.votes,
  ]);

  const avatarDir = resolve(AVATAR_ROOT, entry.id);
  mkdirSync(avatarDir, { recursive: true });
  sortedPeople.forEach((person, index) => {
    const dest = resolve(avatarDir, `u${String(index + 1).padStart(2, "0")}.jpg`);
    if (person.copyFrom) {
      copyFileSync(resolve(AVATAR_ROOT, person.copyFrom), dest);
      return;
    }
    downloadAvatar(person.avatarUrl, dest);
  });

  const body = `export const ${entry.exportName} = {
  id: "${entry.id}",
  version: "${VERSION}",
  serial: "${entry.serial}",
  kind: "real",
  question: ${JSON.stringify(entry.question)},
  peopleLabel: ${JSON.stringify(entry.peopleLabel)},
  sourceQuestion: ${JSON.stringify(entry.sourceQuestion)},
  searchUrl: ${JSON.stringify(entry.sourceQuestion)},
  avatarBase: "avatars/${entry.id}",
  axis: ${JSON.stringify(entry.axis, null, 2).replaceAll("\n", "\n  ")},
  people: ${JSON.stringify(people, null, 4).replace(/^/gm, "    ").trimStart()},
  followed: [],
  comments: [],
  circles: [],
  me: {
    name: "我",
    castKey: "fox",
    claim: "点赞真实回答，看看你更在意传统守护，还是研究加速。",
  },
};
`;
  const outPath = resolve(ROOT, `public/nebula-scene/preset-${entry.id}.js`);
  writeFileSync(outPath, body);
  console.log(`wrote ${outPath} (${people.length} people)`);
  return entry.id;
}

for (const entry of CATALOG) {
  buildPresetFile(entry);
}
