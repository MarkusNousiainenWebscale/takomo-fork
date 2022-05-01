import { StackName } from "@takomo/aws-model"
import R from "ramda"
import { CommandPath } from "./command"
import { InternalModule, ModulePath } from "./module"
import { InternalStack, Stack, StackPath } from "./stack"
import { StackGroup, StackGroupPath } from "./stack-group"

/**
 * @hidden
 */
export const getStackPath = ({ path }: Stack): StackPath => path

/**
 * @hidden
 */
export const getStackName = ({ name }: Stack): StackName => name

/**
 * @hidden
 */
export const getStackPaths: (
  stacks: ReadonlyArray<Stack>,
) => ReadonlyArray<StackPath> = R.map(getStackPath)

/**
 * @hidden
 */
export const getStackNames: (
  stacks: ReadonlyArray<Stack>,
) => ReadonlyArray<StackName> = R.map(getStackName)

/**
 * @hidden
 */
export const getStackGroupPath = (stackGroup: StackGroup): StackGroupPath =>
  stackGroup.path

/**
 * @hidden
 */
export const isObsolete = (stack: InternalStack): boolean => stack.obsolete

/**
 * @hidden
 */
export const isNotObsolete = (stack: InternalStack): boolean =>
  !isObsolete(stack)

/**
 * @hidden
 */
export const isWithinCommandPath = (
  commandPath: CommandPath,
  other: CommandPath,
): boolean => commandPath.startsWith(other.substr(0, commandPath.length))

/**
 * @hidden
 */
export const getModulePath = (module: InternalModule): ModulePath =>
  module.moduleInformation.path

/**
 * @hidden
 */
export const isModulePath = (commandPath: CommandPath): boolean =>
  commandPath.endsWith(".module.yml")

/**
 * @hidden
 */
export const isStackPath = (commandPath: CommandPath): boolean => {
  if (isModulePath(commandPath)) {
    return false
  }
  if (commandPath.endsWith(".yml")) {
    return true
  }
  const parts = commandPath.split("/")
  if (parts.length < 2) {
    return false
  }
  const part = parts.slice(-2, -1)[0]
  if (isModulePath(part)) {
    return false
  }

  return part.endsWith(".yml")
}

/**
 * @hidden
 */
export const isStackGroupPath = (commandPath: CommandPath): boolean =>
  !(isModulePath(commandPath) || isStackPath(commandPath))
