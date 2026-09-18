import { lazy, Suspense, type ComponentProps } from "react";
import { TextAnimationCollection as ThreeUiTextAnimationCollection } from "@designcodeio/threeui/components/TextAnimationCollection";

export type TextAnimationCollectionProps = ComponentProps<typeof ThreeUiTextAnimationCollection>;

const ParticleWordmarkVariant = lazy(() =>
  import("../neuform-isolated/NeuformIsolatedEffects").then((module) => ({
    default: module.ParticleWordmark,
  })),
);

const FALLBACK = <div className="threeui-background" style={{ background: "#090909" }} />;

export function TextAnimationCollection(props: TextAnimationCollectionProps) {
  if (props.variant === "particle-wordmark") {
    const { variant: _variant, ...variantProps } = props;
    return (
      <Suspense fallback={FALLBACK}>
        <ParticleWordmarkVariant {...variantProps} />
      </Suspense>
    );
  }

  return <ThreeUiTextAnimationCollection {...props} />;
}
