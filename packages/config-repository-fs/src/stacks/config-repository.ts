import { Region } from "@takomo/aws-model"
import { AdditionalConfigurationLocations } from "@takomo/core"
import {
  createModuleConfigSchema,
  createStackConfigSchema,
  createStackGroupConfigSchema,
} from "@takomo/stacks-config"
import {
  ConfigTree,
  StacksConfigRepository,
  StacksConfigRepositoryProps,
} from "@takomo/stacks-context"
import { HookRegistry } from "@takomo/stacks-hooks"
import {
  ModuleId,
  ModuleVersion,
  ROOT_STACK_GROUP_PATH,
  SchemaRegistry,
} from "@takomo/stacks-model"
import { ResolverRegistry } from "@takomo/stacks-resolvers"
import { createStacksSchemas } from "@takomo/stacks-schema"
import {
  createTemplateEngine,
  dirExists,
  fileExists,
  FilePath,
  readFileContents,
  renderTemplate,
  TakomoError,
  TkmLogger,
} from "@takomo/util"
import path from "path"
import {
  createProjectFilePaths,
  TAKOMO_MODULE_CONFIG_FILE_NAME,
} from "../constants"
import { loadTemplateHelpers, loadTemplatePartials } from "../template-engine"
import { buildStackGroupConfigNode } from "./config-tree"
import {
  loadCustomHooks,
  loadCustomResolvers,
  loadCustomSchemas,
} from "./extensions"

export interface FileSystemStacksConfigRepositoryProps {
  readonly logger: TkmLogger
  readonly projectDir: FilePath
  readonly stacksDir: FilePath
  readonly resolversDir: FilePath
  readonly hooksDir: FilePath
  readonly helpersDir: FilePath
  readonly partialsDir: FilePath
  readonly templatesDir: FilePath
  readonly schemasDir: FilePath
  readonly modulesDir: FilePath
  readonly configFileExtension: string
  readonly moduleConfigFileExtension: string
  readonly stackGroupConfigFileName: string
  readonly regions: ReadonlyArray<Region>
  readonly confidentialValuesLoggingEnabled: boolean
  readonly additionalConfiguration: AdditionalConfigurationLocations
}

export interface ChildFileSystemStacksConfigRepositoryProps
  extends FileSystemStacksConfigRepositoryProps {
  readonly isRoot: boolean
  readonly parent?: StacksConfigRepository
}

export const createFileSystemStacksConfigRepository = async (
  props: FileSystemStacksConfigRepositoryProps,
): Promise<StacksConfigRepository> => {
  return createChildFileSystemStacksConfigRepository({
    ...props,
    isRoot: true,
  })
}

