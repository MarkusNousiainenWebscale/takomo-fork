import {
  createStackGroup,
  ModuleInformation,
  ROOT_STACK_GROUP_PATH,
  StackGroup,
} from "@takomo/stacks-model"

export const createRootStackGroup = (
  moduleInformation: ModuleInformation,
): StackGroup =>
  createStackGroup({
    name: ROOT_STACK_GROUP_PATH,
    regions: [],
    tags: new Map(),
    path: ROOT_STACK_GROUP_PATH,
    children: [],
    stacks: [],
    modules: [],
    data: {},
    hooks: [],
    accountIds: [],
    ignore: false,
    obsolete: false,
    terminationProtection: false,
    moduleInformation,
  })
