import { AdditionalConfigurationLocations } from "@takomo/core"
import { createHookRegistry } from "@takomo/stacks-hooks"
import { createSchemaRegistry, ModuleInformation } from "@takomo/stacks-model"
import {
  coreResolverProviders,
  ResolverRegistry,
} from "@takomo/stacks-resolvers"
import { TkmLogger } from "@takomo/util"
import { ModuleContext, StacksConfigRepository } from "../model"
import { coreHookProviders } from "./hooks"

interface CreateModuleContextProps {
  readonly logger: TkmLogger
  readonly moduleInformation: ModuleInformation
  readonly configRepository: StacksConfigRepository
  readonly additionalConfigurationLocations: AdditionalConfigurationLocations
}

export const createModuleContext = async ({
  moduleInformation,
  configRepository,
  logger,
  additionalConfigurationLocations,
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

  additionalConfigurationLocations.resolvers.forEach((config) => {
    resolverRegistry.registerProviderFromNpmPackage(config)
  })

  await configRepository.loadExtensions(
    resolverRegistry,
    hookRegistry,
    schemaRegistry,
  )

  return {
    moduleInformation,
    configRepository,
    resolverRegistry,
    schemaRegistry,
    hookRegistry,
    children: [],
  }
}
