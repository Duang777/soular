import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export const FIRST_LOGIN_NEBULA_GUIDE_KEY =
  "jiupai:first-login-nebula-guide:v1";

const GUIDE_STEPS = [
  {
    code: "01 / PROFILE",
    target: ".oauth-account",
    title: "这里是你的兴趣星谱",
    body: "点击头像可以随时查看知乎公开兴趣校准结果。它提供兴趣底色，不会替你判断具体问题的立场。",
  },
  {
    code: "02 / PERSONA",
    target: '[data-guide-target="personas"]',
    title: "先认识九种观点人格",
    body: "滑动中间的人格卡可以预览不同思考方式。你最终获得哪张卡，由探索中的真实表态决定。",
  },
  {
    code: "03 / TOPICS",
    target: '[data-guide-target="questions"]',
    title: "每个问题都是一座星云",
    body: "这里列出已经整理好的知乎讨论。选择一个你关心的问题，进入它的观点光谱。",
  },
  {
    code: "04 / ENTER",
    target: '[data-guide-target="enter"]',
    title: "从这里进入银河",
    body: "你也可以先搜索题目。进入后拖动星图、阅读观点并点赞；满 3 次表态会生成你的观点人格。",
  },
] as const;

interface GuideLayout {
  spotlight: CSSProperties;
  popover: CSSProperties;
}

function calculateLayout(target: Element, popover: HTMLElement): GuideLayout {
  const rect = target.getBoundingClientRect();
  const padding = 8;
  const edge = 12;
  const gap = 14;
  const width = Math.min(
    popover.offsetWidth || 360,
    window.innerWidth - edge * 2,
  );
  const height = popover.offsetHeight || 210;
  const spotlightTop = Math.max(edge, rect.top - padding);
  const spotlightLeft = Math.max(edge, rect.left - padding);
  const spotlightRight = Math.min(
    window.innerWidth - edge,
    rect.right + padding,
  );
  const spotlightBottom = Math.min(
    window.innerHeight - edge,
    rect.bottom + padding,
  );
  const roomBelow = window.innerHeight - spotlightBottom;
  const roomAbove = spotlightTop;
  const top = roomBelow >= height + gap || roomBelow >= roomAbove
    ? Math.min(window.innerHeight - height - edge, spotlightBottom + gap)
    : Math.max(edge, spotlightTop - height - gap);
  const left = Math.min(
    window.innerWidth - width - edge,
    Math.max(edge, rect.left + rect.width / 2 - width / 2),
  );

  return {
    spotlight: {
      top: spotlightTop,
      left: spotlightLeft,
      width: Math.max(0, spotlightRight - spotlightLeft),
      height: Math.max(0, spotlightBottom - spotlightTop),
    },
    popover: { top, left },
  };
}

export function FirstLoginGuide({
  open,
  onFinish,
  onSkip,
}: {
  open: boolean;
  onFinish: () => void;
  onSkip: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [layout, setLayout] = useState<GuideLayout | null>(null);
  const step = GUIDE_STEPS[stepIndex];
  const isLastStep = stepIndex === GUIDE_STEPS.length - 1;

  const updateLayout = useCallback(() => {
    const target = document.querySelector(step.target);
    const popover = popoverRef.current;
    if (!target || !popover) return;
    setLayout(calculateLayout(target, popover));
  }, [step.target]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    setStepIndex(0);
    if (!dialog.open) dialog.showModal();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(updateLayout);
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [open, updateLayout]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      updateLayout();
      titleRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, stepIndex, updateLayout]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="first-login-guide"
      aria-labelledby="first-login-guide-title"
      aria-describedby="first-login-guide-description"
      onCancel={(event) => {
        event.preventDefault();
        onSkip();
      }}
    >
      <div
        className="first-login-guide__spotlight"
        style={layout?.spotlight}
        aria-hidden="true"
      />
      <section
        ref={popoverRef}
        className={`first-login-guide__popover${layout ? " is-positioned" : ""}`}
        style={layout?.popover}
      >
        <header>
          <p>{step.code}</p>
          <span>
            {stepIndex + 1} / {GUIDE_STEPS.length}
          </span>
        </header>
        <h2 id="first-login-guide-title" ref={titleRef} tabIndex={-1}>
          {step.title}
        </h2>
        <p id="first-login-guide-description">{step.body}</p>
        <footer>
          <button
            type="button"
            className="first-login-guide__skip"
            onClick={onSkip}
          >
            跳过
          </button>
          <div>
            {stepIndex > 0 ? (
              <button
                type="button"
                className="first-login-guide__back"
                onClick={() => setStepIndex((value) => value - 1)}
              >
                上一步
              </button>
            ) : null}
            <button
              type="button"
              className="first-login-guide__next"
              onClick={() => {
                if (isLastStep) onFinish();
                else setStepIndex((value) => value + 1);
              }}
            >
              {isLastStep ? "开始探索" : "下一步"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </footer>
      </section>
    </dialog>
  );
}
