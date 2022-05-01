import { StackPath } from "@takomo/stacks-model"
import { TakomoError } from "@takomo/util"

interface Reference {
  readonly from: StackPath
  readonly to: ReadonlyArray<StackPath>
}

/**
 * @hidden
 */
export class ObsoleteDependenciesError extends TakomoError {
  constructor(references: ReadonlyArray<Reference>) {
    const message =
      `Dependencies to obsolete stacks/modules detected.\n\nThe following ${references.length} stack(s) depend on stacks/modules marked as obsolete:\n\n` +
      references.map(
        ({ from, to }) =>
          `  ${from}:\n${to
            .slice()
            .sort()
            .map((t) => `    - ${t} (marked as obsolete)\n`)
            .join("")}`,
      )

    super(message, {
      info: "Stacks can't have dependencies on stacks or modules marked as obsolete.",
      instructions: ["Remove dependencies to obsolete stacks/modules."],
    })
  }
}
