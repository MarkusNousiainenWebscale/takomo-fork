import { ClientRequestToken, Tag } from "./common"

/**
 * CloudFormation stack id.
 */
export type StackId = string

/**
 * CloudFormation stack name.
 */
export type StackName = string

/**
 * CloudFormation stack status.
 */
export type StackStatus =
  | "CREATE_IN_PROGRESS"
  | "CREATE_FAILED"
  | "CREATE_COMPLETE"
  | "ROLLBACK_IN_PROGRESS"
  | "ROLLBACK_FAILED"
  | "ROLLBACK_COMPLETE"
  | "DELETE_IN_PROGRESS"
  | "DELETE_FAILED"
  | "DELETE_COMPLETE"
  | "DELETE_SKIPPED"
  | "UPDATE_IN_PROGRESS"
  | "UPDATE_FAILED"
  | "UPDATE_COMPLETE_CLEANUP_IN_PROGRESS"
  | "UPDATE_COMPLETE"
  | "UPDATE_ROLLBACK_IN_PROGRESS"
  | "UPDATE_ROLLBACK_FAILED"
  | "UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS"
  | "UPDATE_ROLLBACK_COMPLETE"
  | "REVIEW_IN_PROGRESS"
  | "IMPORT_IN_PROGRESS"
  | "IMPORT_COMPLETE"
  | "IMPORT_ROLLBACK_IN_PROGRESS"
  | "IMPORT_ROLLBACK_FAILED"
  | "IMPORT_ROLLBACK_COMPLETE"

/**
 * @hidden
 */
export const ACTIVE_STACK_STATUSES: ReadonlyArray<StackStatus> = [
  "CREATE_IN_PROGRESS",
  "CREATE_FAILED",
  "CREATE_COMPLETE",
  "ROLLBACK_IN_PROGRESS",
  "ROLLBACK_FAILED",
  "ROLLBACK_COMPLETE",
  "DELETE_IN_PROGRESS",
  "DELETE_FAILED",
  "UPDATE_IN_PROGRESS",
  "UPDATE_COMPLETE_CLEANUP_IN_PROGRESS",
  "UPDATE_COMPLETE",
  "UPDATE_ROLLBACK_IN_PROGRESS",
  "UPDATE_ROLLBACK_FAILED",
  "UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS",
  "UPDATE_ROLLBACK_COMPLETE",
  "REVIEW_IN_PROGRESS",
  "IMPORT_IN_PROGRESS",
  "IMPORT_COMPLETE",
  "IMPORT_ROLLBACK_IN_PROGRESS",
  "IMPORT_ROLLBACK_FAILED",
  "IMPORT_ROLLBACK_COMPLETE",
]

/**
 * CloudFormation stack status reason.
 */
export type StackStatusReason = string

/**
 * CloudFormation stack termination protection.
 */
export type EnableTerminationProtection = boolean

/**
 * CloudFormation stack capability.
 */
export type StackCapability =
  | "CAPABILITY_IAM"
  | "CAPABILITY_NAMED_IAM"
  | "CAPABILITY_AUTO_EXPAND"

/**
 * CloudFormation stack parameter key.
 */
export type StackParameterKey = string

/**
 * CloudFormation stack parameter value.
 */
export type StackParameterValue = string

/**
 * CloudFormation stack parameter value.
 */
export type StackParameterNoEcho = boolean

/**
 * CloudFormation stack parameter description.
 */
export type StackParameterDescription = string

/**
 * CloudFormation stack parameter.
 */
export interface StackParameter {
  readonly key: StackParameterKey
  readonly value: StackParameterValue
}

/**
 * CloudFormation parameter declaration.
 */
export interface ParameterDeclaration {
  readonly key: StackParameterKey
  readonly description: StackParameterDescription
  readonly noEcho: StackParameterNoEcho
  readonly defaultValue?: StackParameterValue
}

/**
 * Detailed CloudFormation stack parameter.
 */
export type DetailedStackParameter = StackParameter & ParameterDeclaration

/**
 * CloudFormation stack output value.
 */
export type StackOutputValue = string

/**
 * CloudFormation stack output key.
 */
