import { CredentialManager } from "@takomo/aws-clients"
import { IamRoleArn } from "@takomo/aws-model"
import { InternalCommandContext } from "@takomo/core"
import { HookRegistry } from "@takomo/stacks-hooks"
import {
  InternalModule,
  ModuleInformation,
  ROOT_STACK_GROUP_PATH,
  SchemaRegistry,
  StackGroup,
} from "@takomo/stacks-model"
import { ResolverRegistry } from "@takomo/stacks-resolvers"
import { TkmLogger } from "@takomo/util"
import { StacksConfigRepository } from "../model"
import { buildChildStacksContext } from "./build-stacks-context"
import { ModuleConfigNode } from "./config-tree"
import { createVariablesForModuleConfigFile } from "./create-variables-for-module-config-file"

interface BuildModuleProps {
  readonly ctx: InternalCommandContext
  readonly logger: TkmLogger
  readonly defaultCredentialManager: CredentialManager
  readonly credentialManagers: Map<IamRoleArn, CredentialManager>
  readonly moduleConfigNode: ModuleConfigNode
  readonly stackGroup: StackGroup
  readonly configRepository: StacksConfigRepository
  readonly resolverRegistry: ResolverRegistry
  readonly schemaRegistry: SchemaRegistry
  readonly hookRegistry: HookRegistry
  readonly parentModuleInformation: ModuleInformation
}

export const buildModule = async ({
  ctx,
  logger,
  credentialManagers,
  defaultCredentialManager,
  stackGroup,
  moduleConfigNode,
  configRepository,
  resolverRegistry,
  schemaRegistry,
  hookRegistry,
  parentModuleInformation,
}: BuildModuleProps): Promise<InternalModule> => {
  const moduleVariables = createVariablesForModuleConfigFile(
    ctx.variables,
    stackGroup,
    moduleConfigNode.path,
  )

  const moduleConfig = await moduleConfigNode.getConfig(moduleVariables)
  const modulePath = parentModuleInformation.isRoot
    ? moduleConfigNode.path
    : parentModuleInformation.path + moduleConfigNode.path
  const moduleName = parentModuleInformation.isRoot
    ? moduleConfig.name
    : parentModuleInformation.name + "-" + moduleConfig.name

  const moduleConfigRepository =
    await configRepository.getStacksConfigRepositoryForModule(
      moduleConfig.id,
      moduleConfig.version,
    )

  const moduleStacksContext = await buildChildStacksContext({
    ctx,
    credentialManagers,
    hookRegistry,
    resolverRegistry,
    schemaRegistry,
    additionalConfiguration: {
      schemasDir: [],
      partialsDir: [],
      helpers: [],
      helpersDir: [],
      resolvers: [],
    },
    logger,
    commandPath: ROOT_STACK_GROUP_PATH,
    configRepository: moduleConfigRepository,
    ignoreDependencies: false,
    credentialManager: defaultCredentialManager,
    moduleInformation: {
      path: modulePath,
      name: moduleName,
      isRoot: false,
      stackNamePrefix: moduleName + "-",
      stackPathPrefix: modulePath,
    },
  })

  return {
    name: moduleName,
    path: modulePath,
    ctx: moduleStacksContext,
    parent: stackGroup,
    root: moduleStacksContext.rootStackGroup,
  }
}
