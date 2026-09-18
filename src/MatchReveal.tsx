import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { castByKey } from "./cast";
import { nebulaPresetVersion } from "./people";
import { usePersonaCasts } from "./personaTheme";
import { getPresetMeta } from "./presetMeta";
import {
  averageStance,
  buildMatchQuizQuestions,
  describeMatchRelationship,
  parseShareMatchQuery,
  stanceLabel,
  summarizeThoughtMap,
  type ShareMatchEntry,
  type ThoughtMapResult,
} from "./shareMatch";

type Phase = "intro" | "quiz" | "reveal" | "map";
type MatchResult = ThoughtMapResult & {
  entry: ShareMatchEntry;
};

const QUIZ_CHOICE_LOCK_MS = 320;

function MatchHeader() {
  return (
    <header className="match-nav">
      <BrandMark className="brand-lockup--match" />
      <span className="match-nav__title">共同思想地图</span>
      <Link to="/" className="match-nav__back">返回首页</Link>
    </header>
  );
}

function markerStyle(stance: number): { left: string } {
  const percent = ((stance + 1) / 2) * 100;
  return { left: `clamp(8%, ${percent}%, 92%)` };
}

function resultDistance(result: MatchResult): number {
  return Math.round(Math.abs(result.hostStance - result.guestStance) * 50);
}

