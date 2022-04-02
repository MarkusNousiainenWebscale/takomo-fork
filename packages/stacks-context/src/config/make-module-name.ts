import { StackName } from "@takomo/aws-model"
import { Project } from "@takomo/core"
import { ModulePath } from "@takomo/stacks-model"

export const makeModuleName = (
  modulePath: ModulePath,
  project?: Project,
): StackName => {
  const prefix = project ? `${project}-` : ""
  const cleanedStackPath = modulePath.slice(1)
  return `${prefix}${cleanedStackPath}`
    .replace(/\//g, "-")
    .replace(/\.module\.yml$/, "")
}