export type StackOutputKey = string

/**
 * CloudFormation stack output description.
 */
export type StackOutputDescription = string

/**
 * CloudFormation stack output.
 */
export interface StackOutput {
  readonly value: StackOutputValue
  readonly key: StackOutputKey
  readonly description: StackOutputDescription
}

/**
 * CloudFormation stack creation time.
 */
export type CreationTime = Date

/**
 * CloudFormation stack last updated time.
 */
export type LastUpdatedTime = Date

/**
 * CloudFormation stack deletion time.
 */
export type DeletionTime = Date

/**
 * CloudFormation stack summary.
 */
export interface CloudFormationStackSummary {
  readonly id: StackId
  readonly name: StackName
  readonly status: StackStatus
  readonly statusReason: StackStatusReason
  readonly creationTime: CreationTime
  readonly lastUpdatedTime?: LastUpdatedTime
  readonly deletionTime?: DeletionTime
  readonly driftInformation: StackDriftInformation
}

/**
 * Detailed CloudFormation stack summary.
 */
export interface DetailedCloudFormationStackSummary
  extends CloudFormationStackSummary {
  readonly templateDescription: TemplateDescription
}

interface BaseCloudFormationStack<P> extends CloudFormationStackSummary {
  readonly parameters: ReadonlyArray<P>
  readonly capabilities: ReadonlyArray<StackCapability>
  readonly enableTerminationProtection: EnableTerminationProtection
  readonly outputs: ReadonlyArray<StackOutput>
  readonly tags: ReadonlyArray<Tag>
}

/**
 * CloudFormation stack.
 */
export type CloudFormationStack = BaseCloudFormationStack<StackParameter>

/**
 * CloudFormation stack template.
 */
export type TemplateBody = string

/**
 * CloudFormation stack template description.
 */
export type TemplateDescription = string

/**
 * CloudFormation stack policy.
 */
export type StackPolicyBody = string

/**
 * Detailed CloudFormation stack.
 */
export interface DetailedCloudFormationStack
  extends BaseCloudFormationStack<DetailedStackParameter> {
  readonly templateBody: TemplateBody
  readonly stackPolicyBody?: StackPolicyBody
}

export interface TemplateSummary {
  readonly parameters: ReadonlyArray<ParameterDeclaration>
}

export type LogicalResourceId = string
export type PhysicalResourceId = string
export type ResourceType = string
export type ResourceProperties = string
export type ResourceStatusReason = string
export type ResourceStatus =
  | "CREATE_IN_PROGRESS"
  | "CREATE_FAILED"
  | "CREATE_COMPLETE"
  | "DELETE_IN_PROGRESS"
  | "DELETE_FAILED"
  | "DELETE_COMPLETE"
  | "DELETE_SKIPPED"
  | "UPDATE_IN_PROGRESS"
  | "UPDATE_FAILED"
  | "UPDATE_COMPLETE"
  | "IMPORT_FAILED"
  | "IMPORT_COMPLETE"
  | "IMPORT_IN_PROGRESS"
  | "IMPORT_ROLLBACK_IN_PROGRESS"
  | "IMPORT_ROLLBACK_FAILED"
  | "IMPORT_ROLLBACK_COMPLETE"
  | "ROLLBACK_COMPLETE"
  | "ROLLBACK_FAILED"
  | "UPDATE_ROLLBACK_COMPLETE"
  | "UPDATE_ROLLBACK_FAILED"

export type EventId = string

export interface StackEvent {
  id: EventId
  stackId: StackId
  stackName: StackName
  logicalResourceId: LogicalResourceId
  physicalResourceId?: PhysicalResourceId
  resourceType: ResourceType
  timestamp: Date
  resourceStatus: ResourceStatus
  resourceStatusReason?: ResourceStatusReason
  resourceProperties?: ResourceProperties
  clientRequestToken: ClientRequestToken
}

export type ChangeSetId = string
export type ChangeSetName = string
export type ChangeSetStatusReason = string
export type ChangeSetType = "CREATE" | "UPDATE"
export type ChangeSetStatus =
  | "CREATE_PENDING"
  | "CREATE_IN_PROGRESS"
  | "CREATE_COMPLETE"
  | "DELETE_COMPLETE"
  | "FAILED"

