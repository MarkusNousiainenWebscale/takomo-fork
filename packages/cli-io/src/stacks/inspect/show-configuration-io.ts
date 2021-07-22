import {
  ShowConfigurationIO,
  ShowConfigurationOutput,
} from "@takomo/stacks-commands"
import { StackGroup } from "@takomo/stacks-model"
import { formatYaml, toPrettyJson } from "@takomo/util"
import { createBaseIO } from "../../cli-io"
import { chooseCommandPathInternal, IOProps } from "../common"

export const createShowConfigurationIO = (
  props: IOProps,
): ShowConfigurationIO => {
  const { logger } = props
  const io = createBaseIO(props)

  const printOutput = (
    output: ShowConfigurationOutput,
  ): ShowConfigurationOutput => {
    const { stacks, outputFormat } = output

    switch (outputFormat) {
      case "json":
        io.message({
          text: toPrettyJson({
            status: output.status,
            success: output.success,
            stacks: output.stacks,
            message: output.message,
            error: output.error,
            secondsElapsed: output.timer.getSecondsElapsed(),
          }),
        })
        break
      case "yaml":
        io.message({
          text: formatYaml({
            status: output.status,
            success: output.success,
            stacks: output.stacks,
            message: output.message,
            error: output.error,
            secondsElapsed: output.timer.getSecondsElapsed(),
          }),
        })
        break
      default:
        io.message({ text: toPrettyJson(stacks) })
    }

    return output
  }

  const chooseCommandPath = (rootStackGroup: StackGroup) =>
    chooseCommandPathInternal(io, rootStackGroup)

  return {
    ...logger,
    chooseCommandPath,
    printOutput,
  }
}
