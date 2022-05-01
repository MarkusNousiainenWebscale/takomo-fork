import { CredentialManager } from "@takomo/aws-clients"
import { IamRoleArn } from "@takomo/aws-model"
import { InternalCommandContext } from "@takomo/core"
import {
  InternalModule,
  ROOT_STACK_GROUP_PATH,
  StackGroup,
} from "@takomo/stacks-model"
import { TkmLogger } from "@takomo/util"
import { ModuleContext } from "../model"
import { ModuleConfigNode } from "./config-tree"
import { createModuleContext } from "./create-module-context"
import { createVariablesForModuleConfigFile } from "./create-variables-for-module-config-file"
import { processConfigTree } from "./process-config-tree"

interface BuildModuleProps {
  readonly ctx: InternalCommandContext
  readonly logger: TkmLogger
  readonly defaultCredentialManager: CredentialManager
  readonly credentialManagers: Map<IamRoleArn, CredentialManager>
  readonly moduleConfigNode: ModuleConfigNode
  readonly parent: StackGroup
  readonly moduleContext: ModuleContext
}

export const buildModule = async ({
  ctx,
  logger,
  credentialManagers,
  defaultCredentialManager,
  parent,
  moduleConfigNode,
  moduleContext,
}: BuildModuleProps): Promise<InternalModule> => {
  const moduleVariables = createVariablesForModuleConfigFile(
    ctx.variables,
    parent,
    moduleConfigNode.path,
  )

  const moduleConfig = await moduleConfigNode.getConfig(moduleVariables)

  const ignore =
    moduleConfig.ignore !== undefined ? moduleConfig.ignore : parent.ignore

  const obsolete =
    moduleConfig.obsolete !== undefined ? parent.obsolete : parent.obsolete

  const tags = moduleConfig.inheritTags ? new Map(parent.tags) : new Map()

  moduleConfig.tags.forEach((value, key) => {
    tags.set(key, value)
  })

  const accountIds = moduleConfig.accountIds ?? parent.accountIds

  const terminationProtection =
    moduleConfig.terminationProtection !== undefined
      ? moduleConfig.terminationProtection
      : parent.terminationProtection

  const regions =
    moduleConfig.regions.length > 0 ? moduleConfig.regions : parent.regions

  const modulePath = moduleContext.moduleInformation.isRoot
    ? moduleConfigNode.path
    : moduleContext.moduleInformation.path + moduleConfigNode.path
  const moduleName = moduleContext.moduleInformation.isRoot
    ? moduleConfig.name
    : moduleContext.moduleInformation.name + "-" + moduleConfig.name

  const moduleConfigRepository =
    await moduleContext.configRepository.getStacksConfigRepositoryForModule(
      moduleConfig.id,
      moduleConfig.version,
    )

  const childModuleContext = await createModuleContext({
    logger,
    configRepository: moduleConfigRepository,
    additionalConfigurationLocations: ctx.projectConfig, // TODO: Module specific-configs?
    moduleInformation: {
      path: modulePath,
      name: moduleName,
      isRoot: false,
      stackNamePrefix: moduleName + "-",
      stackPathPrefix: modulePath,
    },
  })

  moduleContext.children.push(childModuleContext)

  const configTree = await moduleConfigRepository.buildConfigTree()

  return await processConfigTree({
    ctx,
    logger,
    credentialManagers,
    configTree,
    credentialManager: defaultCredentialManager,
    commandPath: ROOT_STACK_GROUP_PATH,
    moduleContext: childModuleContext,
    parentPath: parent.path,
    stackGroupDefaults: {
      obsolete,
      ignore,
      tags,
      accountIds,
      regions,
      terminationProtection,
    },
  })
}