export function MatchRevealPage() {
  const [searchParams] = useSearchParams();
  const payload = useMemo(() => parseShareMatchQuery(searchParams), [searchParams]);
  const entries = useMemo(
    () => payload?.entries.filter((entry) =>
      nebulaPresetVersion(entry.preset) === entry.version
    ) ?? [],
    [payload],
  );
  const payloadKey = searchParams.toString();
  const [phase, setPhase] = useState<Phase>("intro");
  const [activePreset, setActivePreset] = useState(payload?.preset ?? "");
  const [quizStep, setQuizStep] = useState(0);
  const [quizStances, setQuizStances] = useState<number[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [choiceLocked, setChoiceLocked] = useState(false);
  const choiceLockedRef = useRef(false);
  const choiceUnlockTimer = useRef(0);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const activeEntry =
    entries.find(({ preset }) => preset === activePreset) ?? entries[0] ?? null;
  const personaState = usePersonaCasts(activeEntry?.preset ?? payload?.preset);
  const casts = personaState.casts;

  useEffect(() => () => window.clearTimeout(choiceUnlockTimer.current), []);
  useEffect(() => {
    setPhase("intro");
    setActivePreset(payload?.preset ?? "");
    setQuizStep(0);
    setQuizStances([]);
    setResults([]);
    choiceLockedRef.current = false;
    setChoiceLocked(false);
  }, [payloadKey, payload?.preset]);
  useEffect(() => {
    if (phase === "quiz" && !choiceLocked) {
      firstChoiceRef.current?.focus({ preventScroll: true });
    }
  }, [choiceLocked, phase, quizStep]);

  if (!payload) {
    return <Navigate to="/" replace />;
  }

  const currentVersion = nebulaPresetVersion(payload.preset);
  if (!currentVersion) {
    return <Navigate to="/nebula" replace />;
  }

  const initialPreset = getPresetMeta(payload.preset);
  if (payload.version !== currentVersion) {
    return (
      <div className="match-page">
        <MatchHeader />
        <main className="match-main">
          <header className="match-hero">
            <p className="match-eyebrow">分享链接已过期</p>
            <h1 className="match-title">{initialPreset.question}</h1>
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

  if (!activeEntry) {
    return <Navigate to="/nebula" replace />;
  }

  const preset = getPresetMeta(activeEntry.preset);
  if (personaState.status === "loading") {
    return (
      <div className="match-page">
        <MatchHeader />
        <main className="match-main">
          <header className="match-hero">
            <p className="match-eyebrow">共同问题 · 正在校准</p>
            <h1 className="match-title">{preset.question}</h1>
          </header>
          <section className="match-panel" aria-live="polite">
            <p className="match-copy">正在载入这道题的人格主题…</p>
          </section>
        </main>
      </div>
    );
  }

  const axis = preset.axis;
  const questions = buildMatchQuizQuestions(axis);
  const hostCast = castByKey(activeEntry.cast, casts);
  const activeResult =
    results.find(({ preset: resultPreset }) => resultPreset === activeEntry.preset) ??
    null;
  const guestStance =
    activeResult?.guestStance ?? averageStance(quizStances);
  const relationship = describeMatchRelationship(
    axis,
    hostCast,
    activeEntry.stance,
    guestStance,
  );
  const pendingEntries = entries.filter(({ preset: entryPreset }) =>
    !results.some(({ preset: resultPreset }) => resultPreset === entryPreset)
  );
  const orderedResults = entries.flatMap((entry) => {
    const result = results.find(({ preset }) => preset === entry.preset);
    return result ? [result] : [];
  });
  const mapSummary = summarizeThoughtMap(orderedResults);
  const staleEntryCount = payload.entries.length - entries.length;
  const nebulaTarget =
    `/nebula?preset=${encodeURIComponent(activeEntry.preset)}`;

  function resetChoiceLock() {
    window.clearTimeout(choiceUnlockTimer.current);
    choiceLockedRef.current = false;
    setChoiceLocked(false);
  }

  function lockChoices() {
    choiceLockedRef.current = true;
    setChoiceLocked(true);
    window.clearTimeout(choiceUnlockTimer.current);
    choiceUnlockTimer.current = window.setTimeout(() => {
      choiceLockedRef.current = false;
      setChoiceLocked(false);
    }, QUIZ_CHOICE_LOCK_MS);
  }

  function beginQuestion(entry: ShareMatchEntry) {
    resetChoiceLock();
    setActivePreset(entry.preset);
    setQuizStep(0);
    setQuizStances([]);
    setPhase("quiz");
  }

  function showResult(result: MatchResult) {
    resetChoiceLock();
    setActivePreset(result.preset);
    setQuizStances([result.guestStance]);
    setPhase("reveal");
  }

  function handleChoice(stance: number) {
    if (choiceLockedRef.current) return;
    lockChoices();

    const next = [...quizStances, stance];
    if (quizStep + 1 >= questions.length) {
      const nextResult: MatchResult = {
        entry: activeEntry,
        preset: activeEntry.preset,
        hostStance: activeEntry.stance,
        guestStance: averageStance(next),
      };
      setQuizStances(next);
      setResults((current) => [
        ...current.filter(({ preset: resultPreset }) =>
          resultPreset !== activeEntry.preset
        ),
        nextResult,
      ]);
      setPhase("reveal");
      return;
    }
    setQuizStances(next);
    setQuizStep(quizStep + 1);
  }

  const mapHeading = phase === "map"
    ? mapSummary.headline
    : preset.question;
  const mapEyebrow = phase === "map"
    ? `共同思想地图 · ${orderedResults.length} / ${entries.length}`
    : `共同问题 ${Math.max(
        1,
        entries.findIndex(({ preset: entryPreset }) =>
          entryPreset === activeEntry.preset
        ) + 1,
      )} / ${entries.length}`;

  return (
    <div className="match-page">
      <MatchHeader />

      <main className="match-main" lang="zh-CN">
        {phase !== "intro" && (
          <header className="match-hero">
            <p className="match-eyebrow">{mapEyebrow}</p>
            <h1 className="match-title">{mapHeading}</h1>
            {phase === "map"
              ? <p className="match-lead">{mapSummary.body}</p>
              : preset.guideHeadline && (
                <p className="match-lead">{preset.guideHeadline}</p>
              )}
          </header>
        )}

        {phase === "intro" && (
          <section className="match-invite">
            <p className="match-invite__eyebrow">
              SHARED ORBIT · {String(entries.length).padStart(2, "0")} QUESTIONS
            </p>
            <h1 className="match-invite__title">
              一起点亮
              <br />
              你们的思想星轨
            </h1>
            <p className="match-invite__lead">
              朋友已在 {entries.length} 个问题留下坐标。你回答同一道题后，
              双方位置才会同时显现。
            </p>
            <ol className="match-invite__orbit" aria-label="共同问题">
              {entries.map((entry, index) => {
                const entryPreset = getPresetMeta(entry.preset);
                return (
                  <li
                    key={entry.preset}
                    className={index === 0 ? "is-active" : undefined}
                  >
                    <span className="match-invite__node">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="match-invite__question">
                      <strong>{entryPreset.question}</strong>
                      <small>
                        {index === 0 ? "第一颗共同坐标" : "等待你回答"}
                      </small>
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="match-invite__friend">
              {hostCast.name}已完成 {entries.length} 道问题
            </p>
            {staleEntryCount > 0 && (
              <p className="match-invite__notice">
                {staleEntryCount} 道题来自旧版快照，已从本次地图中移除。
              </p>
            )}
            <button
              type="button"
              className="match-invite__action"
              onClick={() => {
                lockChoices();
                setPhase("quiz");
              }}
            >
              回答第一题
              <span aria-hidden="true">→</span>
            </button>
            <p className="match-invite__notice">
              链接不验证身份，仅用于本次题目互动。
            </p>
          </section>
        )}

        {phase === "quiz" && (
          <section className="match-panel">
            <p className="match-quiz-progress" aria-live="polite">
              本题第 {quizStep + 1} / {questions.length} 次表态
            </p>
            <h2 className="match-quiz-question">{questions[quizStep].question}</h2>
            <div className="match-quiz-choices">
              {questions[quizStep].choices.map((choice, choiceIndex) => (
                <button
                  key={choice.label}
                  ref={choiceIndex === 0 ? firstChoiceRef : undefined}
                  type="button"
                  className="match-quiz-btn"
                  aria-label={`${questions[quizStep].question}：${choice.label}`}
                  disabled={choiceLocked}
                  onClick={() => handleChoice(choice.stance)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {phase === "reveal" && activeResult && (
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
                style={markerStyle(activeEntry.stance)}
                title={`朋友：${stanceLabel(activeEntry.stance, axis)}`}
              >
                <span>朋友</span>
              </span>
              <span
                className="match-marker match-marker--guest"
                style={markerStyle(activeResult.guestStance)}
                title={`你：${stanceLabel(activeResult.guestStance, axis)}`}
              >
                <span>你</span>
              </span>
            </div>

            <div className="match-result">
              <h2>{relationship.headline}</h2>
              <p>{relationship.body}</p>
            </div>

            <div className="match-actions">
              {pendingEntries.length > 0 && (
                <button
                  type="button"
                  className="draw-btn draw-btn--primary match-cta"
                  onClick={() => beginQuestion(pendingEntries[0])}
                >
                  继续下一道共同问题
                </button>
              )}
              <button
                type="button"
                className={`draw-btn ${
                  pendingEntries.length ? "draw-btn--ghost" : "draw-btn--primary"
                } match-cta`}
                onClick={() => setPhase("map")}
              >
                查看共同思想地图 · {orderedResults.length}
              </button>
              <Link to={nebulaTarget} className="draw-btn draw-btn--ghost match-cta">
                探索这道题的观点
              </Link>
              <button
                type="button"
                className="draw-btn draw-btn--text match-cta"
                onClick={() => beginQuestion(activeEntry)}
              >
                重新表态本题
              </button>
            </div>
          </section>
        )}

        {phase === "map" && (
          <section className="match-panel match-panel--map">
            <div className="match-map__summary" aria-label="共同思想地图摘要">
              <span>
                <b>{orderedResults.length}</b>
                已完成
              </span>
              <span>
                <b>{mapSummary.alignedCount}</b>
                坐标接近
              </span>
              <span>
                <b>{Math.round(mapSummary.averageGap * 50)}</b>
                平均距离
              </span>
            </div>
            <div className="match-map__legend" aria-label="地图图例">
              <span className="match-map__legend-host">朋友</span>
              <span className="match-map__legend-guest">你</span>
            </div>
            <div className="match-map__rows">
              {entries.map((entry, index) => {
                const result =
                  results.find(({ preset }) => preset === entry.preset) ?? null;
                const entryPreset = getPresetMeta(entry.preset);
                return (
                  <article
                    key={entry.preset}
                    className={`match-map__row${result ? " is-complete" : ""}`}
                  >
                    <header className="match-map__row-head">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <h3>{entryPreset.question}</h3>
                      <small>
                        {result ? `距离 ${resultDistance(result)}` : "等你回答"}
                      </small>
                    </header>
                    {result ? (
                      <>
                        <div
                          className="match-map__track"
                          aria-label={`${entryPreset.question}的双方位置`}
                        >
                          <span
                            className="match-map__marker match-map__marker--host"
                            style={markerStyle(result.hostStance)}
                            title={`朋友：${stanceLabel(
                              result.hostStance,
                              entryPreset.axis,
                            )}`}
                          />
                          <span
                            className="match-map__marker match-map__marker--guest"
                            style={markerStyle(result.guestStance)}
                            title={`你：${stanceLabel(
                              result.guestStance,
                              entryPreset.axis,
                            )}`}
                          />
                        </div>
                        <button
                          type="button"
                          className="match-map__action"
                          onClick={() => showResult(result)}
                        >
                          查看本题结果
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="match-map__pending"
                        onClick={() => beginQuestion(entry)}
                      >
                        我也回答这题
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="match-actions">
              {pendingEntries.length > 0 && (
                <button
                  type="button"
                  className="draw-btn draw-btn--primary match-cta"
                  onClick={() => beginQuestion(pendingEntries[0])}
                >
                  继续点亮下一颗坐标
                </button>
              )}
              <Link to={nebulaTarget} className="draw-btn draw-btn--ghost match-cta">
                探索当前问题
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
