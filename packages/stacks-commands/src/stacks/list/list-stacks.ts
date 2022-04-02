import {
  InternalStack,
  InternalStacksContext,
  isNotObsolete,
  isWithinCommandPath,
} from "@takomo/stacks-model"
import { TkmLogger } from "@takomo/util"
import { loadCurrentCfStacks } from "../common/load-current-cf-stacks"
import { ListStacksInput, ListStacksOutput } from "./model"

export const collectStacksRecursively = (
  ctx: InternalStacksContext,
): ReadonlyArray<InternalStack> => {
  const moduleStacks = ctx.modules
    .map((module) => collectStacksRecursively(module.ctx))
    .flat()

  return [...ctx.stacks, ...moduleStacks]
}

export const listStacks = async (
  ctx: InternalStacksContext,
  input: ListStacksInput,
  logger: TkmLogger,
): Promise<ListStacksOutput> => {
  const { timer, commandPath, outputFormat } = input

  const stacksWithinCommandPath = collectStacksRecursively(ctx)
    .filter((stack) => isWithinCommandPath(stack.path, commandPath))
    .filter(isNotObsolete)

  const stackPairs = await loadCurrentCfStacks(logger, stacksWithinCommandPath)

  const results = stackPairs.map(({ stack, current }) => ({
    path: stack.path,
    name: stack.name,
    status: current?.status,
    createdTime: current?.creationTime,
    updatedTime: current?.lastUpdatedTime,
  }))

  timer.stop()

  return {
    success: true,
    status: "SUCCESS",
    message: "Success",
    outputFormat,
    timer,
    results,
  }
}
