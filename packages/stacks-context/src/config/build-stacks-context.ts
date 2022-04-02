import { CredentialManager } from "@takomo/aws-clients"
import { IamRoleArn } from "@takomo/aws-model"
import {
  AdditionalConfigurationLocations,
  InternalCommandContext,
} from "@takomo/core"
import { createHookRegistry, HookRegistry } from "@takomo/stacks-hooks"
import {
  CommandPath,
  createSchemaRegistry,
  getStackPath,
  InternalStacksContext,
  ModuleInformation,
  normalizeStackPath,
  ROOT_STACK_GROUP_PATH,
  SchemaRegistry,
  StackGroupPath,
  StackPath,
} from "@takomo/stacks-model"
import {
  coreResolverProviders,
  ResolverRegistry,
} from "@takomo/stacks-resolvers"
import { arrayToMap, collectFromHierarchy, TkmLogger } from "@takomo/util"
import { isStackGroupPath } from "../common"
import {
  CommandPathMatchesNoStacksError,
  StacksConfigRepository,
} from "../model"
import { collectModules } from "./collect-modules"
import { collectStackGroups } from "./collect-stack-groups"
import { collectStacks } from "./collect-stacks"
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

interface BuildChildConfigContextInput extends BuildConfigContextInput {
  readonly hookRegistry: HookRegistry
  readonly resolverRegistry: ResolverRegistry
  readonly schemaRegistry: SchemaRegistry
  readonly credentialManagers: Map<IamRoleArn, CredentialManager>
  readonly additionalConfiguration: AdditionalConfigurationLocations
  readonly moduleInformation: ModuleInformation
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

export const buildStacksContext = async (
  props: BuildConfigContextInput,
): Promise<InternalStacksContext> => {
  const { logger, ctx } = props
  logger.info("Load configuration")

  const hookRegistry = createHookRegistry({ logger })
  for (const p of coreHookProviders()) {
    await hookRegistry.registerBuiltInProvider(p)
  }

  const resolverRegistry = new ResolverRegistry(logger)
  coreResolverProviders().forEach((p) =>
    resolverRegistry.registerBuiltInProvider(p),
  )

  const schemaRegistry = createSchemaRegistry(logger)

  const credentialManagers = new Map<IamRoleArn, CredentialManager>()

  return buildChildStacksContext({
    ...props,
    hookRegistry,
    resolverRegistry,
    schemaRegistry,
    credentialManagers,
    additionalConfiguration: ctx.projectConfig,
    moduleInformation: {
      path: ROOT_STACK_GROUP_PATH,
      name: "",
      stackPathPrefix: "",
      stackNamePrefix: "",
      isRoot: true,
    },
  })
}

export const buildChildStacksContext = async ({
  ctx,
  logger,
  credentialManager,
  commandPath,
  configRepository,
  hookRegistry,
  resolverRegistry,
  schemaRegistry,
  credentialManagers,
  additionalConfiguration,
  moduleInformation,
}: BuildChildConfigContextInput): Promise<InternalStacksContext> => {
  const configTree = await configRepository.buildConfigTree()

  validateCommandPath(configTree, commandPath)

  additionalConfiguration.resolvers.forEach((config) => {
    resolverRegistry.registerProviderFromNpmPackage(config)
  })

  await configRepository.loadExtensions(
    resolverRegistry,
    hookRegistry,
    schemaRegistry,
  )

  const templateEngine = configRepository.templateEngine

  const rootStackGroup = await processConfigTree({
    ctx,
    logger,
    credentialManager,
    credentialManagers,
    resolverRegistry,
    schemaRegistry,
    hookRegistry,
    configTree,
    configRepository,
    commandPath: commandPath ?? ROOT_STACK_GROUP_PATH,
    moduleInformation,
  })

  const stackGroups = collectStackGroups(rootStackGroup)
  const stacks = collectStacks(stackGroups)
  const stacksByPath = arrayToMap(stacks, getStackPath)
  const modules = collectModules(stackGroups)

  await Promise.all(
    Array.from(credentialManagers.values()).map((cm) => cm.getCallerIdentity()),
  )

  const getStackGroup = (stackGroupPath: StackGroupPath) =>
    stackGroups.get(stackGroupPath)

  const getStackByExactPath = (
    path: StackPath,
    stackGroupPath?: StackGroupPath,
  ) => {
    const normalizedPath = stackGroupPath
      ? normalizeStackPath(stackGroupPath, path)
      : path

    const internalPath = moduleInformation.stackPathPrefix + normalizedPath

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

    const internalPath = moduleInformation.stackPathPrefix + normalizedPath

    return stacks.filter((s) => s.path.startsWith(internalPath))
  }

  const getStackTemplateContents = configRepository.getStackTemplateContents

  return {
    ...ctx,
    moduleInformation,
    credentialManager,
    templateEngine,
    rootStackGroup,
    stacks,
    modules,
    getStackGroup,
    getStackByExactPath,
    getStacksByPath,
    getStackTemplateContents,
    concurrentStacks: 20,
  }
}
