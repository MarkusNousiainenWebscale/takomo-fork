import { isStackPath } from "../src"

type Case = [string, boolean]

const cases: Array<Case> = [
  ["/", false],
  ["/dev", false],
  ["/dev.yml", true],
  ["/dev.yml/eu-west-1", true],
  ["/dev.module.yml", false],
  ["/env/prod/vpc.module.yml", false],
  ["/env/prod/vpc.module.yml/sub", false],
  ["/env/prod/vpc.module.yml/sub/stack.yml", true],
  ["/env/prod/vpc.module.yml/sub/stack.yml/eu-west-1", true],
  ["/env/prod/vpc.module.yml/sub/example.module.yml", false],
]

describe("#isStackPath", () => {
  test.each(cases)(
    "when command path is '%s' returns %s",
    (commandPath, expected) => {
      expect(isStackPath(commandPath)).toBe(expected)
    },
  )
})
