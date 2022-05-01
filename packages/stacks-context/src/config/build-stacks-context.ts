import { CredentialManager } from "@takomo/aws-clients"
import { IamRoleArn } from "@takomo/aws-model"
import { InternalCommandContext } from "@takomo/core"
import { createHookRegistry } from "@takomo/stacks-hooks"
import {
  CommandPath,
  createSchemaRegistry,
  getStackPath,
  getStackPaths,
  InternalStack,
  InternalStacksContext,
  ModuleInformation,
  normalizeStackPath,
  ROOT_STACK_GROUP_PATH,
  StackGroup,
  StackGroupPath,
  StackPath,
} from "@takomo/stacks-model"
import {
  coreResolverProviders,
  ResolverRegistry,
} from "@takomo/stacks-resolvers"
import { arrayToMap, collectFromHierarchy, TkmLogger } from "@takomo/util"
import { isStackGroupPath } from "../common"
import { processStackDependencies } from "../dependencies"
import {
  CommandPathMatchesNoStacksError,
  ModuleContext,
  StacksConfigRepository,
} from "../model"
import { ConfigTree } from "./config-tree"
import { coreHookProviders } from "./hooks"
import { processConfigTree } from "./process-config-tree"

export interface BuildConfigContextInput {
  readonly configRepository: StacksConfigRepository
  readonly ctx: InternalCommandContext
  readonly logger: TkmLogger
  readonly credentialManager: CredentialManager
  readonly commandPath?: CommandPath
  readonly ignoreDependencies?: boolean
}

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

interface CreateModuleContextProps {
  readonly logger: TkmLogger
  readonly moduleInformation: ModuleInformation
  readonly configRepository: StacksConfigRepository
}

export const createModuleContext = async ({
  moduleInformation,
  configRepository,
  logger,
}: CreateModuleContextProps): Promise<ModuleContext> => {
  const hookRegistry = createHookRegistry({ logger })
  for (const p of coreHookProviders()) {
    await hookRegistry.registerBuiltInProvider(p)
  }

  const resolverRegistry = new ResolverRegistry(logger)
  coreResolverProviders().forEach((p) =>
    resolverRegistry.registerBuiltInProvider(p),
  )

  const schemaRegistry = createSchemaRegistry(logger)

  return {
    moduleInformation,
    configRepository,
    resolverRegistry,
    schemaRegistry,
    hookRegistry,
    children: [],
  }
}

const collectStacks = (
  stackGroup: StackGroup,
): ReadonlyArray<InternalStack> => {
  const children = [
    ...stackGroup.children,
    ...stackGroup.modules.map((m) => m.root),
  ]

  return children.reduce(
    (collected, child) => [...collected, ...collectStacks(child)],
    stackGroup.stacks,
  )
}

const collectStackGroups = (
  stackGroup: StackGroup,
): ReadonlyArray<StackGroup> =>
  collectFromHierarchy(stackGroup, (sg) => [
    ...sg.children,
    ...sg.modules.map((m) => m.root),
  ])

export const buildStacksContext = async (
  props: BuildConfigContextInput,
): Promise<InternalStacksContext> => {
  const { logger, ctx, configRepository, commandPath, credentialManager } =
    props
  logger.info("Load configuration")

  const moduleInformation: ModuleInformation = {
    path: ROOT_STACK_GROUP_PATH,
    name: "",
    stackPathPrefix: "",
    stackNamePrefix: "",
    isRoot: true,
  }

  const moduleContext = await createModuleContext({
    logger,
    moduleInformation,
    configRepository,
  })

  const credentialManagers = new Map<IamRoleArn, CredentialManager>()

  const configTree = await configRepository.buildConfigTree()

  validateCommandPath(configTree, commandPath)

  ctx.projectConfig.resolvers.forEach((config) => {
    moduleContext.resolverRegistry.registerProviderFromNpmPackage(config)
  })

  await configRepository.loadExtensions(
    moduleContext.resolverRegistry,
    moduleContext.hookRegistry,
    moduleContext.schemaRegistry,
  )

  const rootModule = await processConfigTree({
    ctx,
    logger,
    credentialManager,
    credentialManagers,
    configTree,
    moduleContext,
    commandPath: commandPath ?? ROOT_STACK_GROUP_PATH,
  })

  await Promise.all(
    Array.from(credentialManagers.values()).map((cm) => cm.getCallerIdentity()),
  )

  // const allModules = status.getModules()
  // const allStacks = processStackDependencies(status.getStacks(), allModules)
  // const allStackGroups = status.getStackGroups()
  // const stacksByPath = arrayToMap(allStacks, getStackPath)
  //
  // checkCyclicDependencies(stacksByPath)
  // checkObsoleteDependencies(stacksByPath)

  // TODO: Handle module dependencies and dependents

  const allStackGroups = collectStackGroups(rootModule.root)
  const allStacks = allStackGroups.map((sg) => sg.stacks).flat()
  const allModules = allStackGroups.map((sg) => sg.modules).flat()

  return createStacksContext({
    logger,
    ctx,
    moduleContext,
    credentialManager,
    allStackGroups, // TODO: Is this needed?
    allStacks: processStackDependencies(allStacks, allModules, true),
  })
}

interface CreateStacksContextProps {
  readonly ctx: InternalCommandContext
  readonly credentialManager: CredentialManager
  readonly moduleContext: ModuleContext
  readonly allStacks: ReadonlyArray<InternalStack>
  readonly allStackGroups: ReadonlyArray<StackGroup>
  readonly logger: TkmLogger
}

const createStacksContext = (
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
    rootStackGroup, // TODO: is this needed?
    stacks,
    children,
    moduleInformation,
    getStackByExactPath,
    getStacksByPath,
    getStackTemplateContents,
    concurrentStacks: 20,
  }
}
