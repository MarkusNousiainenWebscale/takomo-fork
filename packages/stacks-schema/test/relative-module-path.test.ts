import { Region } from "@takomo/aws-model"
import {
  expectNoValidationError,
  expectValidationErrors,
} from "@takomo/test-unit"
import { createStacksSchemas } from "../src"

const regions: ReadonlyArray<Region> = ["eu-west-1", "us-east-1"]

const { relativeModulePath } = createStacksSchemas({
  regions,
})

const valid = [
  "vpc.module.yml",
  "/network/subnets.module.yml",
  "../Case/Sensitive/andNumb3rs.module.yml",
  "../../some-more.module.yml",
]

const invalid = [
  ["", '"value" is not allowed to be empty'],
  [
    "/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.module.yml",
    '"value" length must be less than or equal to 100 characters long',
  ],
  [
    "/spaces are not allowed.module.yml",
    '"value" with value "/spaces are not allowed.module.yml" fails to match the required pattern: /^(((\\/|(\\.\\.\\/)+)?)[a-zA-Z][a-zA-Z0-9-]*)+\\.module\\.yml$/',
  ],
  [
    "/invalid-extension.module.json",
    '"value" with value "/invalid-extension.module.json" fails to match the required pattern: /^(((\\/|(\\.\\.\\/)+)?)[a-zA-Z][a-zA-Z0-9-]*)+\\.module\\.yml$/',
  ],
  [
    "/underscores_are_BAD.module.yml",
    '"value" with value "/underscores_are_BAD.module.yml" fails to match the required pattern: /^(((\\/|(\\.\\.\\/)+)?)[a-zA-Z][a-zA-Z0-9-]*)+\\.module\\.yml$/',
  ],
  [
    "/1-begins-with-number.module.yml",
    '"value" with value "/1-begins-with-number.module.yml" fails to match the required pattern: /^(((\\/|(\\.\\.\\/)+)?)[a-zA-Z][a-zA-Z0-9-]*)+\\.module\\.yml$/',
  ],
]

describe("module path validation", () => {
  test.each(invalid)(
    "fails when '%s' is given",
    expectValidationErrors(relativeModulePath),
  )

  test.each(valid)(
    "succeeds when '%s' is given",
    expectNoValidationError(relativeModulePath),
  )
})
