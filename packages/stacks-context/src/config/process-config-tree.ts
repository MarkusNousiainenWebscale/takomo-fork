import { CredentialManager } from "@takomo/aws-clients"
import { IamRoleArn } from "@takomo/aws-model"
import { InternalCommandContext } from "@takomo/core"
import { HookRegistry } from "@takomo/stacks-hooks"
import {
  CommandPath,
  createStackGroup,
  InternalModule,
  InternalStack,
  isWithinCommandPath,
  ModuleInformation,
  ModulePath,
  normalizeStackPath,
  ROOT_STACK_GROUP_PATH,
  SchemaRegistry,
  StackGroup,
  StackGroupPath,
  StackPath,
} from "@takomo/stacks-model"
import { ResolverRegistry } from "@takomo/stacks-resolvers"
import { arrayToMap, TkmLogger } from "@takomo/util"
import R from "ramda"
import {
  checkCyclicDependencies,
  checkObsoleteDependencies,
  processStackDependencies,
} from "../dependencies"
import { StacksConfigRepository } from "../model"
import { buildModule } from "./build-module"
import { buildStack } from "./build-stack"
import { ConfigTree, StackGroupConfigNode } from "./config-tree"
import { doCreateStackGroup } from "./create-stack-group"

export class ProcessStatus {
  readonly #stackGroups = new Map<StackGroupPath, StackGroup>()
  readonly #stacks = new Map<StackPath, InternalStack>()
  readonly #newStacks = new Map<StackPath, InternalStack>()
  readonly #newModules = new Map<ModulePath, InternalModule>()
  readonly #modules = new Map<ModulePath, InternalModule>()

  getRootStackGroup = (): StackGroup =>
    this.getStackGroup(ROOT_STACK_GROUP_PATH)

  isStackGroupProcessed = (path: StackGroupPath): boolean =>
    this.#stackGroups.has(path)

  isStackProcessed = (path: StackPath): boolean => this.#stacks.has(path)

  isModuleProcessed = (path: ModulePath): boolean => this.#modules.has(path)

  setStackGroupProcessed = (stackGroup: StackGroup): void => {
    this.#stackGroups.set(stackGroup.path, stackGroup)
  }

  setStackProcessed = (stack: InternalStack): void => {
    this.#stacks.set(stack.path, stack)
    this.#newStacks.set(stack.path, stack)
  }

  setModuleProcessed = (module: InternalModule): void => {
    this.#modules.set(module.path, module)
    this.#newModules.set(module.path, module)
  }

  getStackGroup = (path: StackGroupPath): StackGroup => {
    const stackGroup = this.#stackGroups.get(path)
    if (!stackGroup) {
      throw new Error(`Stack group '${path}' is not processed`)
    }

    return stackGroup
  }

