import {
  InternalModule,
  StackGroup,
  StackGroupPath,
} from "@takomo/stacks-model"

export const collectModules = (
  stackGroups: Map<StackGroupPath, StackGroup>,
): ReadonlyArray<InternalModule> =>
  Array.from(stackGroups.values()).reduce(
    (collected, stackGroup) => [...collected, ...stackGroup.modules],
    new Array<InternalModule>(),
  )
