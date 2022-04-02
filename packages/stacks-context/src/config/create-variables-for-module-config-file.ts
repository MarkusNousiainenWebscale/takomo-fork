import { Variables } from "@takomo/core"
import { ModulePath, StackGroup } from "@takomo/stacks-model"
import path from "path"
import { getVariablesForStackGroup } from "./get-variables-for-stack-group"

export const createVariablesForModuleConfigFile = (
  variables: Variables,
  stackGroup: StackGroup,
  modulePath: ModulePath,
): any => {
  const stackGroupVariables = getVariablesForStackGroup(stackGroup)
  const filePath = modulePath.slice(1)
  return {
    ...variables,
    stack: {
      path: modulePath,
      pathSegments: modulePath.slice(1).split("/"),
      configFile: {
        filePath,
        basename: path.basename(filePath),
        name: path.basename(filePath, ".module.yml"),
        dirPath: stackGroup.path.slice(1),
      },
    },
    parent: stackGroupVariables,
  }
}