export type ResourceAttribute =
  | "Properties"
  | "Metadata"
  | "CreationPolicy"
  | "UpdatePolicy"
  | "DeletionPolicy"
  | "Tags"

export type ChangeSource =
  | "ResourceReference"
  | "ParameterReference"
  | "ResourceAttribute"
  | "DirectModification"
  | "Automatic"

export type CausingEntity = string
export type RequiresRecreation = "Never" | "Conditionally" | "Always"
export type PropertyName = string
export type EvaluationType = "Static" | "Dynamic"

export interface ResourceTargetDefinition {
  readonly attribute: ResourceAttribute
  readonly name: PropertyName
  readonly requiresRecreation: RequiresRecreation
}

export interface ResourceChangeDetail {
  readonly target?: ResourceTargetDefinition
  readonly evaluation: EvaluationType
  readonly changeSource: ChangeSource
  readonly causingEntity?: CausingEntity
}

export type ChangeType = "Resource"
export type ResourceChangeAction = "Add" | "Modify" | "Remove" | "Import"
export type ResourceChangeReplacement = "True" | "False" | "Conditional"

export interface ResourceChange {
  readonly action: ResourceChangeAction
  readonly logicalResourceId: LogicalResourceId
  readonly physicalResourceId?: PhysicalResourceId
  readonly resourceType: ResourceType
  readonly replacement: ResourceChangeReplacement
  readonly scope: ReadonlyArray<ResourceAttribute>
  readonly details: ReadonlyArray<ResourceChangeDetail>
}

export interface Change {
  readonly type: ChangeType
  readonly resourceChange: ResourceChange
}

export interface BaseChangeSet<P> {
  readonly id: ChangeSetId
  readonly name: ChangeSetName
  readonly stackId: StackId
  readonly status: ChangeSetStatus
  readonly statusReason: ChangeSetStatusReason
  readonly parameters: ReadonlyArray<P>
  readonly changes: ReadonlyArray<Change>
  readonly tags: ReadonlyArray<Tag>
}

export type ChangeSet = BaseChangeSet<StackParameter>

export type DetailedChangeSet = BaseChangeSet<DetailedStackParameter>

/**
 * @hidden
 */
export const isTerminalResourceStatus = (status: ResourceStatus): boolean => {
  switch (status) {
    case "CREATE_COMPLETE":
    case "DELETE_COMPLETE":
    case "ROLLBACK_COMPLETE":
    case "UPDATE_COMPLETE":
    case "ROLLBACK_FAILED":
    case "CREATE_FAILED":
    case "DELETE_FAILED":
    case "IMPORT_FAILED":
    case "IMPORT_COMPLETE":
    case "IMPORT_ROLLBACK_COMPLETE":
    case "IMPORT_ROLLBACK_FAILED":
    case "UPDATE_ROLLBACK_COMPLETE":
    case "UPDATE_ROLLBACK_FAILED":
      return true
    default:
      return false
  }
}

/**
 * @hidden
 */
export const ALLOW_ALL_STACK_POLICY = `{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "Update:*",
      "Principal": "*",
      "Resource": "*"
    }
  ]
}
`

export type StackDriftDetectionId = string
export type StackDriftDetectionStatusReason = string
export type StackDriftStatus = "DRIFTED" | "IN_SYNC" | "UNKNOWN" | "NOT_CHECKED"
export type StackDriftDetectionStatus =
  | "DETECTION_IN_PROGRESS"
  | "DETECTION_FAILED"
  | "DETECTION_COMPLETE"

export interface StackDriftDetectionStatusOutput {
  readonly stackId: StackId
  readonly stackDriftDetectionId: StackDriftDetectionId
  readonly stackDriftStatus: StackDriftStatus
  readonly detectionStatus: StackDriftDetectionStatus
  readonly detectionStatusReason: StackDriftDetectionStatusReason
  readonly driftedStackResourceCount: number
  readonly timestamp: Date
}

export interface StackDriftInformation {
  stackDriftStatus: StackDriftStatus
  lastCheckTimestamp?: Date
}
