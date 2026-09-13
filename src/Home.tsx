import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CASTS } from "./cast";
import { Nebula } from "./Nebula";
import { OAuthAccount } from "./OAuthAccount";
import { WaveStage } from "./WaveStage";

const QUESTION_PRESETS = [
  {
    id: "career-35",
    serial: "01",
    kind: "示例星云",
    title: "35 岁程序员该不该转行？",
    detail: "48 个观点",
  },
  {
    id: "ai-math",
    serial: "02",
    kind: "真实讨论",
    title: "AI 是否正在毁掉数学？",
    detail: "31 个观点",
  },
  {
    id: "tao-ai-tradition",
    serial: "03",
    kind: "真实讨论",
    title: "陶哲轩发文称「AI 正杀死数学百年开放传统」，你如何看待这一观点？",
    detail: "5 个观点",
  },
  {
    id: "pangdonglai-labor",
    serial: "04",
    kind: "真实讨论",
    title: "如何看待于东来发文称胖东来再招员工都是学员性质，合同四年，不续签？意味着什么？",
    detail: "3 个观点",
  },
  {
    id: "ai-math-revolution",
    serial: "05",
    kind: "真实讨论",
    title: "数学已经被 AI 彻底革命了么？",
    detail: "5 个观点",
  },
  {
    id: "imu-ai-declaration",
    serial: "06",
    kind: "真实讨论",
    title:
      "国际数学联盟发布《人工智能与数学莱顿宣言》，回应 AI 对数学研究影响的问题，如何理解这份宣言？",
    detail: "5 个观点",
  },
] as const;

function PersonaHome() {
  const navigate = useNavigate();
  const waveFrameRef = useRef<HTMLIFrameElement>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const matchingQuestions = normalizedQuery
    ? QUESTION_PRESETS.filter(({ title }) =>
        title.toLocaleLowerCase("zh-CN").includes(normalizedQuery)
      )
    : QUESTION_PRESETS;

  function openQuestion(preset: string) {
    navigate(`/?preset=${encodeURIComponent(preset)}&confirm=1`, {
      state: { fromPersonaHome: true },
    });
  }

  useEffect(() => {
    try {
      window.sessionStorage.setItem("jiupai:lobby", "/");
    } catch {
      // 存储不可用时仍保留 iframe 导航。
    }
    function onMessage(event: MessageEvent) {
      if (event.source !== waveFrameRef.current?.contentWindow) return;
      const cast = event.data?.cast;
      if (event.data?.type !== "wave-open" || typeof cast !== "string") return;
      if (!CASTS.some((item) => item.key === cast)) return;
      navigate(`/shelf/${cast}?peek=1`);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  return (
    <main className="persona-home">
      <WaveStage iframeRef={waveFrameRef} />
      <OAuthAccount />
      <section className="question-dock" aria-label="搜索观点星云">
        <div className="question-dock__topics" aria-label="已发布问题">
          {matchingQuestions.map((question, index) => (
            <button
              key={question.id}
              type="button"
              className={`question-ticket question-ticket--${index + 1}`}
              onClick={() => openQuestion(question.id)}
            >
              <span className="question-ticket__meta">
                {question.serial} · {question.kind}
              </span>
              <b>{question.title}</b>
              <small>{question.detail} · 点击进入</small>
            </button>
          ))}
        </div>
        <form
          className="question-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const target = matchingQuestions[0];
            if (target) openQuestion(target.id);
          }}
        >
          <span className="question-search__galaxy" aria-hidden="true">
            <i className="question-search__orbit question-search__orbit--outer" />
            <i className="question-search__orbit question-search__orbit--inner" />
            <i className="question-search__core">✦</i>
          </span>
          <label className="question-search__field">
            <span>
              星图检索 · {String(matchingQuestions.length).padStart(2, "0")} 座星云
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入问题，寻找观点星系"
              aria-label="搜索已发布的问题"
            />
          </label>
          <button type="submit" disabled={matchingQuestions.length === 0}>
            <span>进入银河</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="question-dock__hint" role="status">
          {matchingQuestions.length
            ? "从一个问题出发，看见观点的星系"
            : "还没有发布这个问题的观点星云"}
        </p>
      </section>
    </main>
  );
}

export function Home() {
  const [searchParams] = useSearchParams();
  return searchParams.get("confirm") === "1" ||
    searchParams.get("explore") === "1"
    ? <Nebula entryMode />
    : <PersonaHome />;
}
