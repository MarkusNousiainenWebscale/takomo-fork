import { Region } from "@takomo/aws-model"
import { createAwsSchemas } from "@takomo/aws-schema"
import { createCommonSchema } from "@takomo/core"
import { createStacksSchemas } from "@takomo/stacks-schema"
import Joi, { ObjectSchema } from "joi"

interface CreateStackGroupConfigSchemaProps {
  readonly regions: ReadonlyArray<Region>
  readonly denyProject: boolean
}

export const createStackGroupConfigSchema = (
  props: CreateStackGroupConfigSchemaProps,
): ObjectSchema => {
  const { project, data, json } = createCommonSchema()
  const {
    regions,
    tags,
    iamRoleArn,
    accountId,
    accountIds,
    stackCapabilities,
  } = createAwsSchemas({
    ...props,
  })

  const {
    ignore,
    obsolete,
    terminationProtection,
    templateBucket,
    hooks,
    timeoutInMinutes,
    timeoutObject,
    schemas,
    inheritTags,
  } = createStacksSchemas({ ...props })

  const timeout = [timeoutInMinutes, timeoutObject]

  const projectSchema = props.denyProject ? project.forbidden() : project

  return Joi.object({
    project: projectSchema,
    templateBucket,
    tags,
    hooks,
    data,
    regions,
    ignore,
    obsolete,
    terminationProtection,
    timeout,
    schemas,
    inheritTags,
    accountIds: [accountId, accountIds],
    commandRole: iamRoleArn,
    capabilities: stackCapabilities,
    stackPolicy: json,
    stackPolicyDuringUpdate: json,
  })
}

interface CreateStackConfigSchemaProps {
  readonly regions: ReadonlyArray<Region>
  readonly requireStackName: boolean
  readonly denyProject: boolean
}

export const createStackConfigSchema = (
  props: CreateStackConfigSchemaProps,
): ObjectSchema => {
  const { project, data, json } = createCommonSchema()
  const {
    regions,
    stackName,
    tags,
    iamRoleArn,
    accountId,
    accountIds,
    stackCapabilities,
  } = createAwsSchemas({
    ...props,
  })

  const {
    ignore,
    obsolete,
    terminationProtection,
    templateBucket,
    template,
    hooks,
    timeoutInMinutes,
    timeoutObject,
    relativeStackPath,
    parameters,
    schemas,
    inheritTags,
  } = createStacksSchemas({ ...props })

  const timeout = [timeoutInMinutes, timeoutObject]
  const stackPaths = Joi.array().items(relativeStackPath).unique()

  const projectSchema = props.denyProject ? project.forbidden() : project
  const stackNameSchema = props.requireStackName
    ? stackName.required()
    : stackName

  return Joi.object({
    project: projectSchema,
    regions,
    ignore,
    obsolete,
    terminationProtection,
    templateBucket,
    tags,
    hooks,
    data,
    template,
    parameters,
    timeout,
    schemas,
    inheritTags,
    accountIds: [accountId, accountIds],
    commandRole: iamRoleArn,
    name: stackNameSchema,
    depends: [relativeStackPath, stackPaths],
    capabilities: stackCapabilities,
    stackPolicy: json,
    stackPolicyDuringUpdate: json,
  })
}

interface CreateModuleConfigSchemaProps {
  readonly regions: ReadonlyArray<Region>
}

export const createModuleConfigSchema = (
  props: CreateModuleConfigSchemaProps,
): ObjectSchema => {
  const { data, json } = createCommonSchema()
  const {
    regions,
    tags,
    iamRoleArn,
    accountId,
    accountIds,
    stackCapabilities,
  } = createAwsSchemas({
    ...props,
  })

  const {
    ignore,
    obsolete,
    terminationProtection,
    templateBucket,
    hooks,
    timeoutInMinutes,
    timeoutObject,
    schemas,
    inheritTags,
    moduleId,
    moduleVersion,
    moduleName,
  } = createStacksSchemas({ ...props })

  const timeout = [timeoutInMinutes, timeoutObject]

  return Joi.object({
    name: moduleName.required(),
    id: moduleId.required(),
    version: moduleVersion.required(),
    templateBucket,
    tags,
    hooks,
    data,
    regions,
    ignore,
    obsolete,
    terminationProtection,
    timeout,
    schemas,
    inheritTags,
    accountIds: [accountId, accountIds],
    commandRole: iamRoleArn,
    capabilities: stackCapabilities,
    stackPolicy: json,
    stackPolicyDuringUpdate: json,
  })
}
