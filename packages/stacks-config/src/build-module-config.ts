import {
  parseBoolean,
  parseOptionalBoolean,
  parseStringArray,
} from "@takomo/core"
import { ModuleName, ModuleVersion } from "@takomo/stacks-model"
import { ValidationError } from "@takomo/util"
import { ObjectSchema } from "joi"
import { err, ok, Result } from "neverthrow"
import { ModuleConfig } from "./model"
import { parseAccountIds } from "./parse-account-ids"
import { parseTags } from "./parse-tags"

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

  return ok({
    id: record.id as ModuleVersion,
    version: record.version as ModuleVersion,
    name: record.name as ModuleName,
    accountIds: parseAccountIds(record.accountIds),
    tags: parseTags(record.tags),
    ignore: parseOptionalBoolean(record.ignore),
    obsolete: parseOptionalBoolean(record.obsolete),
    inheritTags: parseBoolean(record.inheritTags, true),
    regions: parseStringArray(record.region),
  })
}