  getNewlyProcessedStacks = (): InternalStack[] =>
    Array.from(this.#newStacks.values())
  getStackGroups = (): StackGroup[] => Array.from(this.#stackGroups.values())
  getStacks = (): InternalStack[] => Array.from(this.#stacks.values())
  getModules = (): InternalModule[] => Array.from(this.#modules.values())

  reset = (): void => {
    this.#newStacks.clear()
    this.#newModules.clear()
  }
}

const populateChildrenAndStacks = (
  stackGroup: StackGroup,
  allStacks: ReadonlyArray<InternalStack>,
  allStackGroups: ReadonlyArray<StackGroup>,
  allModules: ReadonlyArray<InternalModule>,
): StackGroup => {
  const children = allStackGroups
    .filter((sg) => sg.parentPath === stackGroup.path)
    .map((child) =>
      populateChildrenAndStacks(child, allStacks, allStackGroups, allModules),
    )

  const stacks = allStacks
    .filter((s) => s.stackGroupPath === stackGroup.path)
    .filter((s) => !s.ignore)

  const modules = allModules.filter((m) => m.parent.path === stackGroup.path)

  return createStackGroup({
    ...stackGroup.toProps(),
    stacks,
    children,
    modules,
  })
}

interface ProcessStackGroupConfigNodeProps {
  readonly ctx: InternalCommandContext
  readonly logger: TkmLogger
  readonly credentialManager: CredentialManager
  readonly credentialManagers: Map<IamRoleArn, CredentialManager>
  readonly resolverRegistry: ResolverRegistry
  readonly schemaRegistry: SchemaRegistry
  readonly hookRegistry: HookRegistry
  readonly commandPath: CommandPath
  readonly status: ProcessStatus
  readonly node: StackGroupConfigNode
  readonly configRepository: StacksConfigRepository
  readonly moduleInformation: ModuleInformation
}

const processStackGroupConfigNode = async ({
  ctx,
  logger,
  credentialManager,
  credentialManagers,
  resolverRegistry,
  schemaRegistry,
  hookRegistry,
  commandPath,
  status,
  node,
  configRepository,
  moduleInformation,
}: ProcessStackGroupConfigNodeProps): Promise<void> => {
  logger.trace(`Process stack group config node with path '${node.path}'`)
  if (!isWithinCommandPath(commandPath, node.path)) {
    logger.trace(
      `Stack group config node with path '${node.path}' is not within command path '${commandPath}'`,
    )
    return
  }

  if (!status.isStackGroupProcessed(node.path)) {
    logger.trace(
      `Stack group config node with path '${node.path}' is not yet processed`,
    )
    const parent = node.parentPath
      ? status.getStackGroup(node.parentPath)
      : undefined

    const stackGroup = await doCreateStackGroup(
      ctx,
      logger,
      node,
      schemaRegistry,
      parent,
    )

    status.setStackGroupProcessed(stackGroup)
  } else {
    logger.trace(
      `Stack group config node with path '${node.path}' is already processed`,
    )
  }

  const currentStackGroup = status.getStackGroup(node.path)

  const modulesToProcess = currentStackGroup.ignore
    ? []
    : node.modules
        .filter((item) => isWithinCommandPath(commandPath, item.path))
        .filter((item) => !status.isModuleProcessed(item.path))

  const processedModules = await Promise.all(
    modulesToProcess.map((moduleConfigNode) =>
      buildModule({
        ctx,
        logger,
        credentialManagers,
        moduleConfigNode,
        configRepository,
        hookRegistry,
        resolverRegistry,
        schemaRegistry,
        parentModuleInformation: moduleInformation,
        stackGroup: currentStackGroup,
        defaultCredentialManager: credentialManager,
      }),
    ),
  )

  processedModules.forEach(status.setModuleProcessed)

  const stacksToProcess = currentStackGroup.ignore
    ? []
    : node.stacks
        .filter((item) => isWithinCommandPath(commandPath, item.path))
        .filter((item) => !status.isStackProcessed(item.path))

  const processedStacks = await Promise.all(
    stacksToProcess.map((stack) =>
      buildStack(
        ctx,
        logger,
        credentialManager,
        credentialManagers,
        resolverRegistry,
        schemaRegistry,
        hookRegistry,
        stack,
        status.getStackGroup(node.path),
        commandPath,
        status,
        moduleInformation,
      ),
    ),
  )

  processedStacks.flat().forEach(status.setStackProcessed)
  const childrenToProcess = node.children.filter((child) =>
    isWithinCommandPath(commandPath, child.path),
  )

  await Promise.all(
    childrenToProcess.map((child) =>
      processStackGroupConfigNode({
        ctx,
        logger,
        credentialManager,
        credentialManagers,
        resolverRegistry,
        schemaRegistry,
        hookRegistry,
        commandPath,
        status,
        node: child,
        configRepository,
        moduleInformation,
      }),
    ),
  )
}

interface ProcessConfigTreeProps {
  readonly ctx: InternalCommandContext
  readonly logger: TkmLogger
  readonly credentialManager: CredentialManager
  readonly credentialManagers: Map<IamRoleArn, CredentialManager>
  readonly resolverRegistry: ResolverRegistry
  readonly schemaRegistry: SchemaRegistry
  readonly hookRegistry: HookRegistry
  readonly commandPath: CommandPath
  readonly configTree: ConfigTree
  readonly configRepository: StacksConfigRepository
  readonly moduleInformation: ModuleInformation
}

export const processConfigTree = async ({
  ctx,
  logger,
  credentialManager,
  credentialManagers,
  resolverRegistry,
  schemaRegistry,
  hookRegistry,
  commandPath,
  configTree,
  configRepository,
  moduleInformation,
}: ProcessConfigTreeProps): Promise<StackGroup> => {
  const item = configTree.rootStackGroup
  const status = new ProcessStatus()

  let commandPaths = [commandPath]
  while (commandPaths.length > 0) {
    logger.traceObject("Command paths to process:", () => commandPaths)
    for (const cp of commandPaths) {
      logger.trace(`Process config tree using command path: ${cp}`)
      await processStackGroupConfigNode({
        ctx,
        logger,
        credentialManager,
        credentialManagers,
        resolverRegistry,
        schemaRegistry,
        hookRegistry,
        commandPath: cp,
        status,
        node: item,
        configRepository,
        moduleInformation,
      })
    }

    commandPaths = R.uniq(
      status
        .getNewlyProcessedStacks()
        .filter((s) => !s.ignore)
        .reduce((collected, stack) => {
          const parameterDependencies = Array.from(stack.parameters.values())
            .map((p) =>
              p
                .getDependencies()
                .map((d) => normalizeStackPath(stack.stackGroupPath, d)),
            )
            .flat()

          return [...collected, ...stack.dependencies, ...parameterDependencies]
        }, new Array<StackPath>()),
    )

    status.reset()
  }

  const allStacks = processStackDependencies(status.getStacks())
  const allStackGroups = status.getStackGroups()
  const root = status.getRootStackGroup()
  const stacksByPath = arrayToMap(allStacks, (s) => s.path)
  const allModules = status.getModules()

  checkCyclicDependencies(stacksByPath)
  checkObsoleteDependencies(stacksByPath)

  return populateChildrenAndStacks(root, allStacks, allStackGroups, allModules)
}
