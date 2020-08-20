import { CloudFormationClient } from "@takomo/aws-clients"
import { CommandPath, ConfirmResult, Options, StackPath } from "@takomo/core"
import { DeployStacksIO, StacksOperationOutput } from "@takomo/stacks-commands"
import { resolveStackLaunchType } from "@takomo/stacks-context"
import {
  CommandContext,
  Stack,
  StackGroup,
  StackLaunchType,
} from "@takomo/stacks-model"
import { collectFromHierarchy, green, orange, red, yellow } from "@takomo/util"
import { CloudFormation } from "aws-sdk"
import { DescribeChangeSetOutput } from "aws-sdk/clients/cloudformation"
import { diffLines } from "diff"
import Table from "easy-table"
import prettyMs from "pretty-ms"
import CliIO from "../cli-io"
import {
  formatCommandStatus,
  formatResourceChange,
  formatStackEvent,
  formatStackStatus,
} from "../formatters"

const formatStackOperation = (
  stackPath: StackPath,
  launchType: StackLaunchType,
): string => {
  switch (launchType) {
    case StackLaunchType.CREATE:
      return green(`+ ${stackPath}:`)
    case StackLaunchType.RECREATE:
      return orange(`± ${stackPath}:`)
    case StackLaunchType.UPDATE:
      return yellow(`~ ${stackPath}:`)
    default:
      throw new Error(`Unsupported stack launch type: ${launchType}`)
  }
}

export class CliDeployStacksIO extends CliIO implements DeployStacksIO {
  private autoConfirm: boolean

  constructor(options: Options, loggerName: string | null = null) {
    super(options, loggerName)
    this.autoConfirm = options.isAutoConfirmEnabled()
  }

  chooseCommandPath = async (
    rootStackGroup: StackGroup,
  ): Promise<CommandPath> => {
    const allStackGroups = collectFromHierarchy(rootStackGroup, (s) =>
      s.getChildren(),
    )

    const allCommandPaths = allStackGroups.reduce(
      (collected, stackGroup) => [
        ...collected,
        stackGroup.getPath(),
        ...stackGroup.getStacks().map((s) => s.getPath()),
      ],
      new Array<string>(),
    )

    const source = async (
      answersSoFar: any,
      input: string,
    ): Promise<string[]> => {
      return input
        ? allCommandPaths.filter((p) => p.includes(input))
        : allCommandPaths
    }

    return this.autocomplete("Choose command path", source)
  }

  confirmLaunch = async (ctx: CommandContext): Promise<ConfirmResult> => {
    if (this.autoConfirm) {
      return ConfirmResult.YES
    }

    const identity = await ctx.getCredentialProvider().getCallerIdentity()
    this.debugObject("Default credentials:", identity)

    const stacks = ctx.getStacksToProcess()

    this.subheader("Review stacks deployment plan:", true)
    this.longMessage([
      "A stacks deployment plan has been created and is shown below.",
      "Stacks will be deployed in the order they are listed, and in parallel",
      "when possible.",
      "",
      "Stack operations are indicated with the following symbols:",
      "",
      `  ${green(
        "+ create",
      )}           Stack does not exist and will be created`,
      `  ${yellow("~ update")}           Stack exists and will be updated`,
      `  ${orange(
        "± recreate",
      )}         Previous attempt to create stack has failed, it will be first removed, then created`,
      "",
      `Following ${stacks.length} stack(s) will be deployed:`,
    ])

    for (const stack of stacks) {
      const stackIdentity = await stack
        .getCredentialProvider()
        .getCallerIdentity()

      const current = await ctx.getExistingStack(stack.getPath())
      const status = current ? current.StackStatus : null
      const launchType = resolveStackLaunchType(current?.StackStatus || null)
      const stackOperation = formatStackOperation(stack.getPath(), launchType)

      this.longMessage(
        [
          `  ${stackOperation}`,
          `      name:          ${stack.getName()}`,
          `      status:        ${formatStackStatus(status)}`,
          `      account id:    ${stackIdentity.accountId}`,
          `      region:        ${stack.getRegion()}`,
          "      credentials:",
          `        user id:     ${stackIdentity.userId}`,
          `        account id:  ${stackIdentity.accountId}`,
          `        arn:         ${stackIdentity.arn}`,
        ],
        true,
      )

      if (stack.getDependencies().length > 0) {
        this.message("      dependencies:")
        this.printStackDependencies(stack, ctx, 8)
      } else {
        this.message("      dependencies:  []")
      }
    }

    return (await this.confirm("Continue to deploy the stacks?", true))
      ? ConfirmResult.YES
      : ConfirmResult.NO
  }

