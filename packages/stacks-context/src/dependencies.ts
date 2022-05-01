import {
  CommandPath,
  createStack,
  getStackPath,
  InternalModule,
  InternalStack,
  isModulePath,
  ModulePath,
  normalizeStackPath,
  StackPath,
  StackProps,
} from "@takomo/stacks-model"
import { arrayToMap, TakomoError } from "@takomo/util"
import R from "ramda"
import { ObsoleteDependenciesError } from "./errors"

export const checkCyclicDependenciesForStack = (
  stack: InternalStack,
  stacks: Map<StackPath, InternalStack>,
  modules: Map<ModulePath, InternalModule>,
  collectedDependencies: ReadonlyArray<StackPath>,
): void => {
  if (stack.dependencies.length === 0) {
    return
  }

  stack.dependencies.forEach((dependency) => {
    checkCyclicDependency(stacks, modules, collectedDependencies, dependency)
  })
}

export const checkCyclicDependenciesForModule = (
  module: InternalModule,
  stacks: Map<StackPath, InternalStack>,
  modules: Map<ModulePath, InternalModule>,
  collectedDependencies: ReadonlyArray<StackPath>,
): void => {
  if (module.moduleInformation.dependencies.length === 0) {
    return
  }

  module.moduleInformation.dependencies.forEach((dependency) => {
    checkCyclicDependency(stacks, modules, collectedDependencies, dependency)
  })
}

const checkCyclicDependency = (
  stacks: Map<StackPath, InternalStack>,
  modules: Map<ModulePath, InternalModule>,
  collectedDependencies: ReadonlyArray<StackPath>,
  dependency: CommandPath,
): void => {
  if (collectedDependencies.includes(dependency)) {
    throw new TakomoError(
      `Cyclic dependency detected: ${collectedDependencies.join(
        " -> ",
      )} -> ${dependency}`,
    )
  }

  if (isModulePath(dependency)) {
    const nextModule = modules.get(dependency)
    if (!nextModule) {
      throw new Error(
        `Expected module to exists with stack path: ${dependency}`,
      )
    }

    checkCyclicDependenciesForModule(nextModule, stacks, modules, [
      ...collectedDependencies,
      dependency,
    ])
  } else {
    const nextStack = stacks.get(dependency)
    if (!nextStack) {
      throw new Error(`Expected stack to exists with stack path: ${dependency}`)
    }

    checkCyclicDependenciesForStack(nextStack, stacks, modules, [
      ...collectedDependencies,
      dependency,
    ])
  }
}

export const checkCyclicDependencies = (
  stacks: Map<StackPath, InternalStack>,
  modules: Map<ModulePath, InternalModule>,
): void => {
  stacks.forEach((stack) =>
    checkCyclicDependenciesForStack(stack, stacks, modules, [stack.path]),
  )
  modules.forEach((module) =>
    checkCyclicDependenciesForModule(module, stacks, modules, [
      module.moduleInformation.path,
    ]),
  )
}

export const checkObsoleteDependencies = (
  stacks: Map<StackPath, InternalStack>,
  modules: Map<ModulePath, InternalModule>,
): void => {
  const stacksWithObsoleteDependencies = Array.from(stacks.values())
    .filter((stack) => !stack.obsolete)
    .map((stack) => {
      const obsoleteDependencies = stack.dependencies.filter(
        (dependencyPath) => {
          if (isModulePath(dependencyPath)) {
            const module = modules.get(dependencyPath)
            if (!module) {
              throw new Error(
                `Expected module to be found with path: ${dependencyPath}`,
              )
            }

            return module.moduleInformation.obsolete
          }

          const dependencyStack = stacks.get(dependencyPath)
          if (!dependencyStack) {
            throw new Error(
              `Expected stack to be found with path: ${dependencyPath}`,
            )
          }
          return dependencyStack.obsolete
        },
      )

      return {
        from: stack.path,
        to: obsoleteDependencies,
      }
    })
    .filter(({ to }) => to.length > 0)

  if (stacksWithObsoleteDependencies.length > 0) {
    throw new ObsoleteDependenciesError(stacksWithObsoleteDependencies)
  }

  const modulesWithObsoleteDependencies = Array.from(modules.values())
    .filter((module) => !module.moduleInformation.obsolete)
    .map((module) => {
      const obsoleteDependencies = module.moduleInformation.dependencies.filter(
        (dependencyPath) => {
          if (isModulePath(dependencyPath)) {
            const module = modules.get(dependencyPath)
            if (!module) {
              throw new Error(
                `Expected module to be found with path: ${dependencyPath}`,
              )
            }

            return module.moduleInformation.obsolete
          }

          const dependencyStack = stacks.get(dependencyPath)
          if (!dependencyStack) {
            throw new Error(
              `Expected stack to be found with path: ${dependencyPath}`,
            )
          }
          return dependencyStack.obsolete
        },
      )

      return {
        from: module.moduleInformation.path,
        to: obsoleteDependencies,
      }
    })
    .filter(({ to }) => to.length > 0)

  if (modulesWithObsoleteDependencies.length > 0) {
    throw new ObsoleteDependenciesError(modulesWithObsoleteDependencies)
  }
}

export const collectAllDependencies = (
  stackPath: StackPath,
  stacks: InternalStack[],
): StackPath[] => {
  const stack = stacks.find((s) => s.path === stackPath)!
  return R.uniq(
    stack.dependencies.reduce((collected, dependencyPath) => {
      const childDependencies = collectAllDependencies(dependencyPath, stacks)
      return [...collected, ...childDependencies, dependencyPath]
    }, new Array<StackPath>()),
  )
}

