const STANCE_WEIGHT = 0.82;
const INTEREST_WEIGHT = 0.18;

function finiteStance(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(-1, Math.min(1, value))
    : 0;
}

function normalizedInterest(value) {
  if (!value || typeof value !== "object") return { score: 0, word: "" };
  return {
    score: typeof value.score === "number" && Number.isFinite(value.score)
      ? Math.max(0, Math.min(1, value.score))
      : 0,
    word: typeof value.word === "string" ? value.word.trim() : "",
  };
}

function compareCandidates(left, right) {
  return right.score - left.score ||
    left.stanceDistance - right.stanceDistance ||
    left.index - right.index;
}

export function rankPeerCandidates({
  people,
  myStance,
  myCast,
  likedIndexes = [],
  interestForIndex = () => null,
}) {
  if (!Array.isArray(people)) return [];
  const stance = finiteStance(myStance);
  const liked = new Set(likedIndexes);
  const candidates = people.flatMap((person, index) => {
    if (
      !Array.isArray(person) ||
      typeof person[0] !== "string" ||
      typeof person[1] !== "number" ||
      !Number.isFinite(person[1]) ||
      typeof person[2] !== "string"
    ) {
      return [];
    }
    const candidateStance = finiteStance(person[1]);
    const stanceDistance = Math.abs(candidateStance - stance);
    const stanceAffinity = 1 - Math.min(2, stanceDistance) / 2;
    const interest = normalizedInterest(interestForIndex(index));
    return [{
      index,
      stance: candidateStance,
      cast: person[2],
      sameCast: person[2] === myCast,
      stanceDistance,
      stanceAffinity,
      interest,
      score: stanceAffinity * STANCE_WEIGHT + interest.score * INTEREST_WEIGHT,
    }];
  });
  const unseen = candidates.filter(({ index }) => !liked.has(index));
  const available = unseen.length ? unseen : candidates;
  const sameCast = available.filter(({ sameCast }) => sameCast).sort(compareCandidates);
  const fallback = available.filter(({ sameCast }) => !sameCast).sort(compareCandidates);
  return [...sameCast, ...fallback];
}

export function takePeerBatch(ranked, seenIndexes = [], batchSize = 5) {
  const candidates = Array.isArray(ranked) ? ranked : [];
  const validIndexes = new Set(candidates.map(({ index }) => index));
  let seen = new Set([...seenIndexes].filter((index) => validIndexes.has(index)));
  let available = candidates.filter(({ index }) => !seen.has(index));
  const restarted = candidates.length > 0 && available.length === 0 && seen.size > 0;
  if (restarted) {
    seen = new Set();
    available = candidates;
  }
  const size = Number.isSafeInteger(batchSize) && batchSize > 0 ? batchSize : 5;
  const items = available.slice(0, size);
  items.forEach(({ index }) => seen.add(index));
  return {
    items,
    seenIndexes: [...seen],
    exhausted: candidates.length > 0 && seen.size >= candidates.length,
    remaining: Math.max(0, candidates.length - seen.size),
    restarted,
  };
}

export function describePeerMatch({
  candidate,
  myStance,
  myCast,
  castName,
  candidateCastName = "",
  leftChoice,
  rightChoice,
}) {
  const stance = finiteStance(myStance);
  const candidateStance = finiteStance(candidate?.stance);
  const distance = Math.abs(candidateStance - stance);
  const similarityScore = Math.round((1 - Math.min(2, distance) / 2) * 100);
  const interestWord = candidate?.interest?.score >= 0.34
    ? candidate.interest.word
    : "";
  const sameCast = candidate?.cast === myCast;
  let similarity = sameCast && castName
    ? `同属「${castName}」，本题立场相似 ${similarityScore} / 100`
    : `本题立场相似 ${similarityScore} / 100`;
  if (interestWord) similarity += `，兴趣「${interestWord}」也有交集`;

  let stanceDifference;
  if (distance <= 0.03) {
    stanceDifference = "立场几乎重合，观点切入角度不同";
  } else {
    const direction = candidateStance < stance ? leftChoice : rightChoice;
    stanceDifference = `TA 比你${distance < 0.3 ? "略" : "更"}偏向「${direction}」`;
  }
  const difference = sameCast
    ? stanceDifference
    : `TA 呈现「${candidateCastName || "另一派"}」人格，${stanceDifference}`;
  return { similarity, difference };
}
