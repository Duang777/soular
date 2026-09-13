const LOD_PROFILES = Object.freeze({
  near: Object.freeze({
    avatarSize: 256,
    starsRatio: 1,
    dustRatio: 1,
    bloomRatio: 1,
    bloomEnabled: true,
  }),
  medium: Object.freeze({
    avatarSize: 128,
    starsRatio: 0.72,
    dustRatio: 0.82,
    bloomRatio: 0.82,
    bloomEnabled: true,
  }),
  far: Object.freeze({
    avatarSize: 64,
    starsRatio: 0.42,
    dustRatio: 0.52,
    bloomRatio: 0.62,
    bloomEnabled: false,
  }),
});

const NEAR_ENTER_DISTANCE = 8.4;
const NEAR_EXIT_DISTANCE = 9.2;
const FAR_EXIT_DISTANCE = 12.2;
const FAR_ENTER_DISTANCE = 13.2;

export const NEBULA_PARTICLE_LAYER_SCHEMA = Object.freeze({
  farStars: "farStars",
  haloStars: "haloStars",
  armDust: "armDust",
  brightDust: "brightDust",
});
const STAR_PARTICLE_LAYERS = new Set([
  NEBULA_PARTICLE_LAYER_SCHEMA.farStars,
  NEBULA_PARTICLE_LAYER_SCHEMA.haloStars,
]);

export function getNebulaLodProfile(tier) {
  return LOD_PROFILES[tier] || LOD_PROFILES.medium;
}

export function resolveDistanceLod(distance, currentTier = "medium") {
  if (!Number.isFinite(distance)) {
    return Object.hasOwn(LOD_PROFILES, currentTier) ? currentTier : "medium";
  }
  if (currentTier === "near") {
    if (distance >= FAR_ENTER_DISTANCE) return "far";
    return distance > NEAR_EXIT_DISTANCE ? "medium" : "near";
  }
  if (currentTier === "far") {
    if (distance <= NEAR_ENTER_DISTANCE) return "near";
    return distance < FAR_EXIT_DISTANCE ? "medium" : "far";
  }
  if (distance <= NEAR_ENTER_DISTANCE) return "near";
  if (distance >= FAR_ENTER_DISTANCE) return "far";
  return "medium";
}

export function visibleParticleBudget(quality, tier) {
  const profile = getNebulaLodProfile(tier);
  const count = (value, ratio) => Math.max(0, Math.floor((Number(value) || 0) * ratio));
  const budget = Object.fromEntries(
    Object.values(NEBULA_PARTICLE_LAYER_SCHEMA).map((key) => [
      key,
      count(
        quality[key],
        STAR_PARTICLE_LAYERS.has(key) ? profile.starsRatio : profile.dustRatio,
      ),
    ]),
  );
  return {
    ...budget,
    total: Object.values(budget).reduce((sum, value) => sum + value, 0),
  };
}
