import { AnimatedSection } from "./AnimatedSection"
import { FeatureGroup, groupNumber } from "./FeatureGroup"
import { FEATURE_GROUPS } from "./featureGroups"

export function FeatureIndex() {
  return (
    <div className="flex flex-col gap-12">
      {FEATURE_GROUPS.map((group, index) => (
        <AnimatedSection key={group.id}>
          <FeatureGroup group={group} number={groupNumber(index)} />
        </AnimatedSection>
      ))}
    </div>
  )
}
