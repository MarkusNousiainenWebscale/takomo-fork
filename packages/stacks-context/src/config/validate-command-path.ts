import {
  CommandPath,
  isStackGroupPath,
  ROOT_STACK_GROUP_PATH,
} from "@takomo/stacks-model"
import { collectFromHierarchy } from "@takomo/util"
import { CommandPathMatchesNoStacksError } from "../model"
import { ConfigTree } from "./config-tree"

export const validateCommandPath = (
  configTree: ConfigTree,
  commandPath?: CommandPath,
): void => {
  if (!commandPath || commandPath === ROOT_STACK_GROUP_PATH) {
    return
  }

  const stackGroups = collectFromHierarchy(
    configTree.rootStackGroup,
    (node) => node.children,
  )

  const stackGroupPaths = stackGroups.map((s) => s.path)
  const stackPaths = stackGroups
    .map((s) => s.stacks)
    .flat()
    .map((s) => s.path)

  if (isStackGroupPath(commandPath)) {
    if (!stackGroupPaths.some((s) => s === commandPath)) {
      throw new CommandPathMatchesNoStacksError(commandPath, stackPaths)
    }
  } else if (!stackGroupPaths.some((s) => s === commandPath)) {
    if (!stackPaths.some((s) => commandPath.startsWith(s))) {
      throw new CommandPathMatchesNoStacksError(commandPath, stackPaths)
    }
  }
}
