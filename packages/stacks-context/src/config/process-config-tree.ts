import { CredentialManager } from "@takomo/aws-clients"
import { IamRoleArn } from "@takomo/aws-model"
import { InternalCommandContext } from "@takomo/core"
import {
  CommandPath,
  createStackGroup,
  getModulePath,
  getStackPath,
  InternalModule,
  InternalStack,
  isWithinCommandPath,
  ModulePath,
  normalizeStackPath,
  StackGroup,
  StackGroupDefaults,
  StackGroupPath,
  StackPath,
} from "@takomo/stacks-model"
import { arrayToMap, TkmLogger } from "@takomo/util"
import R from "ramda"
import {
  checkCyclicDependencies,
  checkObsoleteDependencies,
  processModuleDependencies,
  processStackDependencies,
} from "../dependencies"
import { ModuleContext } from "../model"
import { buildModule } from "./build-module"
import { buildStack } from "./build-stack"
import { ConfigTree, StackGroupConfigNode } from "./config-tree"
import { doCreateStackGroup } from "./create-stack-group"

export class ProcessStatus {
  readonly #stackGroups = new Map<StackGroupPath, StackGroup>()
  readonly #stacks = new Map<StackPath, InternalStack>()
  readonly #newStacks = new Map<StackPath, InternalStack>()
  readonly #modules = new Map<StackPath, InternalModule>()
  readonly #newModules = new Map<StackPath, InternalModule>()

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
    this.#modules.set(module.moduleInformation.path, module)
    this.#newModules.set(module.moduleInformation.path, module)
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
  getNewlyProcessedModules = (): InternalModule[] =>
    Array.from(this.#newModules.values())
  getStackGroups = (): StackGroup[] => Array.from(this.#stackGroups.values())
  getStacks = (): InternalStack[] => Array.from(this.#stacks.values())
  getModules = (): InternalModule[] => Array.from(this.#modules.values())

  reset = (): void => {
    this.#newStacks.clear()
    this.#newModules.clear()
  }
}

export const populateChildrenAndStacks = (
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

  const modules = allModules
    .filter((m) => m.parentPath === stackGroup.path)
    .filter((m) => !m.moduleInformation.ignore)

  const stacks = allStacks
    .filter((s) => s.stackGroupPath === stackGroup.path)
    .filter((s) => !s.ignore)

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
  readonly commandPath: CommandPath
  readonly status: ProcessStatus
  readonly node: StackGroupConfigNode
  readonly moduleContext: ModuleContext
  readonly stackGroupDefaults: StackGroupDefaults
}

const processStackGroupConfigNode = async ({
  ctx,
  logger,
  credentialManager,
  credentialManagers,
  commandPath,
  status,
  node,
  moduleContext,
  stackGroupDefaults,
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
      moduleContext,
      stackGroupDefaults,
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
        moduleContext,
        parent: currentStackGroup,
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
        stack,
        status.getStackGroup(node.path),
        commandPath,
        status,
        moduleContext,
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
        commandPath,
        status,
        moduleContext,
        node: child,
        stackGroupDefaults: stackGroupDefaults,
      }),
    ),
  )
}

interface ProcessConfigTreeProps {
  readonly ctx: InternalCommandContext
  readonly logger: TkmLogger
  readonly credentialManager: CredentialManager
  readonly credentialManagers: Map<IamRoleArn, CredentialManager>
  readonly commandPath: CommandPath
  readonly configTree: ConfigTree
  readonly moduleContext: ModuleContext
  readonly stackGroupDefaults: StackGroupDefaults
  readonly parentPath?: StackGroupPath
}

export const processConfigTree = async ({
  ctx,
  logger,
  credentialManager,
  credentialManagers,
  commandPath,
  configTree,
  moduleContext,
  parentPath,
  stackGroupDefaults,
}: ProcessConfigTreeProps): Promise<InternalModule> => {
  logger.debugObject(
    `Process config tree of module:`,
    moduleContext.moduleInformation,
  )

  const status = new ProcessStatus()

  const item = configTree.rootStackGroup

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
        status,
        moduleContext,
        stackGroupDefaults,
        commandPath: cp,
        node: item,
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

    // TODO: newly processed modules

    status.reset()
  }

  const allModules = status.getModules()
  const modulesByPath = arrayToMap(allModules, getModulePath)

  const allStacks = processStackDependencies(
    status.getStacks(),
    modulesByPath,
    false,
  )

  const processedModules = processModuleDependencies(
    allModules,
    allStacks,
    false,
  )

  const allStackGroups = status.getStackGroups()
  const rootStackGroup = status.getStackGroups().find((s) => s.root)
  const stacksByPath = arrayToMap(allStacks, getStackPath)

  const moduleByPath = arrayToMap(processedModules, getModulePath)

  checkCyclicDependencies(stacksByPath, moduleByPath)

  // TODO: Handle obsolete modules
  checkObsoleteDependencies(stacksByPath, moduleByPath)
  //
  // // TODO: Handle module dependencies and dependents
  //
  if (!rootStackGroup) {
    throw new Error(
      `Expected root stack group to exist with path: ${moduleContext.moduleInformation.path}`,
    )
  }

  const root = populateChildrenAndStacks(
    rootStackGroup,
    allStacks,
    allStackGroups,
    processedModules,
  )

  return {
    ...stackGroupDefaults,
    root,
    parentPath,
    moduleInformation: moduleContext.moduleInformation,
  }
}
