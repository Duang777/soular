function representativeScore(person) {
  const votes = person?.[6];
  return Number.isFinite(votes) ? votes : -1;
}

export function buildPersonaCatalog(casts, people) {
  if (!casts || typeof casts !== "object" || !Array.isArray(people)) return [];

  const validPeople = people
    .map((person, index) => ({ person, index }))
    .filter(({ person }) =>
      Array.isArray(person) &&
      typeof person[2] === "string" &&
      Object.hasOwn(casts, person[2])
    );

  return Object.entries(casts).flatMap(([key, definition]) => {
    if (!Array.isArray(definition) || definition.length < 3) return [];
    const members = validPeople.filter(({ person }) => person[2] === key);
    if (!members.length) return [];

    const representative = members.reduce((best, candidate) =>
      representativeScore(candidate.person) > representativeScore(best.person)
        ? candidate
        : best
    );

    return [{
      key,
      name: definition[0],
      role: definition[1],
      color: definition[2],
      portrait: definition[3],
      description: definition[4],
      count: members.length,
      share: validPeople.length ? members.length / validPeople.length : 0,
      representative: {
        index: representative.index,
        name: representative.person[0],
        stance: representative.person[1],
        claim: representative.person[3],
        sourceUrl: representative.person[4],
        votes: representative.person[6],
      },
    }];
  });
}

export function cyclePersonaIndex(currentIndex, offset, length) {
  if (!Number.isInteger(length) || length <= 0) return -1;
  const start = Number.isInteger(currentIndex) && currentIndex >= 0
    ? currentIndex
    : 0;
  return ((start + offset) % length + length) % length;
}
