import { FeatureGroup, groupNumber } from "./FeatureGroup"
import { FEATURE_GROUPS } from "./featureGroups"

export function FeatureIndex() {
  return (
    <div className="flex flex-col gap-12">
      {FEATURE_GROUPS.map((group, index) => (
        <FeatureGroup key={group.id} group={group} number={groupNumber(index)} />
      ))}
    </div>
  )
}
