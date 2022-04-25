import { isModulePath } from "../src"

type Case = [string, boolean]

const cases: Array<Case> = [
  ["/", false],
  ["/dev", false],
  ["/dev.yml", false],
  ["/dev.yml/eu-west-1", false],
  ["/dev.module.yml", true],
  ["/env/prod/vpc.module.yml", true],
  ["/env/prod/vpc.module.yml/sub", false],
  ["/env/prod/vpc.module.yml/sub/stack.yml", false],
  ["/env/prod/vpc.module.yml/sub/stack.yml/eu-west-1", false],
  ["/env/prod/vpc.module.yml/sub/example.module.yml", true],
]

describe("#isWithinCommandPath", () => {
  test.each(cases)(
    "when command path is '%s' returns %s",
    (commandPath, expected) => {
      expect(isModulePath(commandPath)).toBe(expected)
    },
  )
})