export const createChildFileSystemStacksConfigRepository = async ({
  regions,
  additionalConfiguration,
  logger,
  stacksDir,
  resolversDir,
  helpersDir,
  hooksDir,
  partialsDir,
  configFileExtension,
  moduleConfigFileExtension,
  stackGroupConfigFileName,
  templatesDir,
  schemasDir,
  modulesDir,
  confidentialValuesLoggingEnabled,
  isRoot,
  parent,
}: ChildFileSystemStacksConfigRepositoryProps): Promise<StacksConfigRepository> => {
  const templateEngine = createTemplateEngine()

  additionalConfiguration.helpers.forEach((config) => {
    logger.debug(
      `Register Handlebars helper from NPM package: ${config.package}`,
    )
    // eslint-disable-next-line
    const helper = require(config.package)
    const helperWithName = config.name
      ? { ...helper, name: config.name }
      : helper

    if (typeof helperWithName.fn !== "function") {
      throw new TakomoError(
        `Handlebars helper loaded from an NPM package ${config.package} does not export property 'fn' of type function`,
      )
    }

    if (typeof helperWithName.name !== "string") {
      throw new TakomoError(
        `Handlebars helper loaded from an NPM package ${config.package} does not export property 'name' of type string`,
      )
    }

    templateEngine.registerHelper(helperWithName.name, helperWithName.fn)
  })

  const defaultHelpersDirExists = await dirExists(helpersDir)
  const additionalHelpersDirs = additionalConfiguration.helpersDir

  const helpersDirs = defaultHelpersDirExists
    ? [helpersDir, ...additionalHelpersDirs]
    : additionalHelpersDirs

  const defaultPartialsDirExists = await dirExists(partialsDir)
  const additionalPartialsDirs = additionalConfiguration.partialsDir

  const partialsDirs = defaultPartialsDirExists
    ? [partialsDir, ...additionalPartialsDirs]
    : additionalPartialsDirs

  const defaultSchemasDirExists = await dirExists(schemasDir)
  const additionalSchemasDirs = additionalConfiguration.schemasDir

  const schemasDirs = defaultSchemasDirExists
    ? [schemasDir, ...additionalSchemasDirs]
    : additionalSchemasDirs

  await Promise.all([
    loadTemplateHelpers(helpersDirs, logger, templateEngine),
    loadTemplatePartials(partialsDirs, logger, templateEngine),
  ])

  const getStackTemplateContentsFromFile = async (
    variables: any,
    filename: string,
    dynamic: boolean,
  ): Promise<string> => {
    const pathToTemplate = path.join(templatesDir, filename)
    const content = await readFileContents(pathToTemplate)

    if (!dynamic) {
      return content
    }

    logger.traceText("Raw template body:", () => content)
    logger.traceObject("Render template using variables:", () => variables)

    const renderedContent = await renderTemplate(
      templateEngine,
      pathToTemplate,
      content,
      variables,
    )

    logger.traceText("Final rendered template:", () => renderedContent)
    return renderedContent
  }

  const getStackTemplateContentsFromInline = async (
    variables: any,
    content: string,
    dynamic: boolean,
  ): Promise<string> => {
    if (!dynamic) {
      return content
    }

    logger.traceText("Raw template body:", () => content)
    logger.traceObject("Render template using variables:", () => variables)

    const renderedContent = await renderTemplate(
      templateEngine,
      "inlined template",
      content,
      variables,
    )

    logger.traceText("Final rendered template:", () => renderedContent)
    return renderedContent
  }

  const schemaProps = {
    regions,
    requireStackName: !isRoot,
    denyProject: !isRoot,
  }

  const stacksSchemas = createStacksSchemas(schemaProps)
  const stackConfigSchema = createStackConfigSchema(schemaProps)
  const stackGroupConfigSchema = createStackGroupConfigSchema(schemaProps)
  const moduleConfigSchema = createModuleConfigSchema(schemaProps)

  const buildConfigTree = async (): Promise<ConfigTree> =>
    buildStackGroupConfigNode({
      templateEngine,
      logger,
      configFileExtension,
      stackGroupConfigFileName,
      moduleConfigFileExtension,
      stacksSchemas,
      stackConfigSchema,
      moduleConfigSchema,
      stackGroupConfigSchema,
      confidentialValuesLoggingEnabled,
      stackGroupDir: stacksDir,
      stackGroupPath: ROOT_STACK_GROUP_PATH,
    }).then((rootStackGroup) => ({
      rootStackGroup,
    }))

  const loadExtensions = async (
    resolverRegistry: ResolverRegistry,
    hookRegistry: HookRegistry,
    schemaRegistry: SchemaRegistry,
  ): Promise<void> => {
    await Promise.all([
      loadCustomResolvers(resolversDir, logger, resolverRegistry),
      loadCustomHooks(hooksDir, logger, hookRegistry),
      loadCustomSchemas({ schemasDirs, logger, registry: schemaRegistry }),
    ])
  }

  const getStackTemplateContents = async ({
    variables,
    filename,
    inline,
    dynamic,
  }: StacksConfigRepositoryProps): Promise<string> => {
    if (filename) {
      return getStackTemplateContentsFromFile(variables, filename, dynamic)
    }
    if (inline) {
      return getStackTemplateContentsFromInline(variables, inline, dynamic)
    }

    throw new Error("Expected either filename or inline to be defined")
  }

  const hasModule = async (
    moduleId: ModuleId,
    moduleVersion: ModuleVersion,
  ): Promise<boolean> => {
    const pathToModuleConfigFile = path.join(
      modulesDir,
      moduleId,
      moduleVersion,
      TAKOMO_MODULE_CONFIG_FILE_NAME,
    )

    return fileExists(pathToModuleConfigFile)
  }

  const repository: StacksConfigRepository = {
    templateEngine,
    buildConfigTree,
    loadExtensions,
    getStackTemplateContents,
    hasModule,
    getStacksConfigRepositoryForModule: async (
      moduleId: ModuleId,
      moduleVersion: ModuleVersion,
    ): Promise<StacksConfigRepository> => {
      if (await hasModule(moduleId, moduleVersion)) {
        const pathToModuleDir = path.join(modulesDir, moduleId, moduleVersion)

        return createChildFileSystemStacksConfigRepository({
          additionalConfiguration,
          logger,
          regions,
          confidentialValuesLoggingEnabled,
          ...createProjectFilePaths(pathToModuleDir),
          isRoot: false,
          parent: repository,
        })
      }

      if (parent) {
        return parent.getStacksConfigRepositoryForModule(
          moduleId,
          moduleVersion,
        )
      }

      throw new Error(
        `Module ${moduleId}@${moduleVersion} not found from dir ${modulesDir}`,
      )
    },
  }

  return repository
}
