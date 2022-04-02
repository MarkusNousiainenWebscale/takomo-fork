import { InternalStacksContext } from "./context"
import { StackGroup } from "./stack-group"

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
  readonly path: ModulePath
  readonly name: ModuleName
  readonly ctx: InternalStacksContext
  readonly parent: StackGroup
  readonly root: StackGroup
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
