import { Variables } from "@takomo/core"
import { StackGroup, StackPath } from "@takomo/stacks-model"
import path from "path"
import { getVariablesForStackGroup } from "./get-variables-for-stack-group"

export const createVariablesForStackConfigFile = (
  variables: Variables,
  stackGroup: StackGroup,
  stackPath: StackPath,
): any => {
  const stackGroupVariables = getVariablesForStackGroup(stackGroup)
  const filePath = stackPath.slice(1)
  return {
    ...variables,
    stack: {
      path: stackPath,
      pathSegments: stackPath.slice(1).split("/"),
      configFile: {
        filePath,
        basename: path.basename(filePath),
        name: path.basename(filePath, ".yml"),
        dirPath: stackGroup.path.slice(1),
      },
    },
    stackGroup: stackGroupVariables, // TODO: Remove stackGroup variable in the next major version in favor of parent
    parent: stackGroupVariables,
  }
}
