import {
  createFileSystemDeploymentTargetsConfigRepository,
  FileSystemCommandContext,
} from "@takomo/config-repository-fs"
import { InternalCommandContext } from "@takomo/core"
import { DeploymentTargetsConfigRepository } from "@takomo/deployment-targets-context"
import { createConsoleLogger } from "@takomo/util"
import { createTestCommandContext } from "../common"
import { CreateCtxAndConfigRepositoryProps } from "../stacks"

interface CtxAndConfigRepository {
  readonly ctx: InternalCommandContext
  readonly configRepository: DeploymentTargetsConfigRepository
}

export interface CreateDeploymentTargetsCtxAndConfigRepositoryProps
  extends CreateCtxAndConfigRepositoryProps {
  readonly pathToDeploymentConfigFile?: string
}

export interface CreateTestDeploymentTargetsConfigRepositoryProps {
  readonly ctx: FileSystemCommandContext
  readonly pathToDeploymentConfigFile?: string
}

export const createTestDeploymentTargetsConfigRepository = async ({
  ctx,
  pathToDeploymentConfigFile,
}: CreateTestDeploymentTargetsConfigRepositoryProps): Promise<DeploymentTargetsConfigRepository> =>
  createFileSystemDeploymentTargetsConfigRepository({
    ...ctx.filePaths,
    ctx,
    regions: ["eu-west-1", "eu-north-1", "us-east-1", "eu-central-1"],
    confidentialValuesLoggingEnabled: false,
    additionalConfiguration: {
      schemasDir: [],
      helpers: [],
      resolvers: [],
      helpersDir: [],
      partialsDir: [],
    },
    pathToDeploymentConfigFile,
    logger: createConsoleLogger({
      logLevel: ctx.logLevel,
    }),
  })

export const createCtxAndConfigRepository = async (
  props: CreateDeploymentTargetsCtxAndConfigRepositoryProps,
): Promise<CtxAndConfigRepository> => {
  const ctx = await createTestCommandContext(props)
  const configRepository = await createTestDeploymentTargetsConfigRepository({
    ctx,
    pathToDeploymentConfigFile: props.pathToDeploymentConfigFile,
  })
  return {
    ctx,
    configRepository,
  }
}