  printOutput = (output: StacksOperationOutput): StacksOperationOutput => {
    const succeeded = output.results.filter((r) => r.success)
    const failed = output.results.filter((r) => !r.success)
    const all = [...succeeded, ...failed]

    const table = new Table()

    all.forEach((r) => {
      table.cell("Stack path", r.stack.getPath())
      table.cell("Stack name", r.stack.getName())
      table.cell("Status", formatCommandStatus(r.status))
      table.cell("Reason", r.reason)
      table.cell("Time", prettyMs(r.watch.secondsElapsed))
      table.cell("Message", r.message)
      table.newRow()
    })

    this.message(table.toString(), true)

    if (failed.length > 0) {
      this.message("Events for failed stacks", true)
      this.message("------------------------")

      failed.forEach((r) => {
        this.message(r.stack.getPath(), true, true)

        if (r.events.length === 0) {
          this.message("  <no events>")
        } else {
          const fn = (e: CloudFormation.StackEvent) =>
            this.message("  " + formatStackEvent(e))
          r.events.forEach(fn)
        }
      })
    }

    return output
  }

  printChangeSet = (
    path: StackPath,
    changeSet: DescribeChangeSetOutput,
  ): void => {
    const changes = changeSet.Changes || []

    const summary = new Map<string, number>([
      ["Add", 0],
      ["Modify", 0],
      ["Remove", 0],
    ])

    this.message(`Changes to stack: ${path}`, true)

    changes.forEach((change) => {
      const {
        LogicalResourceId,
        Action,
        Replacement,
        Scope,
        PhysicalResourceId,
        ResourceType,
        Details,
      } = change.ResourceChange!

      summary.set(Action!, summary.get(Action!)! + 1)

      this.message(
        formatResourceChange(Action!, Replacement!, LogicalResourceId!),
        true,
      )
      this.message(`      type:                      ${ResourceType}`)
      this.message(`      physical id:               ${PhysicalResourceId}`)
      this.message(`      replacement:               ${Replacement}`)
      this.message(`      scope:                     ${Scope}`)
      this.message(`      details:`)
      ;(Details || []).forEach((detail) => {
        this.message(`        - causing entity:        ${detail.CausingEntity}`)
        this.message(`          evaluation:            ${detail.Evaluation}`)
        this.message(`          change source:         ${detail.ChangeSource}`)
        this.message(`          target:`)
        this.message(
          `            attribute:           ${detail.Target!.Attribute}`,
        )
        this.message(`            name:                ${detail.Target!.Name}`)
        this.message(
          `            require recreation:  ${
            detail.Target!.RequiresRecreation
          }`,
        )
      })
    })

    const addCount = summary.get("Add")!.toString()
    const modifyCount = summary.get("Modify")!.toString()
    const removeCount = summary.get("Remove")!.toString()

    this.message(
      `Add: ${green(addCount)}, Modify: ${yellow(modifyCount)}, Remove: ${red(
        removeCount,
      )}`,
      true,
      true,
    )
  }

  confirmStackLaunch = async (
    stack: Stack,
    changeSet: DescribeChangeSetOutput,
    templateBody: string,
    cloudFormationClient: CloudFormationClient,
  ): Promise<ConfirmResult> => {
    if (this.autoConfirm) {
      return ConfirmResult.YES
    }

    this.printChangeSet(stack.getPath(), changeSet)

    const answer = await this.choose(
      "Deploy stack?",
      [
        {
          name: "yes",
          value: "y",
        },
        {
          name: "no",
          value: "n",
        },
        {
          name: "view template diff",
          value: "d",
        },
        {
          name: "yes to all",
          value: "a",
        },
      ],
      true,
    )

    if (answer === "d") {
      const currentTemplateBody = await cloudFormationClient.getCurrentTemplate(
        stack.getName(),
      )
      const lines = diffLines(currentTemplateBody, templateBody)
      const diffOutput = lines
        .map((line) => {
          if (line.added) return green(line.value)
          else if (line.removed) return red(line.value)
          else return line.value
        })
        .join("")

      this.message(diffOutput, true, true)

      return (await this.confirm("Launch stack"))
        ? ConfirmResult.YES
        : ConfirmResult.NO
    }

    if (answer === "a") {
      this.autoConfirm = true
      return ConfirmResult.YES
    }

    return answer === "y" ? ConfirmResult.YES : ConfirmResult.NO
  }

  printStackEvent = (
    stackPath: StackPath,
    e: CloudFormation.StackEvent,
  ): void => this.info(stackPath + " - " + formatStackEvent(e))

  private printStackDependencies = (
    stack: Stack,
    ctx: CommandContext,
    depth: number,
  ) => {
    stack.getDependencies().forEach((dependencyPath) => {
      const [dependency] = ctx.getStacksByPath(dependencyPath)
      const padding = " ".repeat(depth)
      const end = dependency.getDependencies().length > 0 ? ":" : ""

      this.message(`${padding}- ${dependencyPath}${end}`)

      this.printStackDependencies(dependency, ctx, depth + 2)
    })
  }
}