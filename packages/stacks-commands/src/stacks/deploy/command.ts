import { CommandContext, CommandHandler } from "@takomo/core"
import {
  buildStacksContext,
  StacksConfigRepository,
} from "@takomo/stacks-context"
import { InternalStacksContext } from "@takomo/stacks-model"
import { createStacksSchemas } from "@takomo/stacks-schema"
import { validateInput } from "@takomo/util"
import Joi, { AnySchema } from "joi"
import { StacksDeployOperationInput, StacksOperationOutput } from "../../model"
import { collectStacksContexts } from "../common/collect-stacks-contexts"
import { collectStacksRecursively } from "../list/list-stacks"
import { executeDeployContext } from "./execute-deploy-context"
import { DeployStacksIO } from "./model"
import { buildStacksDeployPlan } from "./plan"
import { validateStacksDeployPlan } from "./validate"

const modifyInput = async (
  input: StacksDeployOperationInput,
  ctx: InternalStacksContext,
  io: DeployStacksIO,
): Promise<StacksDeployOperationInput> => {
  if (input.interactive) {
    const commandPath = await io.chooseCommandPath(ctx.rootStackGroup)
    return {
      ...input,
      commandPath,
    }
  }

  return input
}

const deployStacks = async (
  ctx: InternalStacksContext,
  io: DeployStacksIO,
  input: StacksDeployOperationInput,
): Promise<StacksOperationOutput> => {
  const modifiedInput = await modifyInput(input, ctx, io)

  const plan = await buildStacksDeployPlan(
    collectStacksRecursively(ctx),
    modifiedInput.commandPath,
    modifiedInput.ignoreDependencies,
    io,
  )

  await validateStacksDeployPlan(plan)

  const ctxMap = collectStacksContexts(ctx)

  return executeDeployContext(
    ctxMap,
    modifiedInput,
    io,
    plan,
    ctx.autoConfirmEnabled,
    ctx.concurrentStacks,
  )
}

const inputSchema = (ctx: CommandContext): AnySchema => {
  const { commandPath } = createStacksSchemas({ regions: ctx.regions })
  return Joi.object({
    commandPath: commandPath.required(),
  }).unknown(true)
}

export const deployStacksCommand: CommandHandler<
  StacksConfigRepository,
  DeployStacksIO,
  StacksDeployOperationInput,
  StacksOperationOutput
> = ({
  credentialManager,
  ctx,
  input,
  configRepository,
  io,
}): Promise<StacksOperationOutput> =>
  validateInput(inputSchema(ctx), input)
    .then((input) =>
      buildStacksContext({
        ctx,
        configRepository,
        commandPath: input.interactive ? undefined : input.commandPath,
        logger: io,
        credentialManager,
      }),
    )
    .then((ctx) => deployStacks(ctx, io, input))
    .then(io.printOutput)
