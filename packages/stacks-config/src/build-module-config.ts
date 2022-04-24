import {
  parseBoolean,
  parseCommandRole,
  parseOptionalBoolean,
  parseOptionalStringArray,
  parseStringArray,
} from "@takomo/core"
import { ModuleName, ModuleVersion } from "@takomo/stacks-model"
import { ValidationError } from "@takomo/util"
import { ObjectSchema } from "joi"
import { err, ok, Result } from "neverthrow"
import { ModuleConfig } from "./model"
import { parseAccountIds } from "./parse-account-ids"
import { parseData } from "./parse-data"
import { parseHooks } from "./parse-hooks"
import { parseSchemas } from "./parse-schemas"
import { parseStackPolicy } from "./parse-stack-policy"
import { parseTags } from "./parse-tags"
import { parseTemplateBucket } from "./parse-template-bucket"
import { parseTimeout } from "./parse-timeout"

export const buildModuleConfig = (
  record: Record<string, unknown>,
  moduleConfigSchema: ObjectSchema,
): Result<ModuleConfig, ValidationError> => {
  const { error } = moduleConfigSchema.validate(record, {
    abortEarly: false,
    convert: false,
  })

  if (error) {
    const details = error.details.map((d) => d.message)
    return err(
      new ValidationError("Validation errors in module configuration", details),
    )
  }

  const schemas = parseSchemas(record.schemas)
  const data = parseData(record.data)
  const hooks = parseHooks(record.hooks)
  const accountIds = parseAccountIds(record.accountIds)
  const stackPolicy = parseStackPolicy(record.stackPolicy)
  const stackPolicyDuringUpdate = parseStackPolicy(
    record.stackPolicyDuringUpdate,
  )

  return ok({
    stackPolicy,
    stackPolicyDuringUpdate,
    schemas,
    accountIds,
    data,
    hooks,
    id: record.id as ModuleVersion,
    version: record.version as ModuleVersion,
    name: record.name as ModuleName,
    terminationProtection: parseOptionalBoolean(record.terminationProtection),
    ignore: parseOptionalBoolean(record.ignore),
    obsolete: parseOptionalBoolean(record.obsolete),
    capabilities: parseOptionalStringArray(record.capabilities),
    commandRole: parseCommandRole(record.commandRole),
    regions: parseStringArray(record.region),
    templateBucket: parseTemplateBucket(record.templateBucket),
    tags: parseTags(record.tags),
    inheritTags: parseBoolean(record.inheritTags, true),
    timeout: parseTimeout(record.timeout),
  })
}
