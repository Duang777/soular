import type { ComponentProps } from "react";
import { EmberStorm as ThreeUiEmberStorm } from "@designcodeio/threeui/components/EmberStorm";
import { FluidFieldBackground as ThreeUiFluidFieldBackground } from "@designcodeio/threeui/components/FluidFieldBackground";
import { NebulaBackground as ThreeUiNebulaBackground } from "@designcodeio/threeui/components/NebulaBackground";

export type NeuformCraftEffectProps = ComponentProps<typeof ThreeUiNebulaBackground>;
export const NebulaBackground = ThreeUiNebulaBackground;
export const FluidFieldBackground = ThreeUiFluidFieldBackground;
export const EmberStorm = ThreeUiEmberStorm;