export const collectAllDependents = (
  stackPath: StackPath,
  stacks: InternalStack[],
): StackPath[] => {
  const stack = stacks.find((s) => s.path === stackPath)!
  return R.uniq(
    stack.dependents.reduce((collected, dependentPath) => {
      const childDependents = collectAllDependents(dependentPath, stacks)
      return [...collected, ...childDependents, dependentPath]
    }, new Array<StackPath>()),
  )
}

export const collectStackDirectDependents = (
  stackPath: StackPath,
  stacks: StackProps[],
): string[] =>
  stacks
    .filter((s) => s.path !== stackPath)
    .reduce((dependents, s) => {
      return s.dependencies.includes(stackPath)
        ? [...dependents, s.path]
        : dependents
    }, new Array<string>())

export const populateDependents = (stacks: StackProps[]): StackProps[] =>
  stacks.reduce((collected, stack) => {
    const dependents = collectStackDirectDependents(stack.path, stacks)
    return [...collected, { ...stack, dependents }]
  }, new Array<StackProps>())

export const processModuleDependencies = (
  modules: ReadonlyArray<InternalModule>,
  stacks: ReadonlyArray<InternalStack>,
  convertModuleDependencies: boolean,
): ReadonlyArray<InternalModule> => {
  const processed: ReadonlyArray<InternalModule> = modules.map((module) => {
    const moduleDependencies = module.moduleInformation.dependencies.map(
      (dependency) => {
        if (isModulePath(dependency)) {
          const matchingModule = modules.find(
            (m) => m.moduleInformation.path === dependency,
          )
          if (!matchingModule) {
            throw new TakomoError(
              `Dependency ${dependency} in module ${module.moduleInformation.path} refers to a non-existing module`,
            )
          }

          if (convertModuleDependencies) {
            return stacks
              .filter((other) => other.path.startsWith(dependency))
              .map(getStackPath)
          }

          return dependency
        }

        const matching = stacks
          .filter((other) => other.path.startsWith(dependency))
          .map(getStackPath)

        if (matching.length === 0) {
          throw new TakomoError(
            `Dependency ${dependency} in stack ${module.moduleInformation.path} refers to a non-existing stack`,
          )
        }

        return matching
      },
    )

    // TODO: inputs
    const parameterDependencies = new Array<CommandPath>()

    return {
      ...module,
      moduleInformation: {
        ...module.moduleInformation,
        dependencies: R.uniq(
          [...moduleDependencies, ...parameterDependencies].flat(),
        ),
      },
    }
  })

  // TODO: process dependents
  return processed
}

export const processStackDependencies = (
  stacks: ReadonlyArray<InternalStack>,
  modules: Map<ModulePath, InternalModule>,
  convertModuleDependencies: boolean,
): ReadonlyArray<InternalStack> => {
  const processed = stacks
    .map((stack) => stack.toProps())
    .map((stack) => {
      const stackDependencies = stack.dependencies.map((dependency) => {
        if (isModulePath(dependency)) {
          const module = modules.get(dependency)
          if (!module) {
            throw new TakomoError(
              `Dependency ${dependency} in stack ${stack.path} refers to a non-existing module`,
            )
          }

          if (convertModuleDependencies) {
            const moduleDependency =
              stack.moduleInformation.stackPathPrefix + dependency
            return stacks
              .filter((other) => other.path.startsWith(moduleDependency))
              .map(getStackPath)
          }

          return dependency
        }

        const matching = stacks
          .filter((other) => other.path.startsWith(dependency))
          .map(getStackPath)

        if (matching.length === 0) {
          throw new TakomoError(
            `Dependency ${dependency} in stack ${stack.path} refers to a non-existing stack`,
          )
        }

        return matching
      })

      const parameterDependencies = Array.from(
        stack.parameters.entries(),
      ).reduce((collected, [parameterName, resolver]) => {
        const matchingParamDeps = resolver
          .getDependencies()
          .map((dependency) => {
            const normalizedDependency = normalizeStackPath(
              stack.stackGroupPath,
              dependency,
            )

            const matching = stacks
              .filter((other) => other.path.startsWith(normalizedDependency))
              .map((other) => other.path)

            if (matching.length === 0) {
              throw new TakomoError(
                `Dependency ${dependency} in parameter ${parameterName} of stack ${stack.path} refers to a non-existing stack`,
              )
            }

            return matching
          })

        return [...collected, ...matchingParamDeps.flat()]
      }, new Array<StackPath>())

      return {
        ...stack,
        dependencies: R.uniq(
          [...stackDependencies, ...parameterDependencies].flat(),
        ),
      }
    })

  return populateDependents(processed).map((props) => createStack(props))
}

const sortStacks = (
  stacks: ReadonlyArray<InternalStack>,
  selector: (stack: InternalStack) => ReadonlyArray<StackPath>,
): ReadonlyArray<InternalStack> => {
  const unsorted = arrayToMap(stacks, getStackPath)
  const sorted = new Array<InternalStack>()
  while (unsorted.size > 0) {
    Array.from(unsorted.values())
      .filter((s) => selector(s).filter((d) => unsorted.has(d)).length === 0)
      .sort((a, b) => a.path.localeCompare(b.path))
      .forEach((s) => {
        sorted.push(s)
        unsorted.delete(s.path)
      })
  }

  return sorted
}

export const sortStacksForUndeploy = (
  stacks: ReadonlyArray<InternalStack>,
): ReadonlyArray<InternalStack> => sortStacks(stacks, (s) => s.dependents)

export const sortStacksForDeploy = (
  stacks: ReadonlyArray<InternalStack>,
): ReadonlyArray<InternalStack> => sortStacks(stacks, (s) => s.dependencies)
