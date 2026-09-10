import { useRef, useState } from "react";
import { CardWave } from "./card-wave";
import { asset } from "./cast";
import { TOPICS } from "./topics";

export function Home() {
  const stageRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<() => void>(() => {});
  const [vertical, setVertical] = useState(false);

  return (
    <div ref={stageRef} className="stage" style={{ minHeight: "100dvh" }}>
      <CardWave stageRef={stageRef} flipRef={flipRef} onOrient={setVertical} />
      <img src={asset("kanshan/hi.gif")} alt="" className="kanshan" />
      <main className="home-main">
        <aside className="hud" style={{ pointerEvents: "auto" }}>
          <p className="hot-ticker" aria-label="知乎社区议题">
            <span>社区议题</span>
            {TOPICS.map((title) => (
              <span key={title}>{title}</span>
            ))}
          </p>
          <p className="kicker">知乎 · 九派</p>
          <h1 className="title">灵魂问答盲盒</h1>
          <p className="lede">
            用问答定义一个人，而不是用照片定义一个人。点一张人物卡，先看这一派怎么把问题写成一本书。
          </p>
        </aside>
        <div className="home-actions">
          <button type="button" className="btn btn-ghost wave-orient" onClick={() => flipRef.current()}>
            {vertical ? "横过来" : "竖过来"}
          </button>
        </div>
      </main>
    </div>
  );
}
