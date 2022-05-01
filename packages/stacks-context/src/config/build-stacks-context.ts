import { CredentialManager } from "@takomo/aws-clients"
import { IamRoleArn } from "@takomo/aws-model"
import { InternalCommandContext } from "@takomo/core"
import {
  CommandPath,
  createRootModuleInformation,
  createStackGroupDefaults,
  getModulePath,
  InternalStack,
  InternalStacksContext,
  ROOT_STACK_GROUP_PATH,
  StackGroup,
} from "@takomo/stacks-model"
import { arrayToMap, collectFromHierarchy, TkmLogger } from "@takomo/util"
import { processStackDependencies } from "../dependencies"
import { StacksConfigRepository } from "../model"
import { createModuleContext } from "./create-module-context"
import { createStacksContext } from "./create-stacks-context"
import { processConfigTree } from "./process-config-tree"
import { validateCommandPath } from "./validate-command-path"

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

interface BuildStacksContextProps {
  readonly configRepository: StacksConfigRepository
  readonly ctx: InternalCommandContext
  readonly logger: TkmLogger
  readonly credentialManager: CredentialManager
  readonly commandPath?: CommandPath
  readonly ignoreDependencies?: boolean
}

export const buildStacksContext = async (
  props: BuildStacksContextProps,
): Promise<InternalStacksContext> => {
  const { logger, ctx, configRepository, commandPath, credentialManager } =
    props
  logger.info("Load configuration")

  const moduleInformation = createRootModuleInformation()

  const moduleContext = await createModuleContext({
    logger,
    moduleInformation,
    configRepository,
    additionalConfigurationLocations: ctx.projectConfig,
  })

  const credentialManagers = new Map<IamRoleArn, CredentialManager>()

  const configTree = await configRepository.buildConfigTree()

  validateCommandPath(configTree, commandPath)

  const rootModule = await processConfigTree({
    ctx,
    logger,
    credentialManager,
    credentialManagers,
    configTree,
    moduleContext,
    commandPath: commandPath ?? ROOT_STACK_GROUP_PATH,
    stackGroupDefaults: createStackGroupDefaults(),
  })

  await Promise.all(
    Array.from(credentialManagers.values()).map((cm) => cm.getCallerIdentity()),
  )

  // TODO: Handle module dependencies and dependents

  const allStackGroups = collectStackGroups(rootModule.root)
  const allStacks = allStackGroups.map((sg) => sg.stacks).flat()
  const allModules = allStackGroups.map((sg) => sg.modules).flat()
  const modulesByPath = arrayToMap(allModules, getModulePath)

  return createStacksContext({
    logger,
    ctx,
    moduleContext,
    credentialManager,
    allStackGroups, // TODO: Is this needed?
    allStacks: processStackDependencies(allStacks, modulesByPath, true),
  })
}
