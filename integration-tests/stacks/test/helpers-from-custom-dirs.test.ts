import { executeDeployStacksCommand } from "@takomo/test-integration"

const stackName = "stack",
  stackPath = "/stack.yml/eu-north-1",
  projectDir = "configs/helpers-from-custom-dirs"

describe("Helpers from custom dirs", () => {
  test("Deploy", () =>
    executeDeployStacksCommand({ projectDir })
      .expectCommandToSucceed()
      .expectStackCreateSuccess({
        stackName,
        stackPath,
        expectDeployedStack: {
          description: "CODE OTHER",
        },
      })
      .assert())
})
