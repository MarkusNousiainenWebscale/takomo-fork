import {
  ModuleConfig,
  StackConfig,
  StackGroupConfig,
} from "@takomo/stacks-config"
import {
  ModulePath,
  StackGroupName,
  StackGroupPath,
  StackPath,
} from "@takomo/stacks-model"

export interface StackConfigNode {
  readonly path: StackPath
  readonly getConfig: (variables: any) => Promise<StackConfig>
}

export interface ModuleConfigNode {
  readonly path: ModulePath
  readonly getConfig: (variables: any) => Promise<ModuleConfig>
}

export interface StackGroupConfigNode {
  readonly path: StackGroupPath
  readonly name: StackGroupName
  readonly parentPath?: StackGroupPath
  readonly getConfig: (variables: any) => Promise<StackGroupConfig | undefined>
  readonly children: ReadonlyArray<StackGroupConfigNode>
  readonly stacks: ReadonlyArray<StackConfigNode>
  readonly modules: ReadonlyArray<ModuleConfigNode>
}

export interface ConfigTree {
  readonly rootStackGroup: StackGroupConfigNode
}
