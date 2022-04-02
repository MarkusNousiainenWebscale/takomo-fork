import {
  buildModuleConfig,
  buildStackConfig,
  buildStackGroupConfig,
  ModuleConfig,
  StackConfig,
  StackGroupConfig,
} from "@takomo/stacks-config"
import {
  FilePath,
  parseYaml,
  readFileContents,
  renderTemplate,
  TakomoError,
  TemplateEngine,
  TkmLogger,
} from "@takomo/util"
import { ObjectSchema } from "joi"

export const parseStackConfigFile = async (
  variables: any,
  templateEngine: TemplateEngine,
  logger: TkmLogger,
  pathToFile: FilePath,
  confidentialValuesLoggingEnabled: boolean,
  stackConfigSchema: ObjectSchema,
): Promise<StackConfig> => {
  const contents = await readFileContents(pathToFile)
  logger.traceText(`Raw stack config contents:`, contents)

  const filterFn = confidentialValuesLoggingEnabled
    ? (obj: any) => obj
    : (obj: any) => {
        return {
          ...obj,
          env: "*****",
        }
      }

  logger.traceObject(
    `Render stack config file using variables:`,
    variables,
    filterFn,
  )

  const rendered = await renderTemplate(
    templateEngine,
    pathToFile,
    contents,
    variables,
  )

  logger.traceText(`Final rendered stack config contents:`, rendered)

  const parsedFile = (await parseYaml(pathToFile, rendered)) || {}
  const result = await buildStackConfig(parsedFile, stackConfigSchema)
  if (result.isOk()) {
    return result.value
  }

  const details = result.error.messages.map((m) => `- ${m}`).join("\n")
  throw new TakomoError(
    `Validation errors in stack configuration file ${pathToFile}:\n${details}`,
  )
}

export const parseStackGroupConfigFile = async (
  variables: any,
  templateEngine: TemplateEngine,
  logger: TkmLogger,
  pathToFile: FilePath,
  confidentialValuesLoggingEnabled: boolean,
  stackGroupConfigSchema: ObjectSchema,
): Promise<StackGroupConfig> => {
  const contents = await readFileContents(pathToFile)
  logger.traceText(`Raw stack group config contents:`, contents)

  const filterFn = confidentialValuesLoggingEnabled
    ? (obj: any) => obj
    : (obj: any) => {
        return {
          ...obj,
          env: "*****",
        }
      }

  logger.traceObject(
    `Render stack group config file using variables:`,
    () => variables,
    filterFn,
  )

  const rendered = await renderTemplate(
    templateEngine,
    pathToFile,
    contents,
    variables,
  )

  logger.traceText(`Final rendered stack config contents:`, () => rendered)

  const parsedFile = (await parseYaml(pathToFile, rendered)) || {}
  const result = buildStackGroupConfig(parsedFile, stackGroupConfigSchema)

  if (result.isOk()) {
    return result.value
  }

  const details = result.error.messages.map((m) => `- ${m}`).join("\n")
  throw new TakomoError(
    `Validation errors in stack group configuration file ${pathToFile}:\n${details}`,
  )
}

export const parseModuleConfigFile = async (
  variables: any,
  templateEngine: TemplateEngine,
  logger: TkmLogger,
  pathToFile: FilePath,
  confidentialValuesLoggingEnabled: boolean,
  moduleConfigSchema: ObjectSchema,
): Promise<ModuleConfig> => {
  const contents = await readFileContents(pathToFile)
  logger.traceText(`Raw module config contents:`, contents)

  const filterFn = confidentialValuesLoggingEnabled
    ? (obj: any) => obj
    : (obj: any) => {
        return {
          ...obj,
          env: "*****",
        }
      }

  logger.traceObject(
    `Render module config file using variables:`,
    variables,
    filterFn,
  )

  const rendered = await renderTemplate(
    templateEngine,
    pathToFile,
    contents,
    variables,
  )

  logger.traceText(`Final rendered module config contents:`, rendered)

  const parsedFile = (await parseYaml(pathToFile, rendered)) || {}
  const result = await buildModuleConfig(parsedFile, moduleConfigSchema)
  if (result.isOk()) {
    return result.value
  }

  const details = result.error.messages.map((m) => `- ${m}`).join("\n")
  throw new TakomoError(
    `Validation errors in module configuration file ${pathToFile}:\n${details}`,
  )
}
