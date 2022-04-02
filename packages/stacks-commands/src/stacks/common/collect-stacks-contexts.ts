import { CommandPath, InternalStacksContext } from "@takomo/stacks-model"
import { arrayToMap, collectFromHierarchy } from "@takomo/util"

export const collectStacksContexts = (
  ctx: InternalStacksContext,
): Map<CommandPath, InternalStacksContext> => {
  const ctxs = collectFromHierarchy(ctx, (node) =>
    node.modules.map((m) => m.ctx),
  )
  return arrayToMap(ctxs, (c) => c.moduleInformation.path)
}
