import { initDefaultCredentialProvider } from "@takomo/core"
import { CloudFormation, Credentials, Organizations } from "aws-sdk"
import { Organization, PolicyType, Root } from "aws-sdk/clients/organizations"

const organizationsClient = new Organizations({
  region: "us-east-1",
})

const cloudFormationClient = (
  region: string,
  credentials: Credentials,
): CloudFormation => new CloudFormation({ region, credentials })

const listAWSServiceAccessForOrganization = async (): Promise<string[]> =>
  organizationsClient
    .listAWSServiceAccessForOrganization()
    .promise()
    .then((res) =>
      res.EnabledServicePrincipals!.map((s) => s.ServicePrincipal!),
    )

const describeOrganization = async (): Promise<Organization> =>
  organizationsClient
    .describeOrganization()
    .promise()
    .then((res) => res.Organization!)

const getRootOrganizationalUnit = async (): Promise<Root> =>
  organizationsClient
    .listRoots()
    .promise()
    .then((res) => res.Roots![0])

const getEnabledPolicyTypes = async (): Promise<PolicyType[]> =>
  getRootOrganizationalUnit().then((root) =>
    root.PolicyTypes!.map((p) => p.Type!),
  )

const deleteOrganization = async (): Promise<boolean> =>
  organizationsClient
    .deleteOrganization()
    .promise()
    .then(() => true)

const deleteOrganizationIfPresent = async (): Promise<boolean> =>
  describeOrganization()
    .then(() => deleteOrganization())
    .then(() => true)
    .catch(() => false)

const describeStack = async (
  iamRoleArn: string,
  region: string,
  stackName: string,
): Promise<CloudFormation.Stack> => {
  const cp = await initDefaultCredentialProvider()
  const roleCp = await cp.createCredentialProviderForRole(iamRoleArn)
  return cloudFormationClient(region, await roleCp.getCredentials())
    .describeStacks({ StackName: stackName })
    .promise()
    .then((res) => res.Stacks![0])
}

export const aws = {
  organizations: {
    describeOrganization,
    getRoot: getRootOrganizationalUnit,
    getEnabledPolicyTypes,
    deleteOrganization,
    deleteOrganizationIfPresent,
    listAWSServiceAccessForOrganization,
  },
  cloudFormation: {
    describeStack,
  },
}