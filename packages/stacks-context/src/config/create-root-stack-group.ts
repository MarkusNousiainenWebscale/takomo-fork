import {
  createStackGroup,
  ModuleInformation,
  ROOT_STACK_GROUP_PATH,
  StackGroup,
  StackGroupDefaults,
} from "@takomo/stacks-model"

export const createRootStackGroup = (
  moduleInformation: ModuleInformation,
  stackGroupDefaults: StackGroupDefaults,
): StackGroup => {
  const { tags, obsolete, ignore, terminationProtection, accountIds, regions } =
    stackGroupDefaults

  return createStackGroup({
    tags,
    ignore,
    obsolete,
    moduleInformation,
    terminationProtection,
    accountIds,
    regions,
    name: ROOT_STACK_GROUP_PATH,
    path: ROOT_STACK_GROUP_PATH,
    children: [],
    stacks: [],
    modules: [],
    data: {},
    hooks: [],
  })
}
