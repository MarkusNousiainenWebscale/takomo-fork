import { initOptionsAndVariables } from "@takomo/cli"
import { CommandStatus } from "@takomo/core"
import {
  deployStacksCommand,
  undeployStacksCommand,
} from "@takomo/stacks-commands"
import { TestDeployStacksIO, TestUndeployStacksIO } from "../../io"
import { TIMEOUT } from "../../test-constants"

const createOptions = async () =>
  initOptionsAndVariables({
    log: "info",
    yes: true,
    dir: "configs/hooks",
  })

// First, make sure that there are no existing stacks left from previous test runs
beforeAll(async () => {
  const { options, variables, watch } = await createOptions()
  return await undeployStacksCommand(
    {
      commandPath: "/launch/after/error",
      ignoreDependencies: false,
      interactive: false,
      options,
      variables,
      watch,
    },
    new TestUndeployStacksIO(options),
  )
}, TIMEOUT)

describe("Example: After hook that fails on error ", () => {
  test(
    "Launch",
    async () => {
      const { options, variables, watch } = await createOptions()
      const output = await deployStacksCommand(
        {
          commandPath: "/launch/after/error",
          ignoreDependencies: false,
          interactive: false,
          options,
          variables,
          watch,
        },
        new TestDeployStacksIO(options),
      )

      expect(output.status).toBe(CommandStatus.FAILED)

      const [res1, res2, res3] = output.results

      expect(res1.stack.getPath()).toBe(
        "/launch/after/error/stack-1.yml/eu-west-1",
      )
      expect(res1.status).toBe(CommandStatus.SUCCESS)
      expect(res1.success).toBe(true)

      expect(res2.stack.getPath()).toBe(
        "/launch/after/error/stack-2.yml/eu-west-1",
      )
      expect(res2.status).toBe(CommandStatus.FAILED)
      expect(res2.success).toBe(false)
      expect(res2.message).toBe("Oh no!")
      expect(res2.reason).toBe("AFTER_HOOKS_FAILED")

      expect(res3.stack.getPath()).toBe(
        "/launch/after/error/stack-3.yml/eu-west-1",
      )
      expect(res3.status).toBe(CommandStatus.CANCELLED)
      expect(res3.success).toBe(false)
      expect(res3.reason).toBe("DEPENDENCIES_FAILED")
    },
    TIMEOUT,
  )
})