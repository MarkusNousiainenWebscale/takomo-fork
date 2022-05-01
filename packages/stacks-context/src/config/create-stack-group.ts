import { CommandContext } from "@takomo/core"
import { StackGroup, StackGroupDefaults } from "@takomo/stacks-model"
import { TkmLogger } from "@takomo/util"
import { ModuleContext } from "../model"
import { StackGroupConfigNode } from "./config-tree"
import { createRootStackGroup } from "./create-root-stack-group"
import { createStackGroupFromParent } from "./create-stack-group-from-parent"
import { createVariablesForStackGroupConfigFile } from "./create-variables-for-stack-group-config-file"
import { populatePropertiesFromConfigFile } from "./populate-properties-from-config-file"

export const doCreateStackGroup = async (
  ctx: CommandContext,
  logger: TkmLogger,
  node: StackGroupConfigNode,
  moduleContext: ModuleContext,
  stackGroupDefaults: StackGroupDefaults,
  parent?: StackGroup,
): Promise<StackGroup> => {
  const stackGroupConfig = parent
    ? createStackGroupFromParent(node, parent, moduleContext.moduleInformation)
    : createRootStackGroup(moduleContext.moduleInformation, stackGroupDefaults)

  const stackGroupVariables = createVariablesForStackGroupConfigFile(
    ctx.variables,
    stackGroupConfig,
    parent,
  )

  return populatePropertiesFromConfigFile(
    ctx,
    moduleContext.schemaRegistry,
    logger,
    stackGroupVariables,
    stackGroupConfig,
    node,
  )
}
