import { isStackGroupPath } from "../src"

type Case = [string, boolean]

const cases: Array<Case> = [
  ["/", true],
  ["/dev", true],
  ["/dev.yml", false],
  ["/dev.yml/eu-west-1", false],
  ["/dev.module.yml", false],
  ["/env/prod/vpc.module.yml", false],
  ["/env/prod/vpc.module.yml/sub", true],
  ["/env/prod/vpc.module.yml/sub/stack.yml", false],
  ["/env/prod/vpc.module.yml/sub/stack.yml/eu-west-1", false],
  ["/env/prod/vpc.module.yml/sub/example.module.yml", false],
]

describe("#isStackGroupPath", () => {
  test.each(cases)(
    "when command path is '%s' returns %s",
    (commandPath, expected) => {
      expect(isStackGroupPath(commandPath)).toBe(expected)
    },
  )
})
