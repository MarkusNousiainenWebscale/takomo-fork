import {
  ModuleConfigNode,
  StackConfigNode,
  StackGroupConfigNode,
} from "@takomo/stacks-context"
import { ROOT_STACK_GROUP_PATH, StackGroupPath } from "@takomo/stacks-model"
import { StacksSchemas } from "@takomo/stacks-schema"
import { FilePath, TemplateEngine, TkmLogger, validate } from "@takomo/util"
import { ObjectSchema } from "joi"
import path from "path"
import readdirp from "readdirp"
import {
  parseModuleConfigFile,
  parseStackConfigFile,
  parseStackGroupConfigFile,
} from "./parser"

interface BuildStackGroupConfigNodeProps {
  readonly templateEngine: TemplateEngine
  readonly logger: TkmLogger
  readonly configFileExtension: string
  readonly moduleConfigFileExtension: string
  readonly stackGroupConfigFileName: string
  readonly stackGroupDir: FilePath
  readonly stackGroupPath: StackGroupPath
  readonly stacksSchemas: StacksSchemas
  readonly confidentialValuesLoggingEnabled: boolean
  readonly moduleConfigSchema: ObjectSchema
  readonly stackConfigSchema: ObjectSchema
  readonly stackGroupConfigSchema: ObjectSchema
  readonly parentStackGroupPath?: StackGroupPath
}

export const buildStackGroupConfigNode = async ({
  templateEngine,
  logger,
  configFileExtension,
  moduleConfigFileExtension,
  stackGroupConfigFileName,
  stackGroupDir,
  stackGroupPath,
  stacksSchemas,
  parentStackGroupPath,
  confidentialValuesLoggingEnabled,
  moduleConfigSchema,
  stackConfigSchema,
  stackGroupConfigSchema,
}: BuildStackGroupConfigNodeProps): Promise<StackGroupConfigNode> => {
  logger.debug(
    `Process stack group ${stackGroupPath} from dir: ${stackGroupDir}`,
  )

  const { stackGroupName } = stacksSchemas

  validate(
    stackGroupName,
    path.basename(stackGroupDir),
    `Directory ${stackGroupDir} name is not suitable for a stack group`,
  )
  const files = await readdirp.promise(stackGroupDir, {
    alwaysStat: true,
    depth: 0,
    fileFilter: (e) => e.basename.endsWith(configFileExtension),
    type: "files_directories",
  })

  const childStackGroupDirs = files.filter((f) => f.stats!.isDirectory())
  const children: ReadonlyArray<StackGroupConfigNode> = await Promise.all(
    childStackGroupDirs.map((d) => {
      const childPath =
        stackGroupPath === ROOT_STACK_GROUP_PATH
          ? `/${d.basename}`
          : `${stackGroupPath}/${d.basename}`

      return buildStackGroupConfigNode({
        templateEngine,
        logger,
        configFileExtension,
        moduleConfigFileExtension,
        stackGroupConfigFileName,
        stacksSchemas,
        moduleConfigSchema,
        stackConfigSchema,
        stackGroupConfigSchema,
        confidentialValuesLoggingEnabled,
        stackGroupDir: d.fullPath,
        stackGroupPath: childPath,
        parentStackGroupPath: stackGroupPath,
      })
    }),
  )

  const modules: ReadonlyArray<ModuleConfigNode> = files
    .filter(
      (f) =>
        f.stats!.isFile() &&
        f.basename !== stackGroupConfigFileName &&
        f.basename.endsWith(moduleConfigFileExtension),
    )
    .map((f) => ({
      path:
        stackGroupPath === ROOT_STACK_GROUP_PATH
          ? `/${f.basename}`
          : `${stackGroupPath}/${f.basename}`,
      getConfig: (variables: any) =>
        parseModuleConfigFile(
          variables,
          templateEngine,
          logger,
          f.fullPath,
          confidentialValuesLoggingEnabled,
          moduleConfigSchema,
        ),
    }))

  const stacks: ReadonlyArray<StackConfigNode> = files
    .filter(
      (f) =>
        f.stats!.isFile() &&
        f.basename !== stackGroupConfigFileName &&
        !f.basename.endsWith(moduleConfigFileExtension),
    )
    .map((f) => ({
      path:
        stackGroupPath === ROOT_STACK_GROUP_PATH
          ? `/${f.basename}`
          : `${stackGroupPath}/${f.basename}`,
      getConfig: (variables: any) =>
        parseStackConfigFile(
          variables,
          templateEngine,
          logger,
          f.fullPath,
          confidentialValuesLoggingEnabled,
          stackConfigSchema,
        ),
    }))

  const file = files.find((f) => f.basename === stackGroupConfigFileName)

  if (file) {
    logger.debug(`Found stack group config file: ${file.fullPath}`)
  }

  return {
    name: path.basename(stackGroupDir),
    path: stackGroupPath,
    parentPath: parentStackGroupPath,
    stacks,
    children,
    modules,
    getConfig: async (variables: any) =>
      file
        ? parseStackGroupConfigFile(
            variables,
            templateEngine,
            logger,
            file.fullPath,
            confidentialValuesLoggingEnabled,
            stackGroupConfigSchema,
          )
        : undefined,
  }
}
