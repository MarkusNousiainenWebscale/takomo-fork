import { Region } from "@takomo/aws-model"
import { createFileSystemProjectConfigRepository } from "@takomo/config-repository-fs"
import { CommandContext, Project } from "@takomo/core"
import {
  initProjectCommand,
  ProjectConfigRepository,
} from "@takomo/init-command"
import { createConsoleLogger, createTimer } from "@takomo/util"
import {
  createInitProjectOutputMatcher,
  InitProjectOutputMatcher,
} from "../assertions/init"
import { createTestInitProjectIO } from "../io"
import { createTestCommandContext, ExecuteCommandProps } from "./common"
import {
  CreateCtxAndConfigRepositoryProps,
  CreateTestStacksConfigRepositoryProps,
} from "./stacks"

export const createTestProjectConfigRepository = async ({
  ctx,
}: CreateTestStacksConfigRepositoryProps): Promise<ProjectConfigRepository> =>
  createFileSystemProjectConfigRepository({
    ...ctx.filePaths,
    ctx,
    logger: createConsoleLogger({
      logLevel: ctx.logLevel,
    }),
  })

interface CtxAndConfigRepository {
  ctx: CommandContext
  configRepository: ProjectConfigRepository
}

const createCtxAndConfigRepository = async (
  props: CreateCtxAndConfigRepositoryProps,
): Promise<CtxAndConfigRepository> => {
  const ctx = await createTestCommandContext(props)
  const configRepository = await createTestProjectConfigRepository({ ctx })
  return {
    ctx,
    configRepository,
  }
}

interface ExecuteInitProjectProps extends ExecuteCommandProps {
  readonly createSamples?: boolean
  readonly project?: Project
  readonly regions?: ReadonlyArray<Region>
}

export const executeInitProjectCommand = (
  props: ExecuteInitProjectProps,
): InitProjectOutputMatcher =>
  createInitProjectOutputMatcher(async () => {
    const logLevel = props.logLevel ?? "info"

    const ctxAndConfig = await createCtxAndConfigRepository({
      projectDir: props.projectDir,
      autoConfirmEnabled: props.autoConfirmEnabled ?? true,
      ignoreDependencies: props.ignoreDependencies ?? false,
      var: props.var ?? [],
      varFile: props.varFile ?? [],
      logLevel,
    })

    const logger = createConsoleLogger({
      logLevel,
    })

    const { project, createSamples, regions } = props
    return initProjectCommand({
      ...ctxAndConfig,
      io: createTestInitProjectIO(logger),
      input: {
        timer: createTimer("total"),
        project,
        createSamples,
        regions,
      },
    })
  })