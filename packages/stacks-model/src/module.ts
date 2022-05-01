import { ROOT_STACK_GROUP_PATH } from "./constants"
import { StackGroup, StackGroupPath } from "./stack-group"

/**
 * Module path
 */
export type ModulePath = string

/**
 * Module id
 */
export type ModuleId = string

/**
 * Module version
 */
export type ModuleVersion = string

/**
 * Module name
 */
export type ModuleName = string

/**
 * @hidden
 */
export interface InternalModule {
  readonly parentPath?: StackGroupPath
  // readonly name: ModuleName
  // readonly ctx: InternalStacksContext
  // readonly parent: StackGroup
  readonly root: StackGroup
  readonly moduleInformation: ModuleInformation
  readonly ignore: boolean
  readonly obsolete: boolean
}

/**
 * @hidden
 */
export interface ModuleInformation {
  readonly path: ModulePath
  readonly name: ModuleName
  readonly isRoot: boolean
  readonly stackNamePrefix: string
  readonly stackPathPrefix: string
}

/**
 * @hidden
 */
export const createRootModuleInformation = (): ModuleInformation => ({
  path: ROOT_STACK_GROUP_PATH,
  name: "",
  stackPathPrefix: "",
  stackNamePrefix: "",
  isRoot: true,
})
