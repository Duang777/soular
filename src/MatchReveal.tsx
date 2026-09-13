import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { castByKey } from "./cast";
import { nebulaPresetVersion } from "./people";
import { getPresetMeta } from "./presetMeta";
import {
  averageStance,
  buildMatchQuizQuestions,
  describeMatchRelationship,
  parseShareMatchQuery,
  stanceLabel,
} from "./shareMatch";

type Phase = "intro" | "quiz" | "reveal";

function MatchHeader() {
  return (
    <header className="match-nav">
      <BrandMark className="brand-lockup--match" />
      <span className="match-nav__title">观点对照</span>
      <Link to="/" className="match-nav__back">返回首页</Link>
    </header>
  );
}

function markerStyle(stance: number): { left: string } {
  const percent = ((stance + 1) / 2) * 100;
  return { left: `clamp(8%, ${percent}%, 92%)` };
}

export function MatchRevealPage() {
  const [searchParams] = useSearchParams();
  const payload = useMemo(() => parseShareMatchQuery(searchParams), [searchParams]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [quizStep, setQuizStep] = useState(0);
  const [quizStances, setQuizStances] = useState<number[]>([]);

  if (!payload) {
    return <Navigate to="/" replace />;
  }

  const currentVersion = nebulaPresetVersion(payload.preset);
  if (!currentVersion) {
    return <Navigate to="/nebula" replace />;
  }

  const preset = getPresetMeta(payload.preset);
  if (payload.version !== currentVersion) {
    return (
      <div className="match-page">
        <MatchHeader />
        <main className="match-main">
          <header className="match-hero">
            <p className="match-eyebrow">分享链接已过期</p>
            <h1 className="match-title">{preset.question}</h1>
          </header>
          <section className="match-panel">
            <p className="match-copy">
              这份对照来自旧版观点快照，当前版本已更新，不能继续解释原有星位。
            </p>
            <Link
              to={`/nebula?preset=${encodeURIComponent(payload.preset)}`}
              className="draw-btn draw-btn--primary match-cta"
            >
              查看当前星云
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const axis = preset.axis;
  const questions = buildMatchQuizQuestions(axis);
  const hostCast = castByKey(payload.cast);
  const guestStance = averageStance(quizStances);
  const relationship = describeMatchRelationship(axis, hostCast, payload.stance, guestStance);
  const nebulaTarget = `/nebula?preset=${encodeURIComponent(payload.preset)}`;

  function handleChoice(stance: number) {
    const next = [...quizStances, stance];
    if (quizStep + 1 >= questions.length) {
      setQuizStances(next);
      setPhase("reveal");
      return;
    }
    setQuizStances(next);
    setQuizStep(quizStep + 1);
  }

  return (
    <div className="match-page">
      <MatchHeader />

      <main className="match-main">
        <header className="match-hero">
          <p className="match-eyebrow">同一道题 · 独立表态</p>
          <h1 className="match-title">{preset.question}</h1>
          {preset.guideHeadline && (
            <p className="match-lead">{preset.guideHeadline}</p>
          )}
        </header>

        {phase === "intro" && (
          <section className="match-panel">
            <p className="match-copy">
              朋友已在这道题上形成观点，并分享了自己的星位与人格。
              请先独立完成下面 3 次表态；完成前不会显示朋友的位置。
            </p>
            <p className="match-copy match-copy--muted">
              分享者人格：{hostCast.name}（{hostCast.role}）
            </p>
            <p className="match-copy match-copy--muted">
              分享信息来自链接本身，未经过平台身份认证；结果仅用于本题互动。
            </p>
            <button
              type="button"
              className="draw-btn draw-btn--primary match-cta"
              onClick={() => setPhase("quiz")}
            >
              开始我的表态
            </button>
          </section>
        )}

        {phase === "quiz" && (
          <section className="match-panel">
            <p className="match-quiz-progress">
              第 {quizStep + 1} / {questions.length} 题
            </p>
            <h2 className="match-quiz-question">{questions[quizStep].question}</h2>
            <div className="match-quiz-choices">
              {questions[quizStep].choices.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  className="match-quiz-btn"
                  onClick={() => handleChoice(choice.stance)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {phase === "reveal" && (
          <section className="match-panel match-panel--reveal">
            <div className="match-spectrum" aria-label="双方观点光谱">
              <div className="match-spectrum__track" />
              <span className="match-spectrum__label match-spectrum__label--left">
                {axis.left}
              </span>
              <span className="match-spectrum__label match-spectrum__label--right">
                {axis.right}
              </span>
              <span
                className="match-marker match-marker--host"
                style={markerStyle(payload.stance)}
                title={`朋友：${stanceLabel(payload.stance, axis)}`}
              >
                <span>朋友</span>
              </span>
              <span
                className="match-marker match-marker--guest"
                style={markerStyle(guestStance)}
                title={`你：${stanceLabel(guestStance, axis)}`}
              >
                <span>你</span>
              </span>
            </div>

            <div className="match-result">
              <h2>{relationship.headline}</h2>
              <p>{relationship.body}</p>
            </div>

            <div className="match-actions">
              <Link to={nebulaTarget} className="draw-btn draw-btn--primary match-cta">
                继续探索这道题
              </Link>
              <button
                type="button"
                className="draw-btn draw-btn--ghost match-cta"
                onClick={() => {
                  setPhase("intro");
                  setQuizStep(0);
                  setQuizStances([]);
                }}
              >
                重新表态
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
