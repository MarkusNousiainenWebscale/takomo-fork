import { CredentialManager } from "@takomo/aws-clients"
import { InternalCommandContext } from "@takomo/core"
import {
  getStackPath,
  getStackPaths,
  InternalStack,
  InternalStacksContext,
  normalizeStackPath,
  StackGroup,
  StackGroupPath,
  StackPath,
} from "@takomo/stacks-model"
import { arrayToMap, TkmLogger } from "@takomo/util"
import { ModuleContext } from "../model"

interface CreateStacksContextProps {
  readonly ctx: InternalCommandContext
  readonly credentialManager: CredentialManager
  readonly moduleContext: ModuleContext
  readonly allStacks: ReadonlyArray<InternalStack>
  readonly allStackGroups: ReadonlyArray<StackGroup>
  readonly logger: TkmLogger
}

export const createStacksContext = (
  props: CreateStacksContextProps,
): InternalStacksContext => {
  const {
    ctx,
    moduleContext,
    credentialManager,
    allStacks,
    allStackGroups,
    logger,
  } = props

  logger.debugObject(
    `Create stacks context for module:`,
    moduleContext.moduleInformation,
  )

  const stacks = allStacks.filter((s) =>
    s.path.startsWith(moduleContext.moduleInformation.path),
  )

  logger.debugObject(`Stacks:`, () => getStackPaths(stacks))

  const stackGroups = allStackGroups.filter(
    (sg) => sg.moduleInformation.path === moduleContext.moduleInformation.path,
  )

  logger.debugObject(`Stacks groups:`, () => stackGroups.map((sg) => sg.path))

  const rootStackGroup = stackGroups.find((sg) => sg.root)
  if (!rootStackGroup) {
    throw new Error(`Module stack group not found`)
  }

  const stacksByPath = arrayToMap(stacks, getStackPath)
  const templateEngine = moduleContext.configRepository.templateEngine

  const getStackByExactPath = (
    path: StackPath,
    stackGroupPath?: StackGroupPath,
  ) => {
    const normalizedPath = stackGroupPath
      ? normalizeStackPath(stackGroupPath, path)
      : path

    const internalPath =
      moduleContext.moduleInformation.stackPathPrefix + normalizedPath

    const stack = stacksByPath.get(internalPath)
    if (!stack) {
      throw new Error(`No stack found with path: ${path}`)
    }

    return stack
  }

  const getStacksByPath = (
    path: StackPath,
    stackGroupPath?: StackGroupPath,
  ) => {
    const normalizedPath = stackGroupPath
      ? normalizeStackPath(stackGroupPath, path)
      : path

    const internalPath =
      moduleContext.moduleInformation.stackPathPrefix + normalizedPath

    return stacks.filter((s) => s.path.startsWith(internalPath))
  }

  const getStackTemplateContents =
    moduleContext.configRepository.getStackTemplateContents

  const children = moduleContext.children.map((child) =>
    createStacksContext({
      logger,
      ctx,
      allStacks,
      allStackGroups,
      credentialManager,
      moduleContext: child,
    }),
  )

  const moduleInformation = moduleContext.moduleInformation

  return {
    ...ctx,
    ...moduleContext,
    credentialManager,
    templateEngine,
    stacks,
    children,
    rootStackGroup,
    moduleInformation,
    getStackByExactPath,
    getStacksByPath,
    getStackTemplateContents,
    concurrentStacks: 20,
  }
}
