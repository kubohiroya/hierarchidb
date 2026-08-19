import { gql } from 'graphql-request';

/** GraphQL documents for the pinned IDE-GSM frontend surface. */
export const ideGsmGraphqlDocuments = {
  importProject: gql`
    mutation ImportProject($projectSnapshot: String!, $projectRelativePath: String!) {
      importProject(
        input: { projectSnapshot: $projectSnapshot, projectRelativePath: $projectRelativePath }
      )
    }
  `,
  exportProject: gql`
    mutation ExportProject(
      $projectRelativePath: String!
      $include: [String]
      $exclude: [String]
    ) {
      exportProject(
        input: {
          projectRelativePath: $projectRelativePath
          include: $include
          exclude: $exclude
        }
      )
    }
  `,
  init: gql`
    mutation Init($projectRelativePath: String!, $token: String!, $url: String!) {
      init(input: { projectRelativePath: $projectRelativePath, token: $token, url: $url })
    }
  `,
  install: gql`
    mutation Install($projectRelativePath: String!, $force: Boolean) {
      install(input: { projectRelativePath: $projectRelativePath, force: $force })
    }
  `,
  checkAll: gql`
    mutation CheckAll($projectRelativePath: String!) {
      checkAll(input: { projectRelativePath: $projectRelativePath })
    }
  `,
  checkMerge: gql`
    mutation CheckMerge($projectRelativePath: String!) {
      checkMerge(input: { projectRelativePath: $projectRelativePath })
    }
  `,
  previewEvents: gql`
    mutation PreviewEvents(
      $projectRelativePath: String!
      $profile: String
      $yearFilter: Int
    ) {
      previewEvents(
        input: {
          projectRelativePath: $projectRelativePath
          profile: $profile
          yearFilter: $yearFilter
        }
      )
    }
  `,
  calibrate: gql`
    mutation Calibrate(
      $projectRelativePath: String!
      $profile: String
      $compute: String
      $apsp: String
      $purgeCache: Boolean
      $purgeCalib: Boolean
      $reset: Boolean
    ) {
      calibrate(
        input: {
          projectRelativePath: $projectRelativePath
          profile: $profile
          compute: $compute
          apsp: $apsp
          purgeCache: $purgeCache
          purgeCalib: $purgeCalib
          reset: $reset
        }
      )
    }
  `,
  simulate: gql`
    mutation Simulate(
      $projectRelativePath: String!
      $profile: String
      $compute: String
      $apsp: String
      $purgeCache: Boolean
      $reset: Boolean
    ) {
      simulate(
        input: {
          projectRelativePath: $projectRelativePath
          profile: $profile
          compute: $compute
          apsp: $apsp
          purgeCache: $purgeCache
          reset: $reset
        }
      )
    }
  `,
  purgeCache: gql`
    mutation PurgeCache($projectRelativePath: String!) {
      purgeCache(input: { projectRelativePath: $projectRelativePath })
    }
  `,
  calibrateRemote: gql`
    mutation CalibrateRemote(
      $projectRelativePath: String!
      $compute: String
      $apsp: String
      $purgeCache: Boolean
      $purgeCalib: Boolean
      $reset: Boolean
      $downloadCache: Boolean
    ) {
      calibrateRemote(
        input: {
          projectRelativePath: $projectRelativePath
          compute: $compute
          apsp: $apsp
          purgeCache: $purgeCache
          purgeCalib: $purgeCalib
          reset: $reset
          downloadCache: $downloadCache
        }
      )
    }
  `,
  simulateRemote: gql`
    mutation SimulateRemote(
      $projectRelativePath: String!
      $compute: String
      $apsp: String
      $purgeCache: Boolean
      $reset: Boolean
      $downloadCache: Boolean
    ) {
      simulateRemote(
        input: {
          projectRelativePath: $projectRelativePath
          compute: $compute
          apsp: $apsp
          purgeCache: $purgeCache
          reset: $reset
          downloadCache: $downloadCache
        }
      )
    }
  `,
  startContainerRemote: gql`
    mutation StartContainerRemote {
      startContainerRemote
    }
  `,
  stopContainerRemote: gql`
    mutation StopContainerRemote {
      stopContainerRemote
    }
  `,
  calibrateSsh: gql`
    mutation CalibrateSsh(
      $projectRelativePath: String!
      $compute: String
      $apsp: String
      $purgeCache: Boolean
      $purgeCalib: Boolean
      $reset: Boolean
      $downloadCache: Boolean
    ) {
      calibrateSsh(
        input: {
          projectRelativePath: $projectRelativePath
          compute: $compute
          apsp: $apsp
          purgeCache: $purgeCache
          purgeCalib: $purgeCalib
          reset: $reset
          downloadCache: $downloadCache
        }
      )
    }
  `,
  simulateSsh: gql`
    mutation SimulateSsh(
      $projectRelativePath: String!
      $compute: String
      $apsp: String
      $purgeCache: Boolean
      $reset: Boolean
      $downloadCache: Boolean
    ) {
      simulateSsh(
        input: {
          projectRelativePath: $projectRelativePath
          compute: $compute
          apsp: $apsp
          purgeCache: $purgeCache
          reset: $reset
          downloadCache: $downloadCache
        }
      )
    }
  `,
  calibrateEc2: gql`
    mutation CalibrateEc2(
      $projectRelativePath: String!
      $compute: String
      $apsp: String
      $purgeCache: Boolean
      $purgeCalib: Boolean
      $reset: Boolean
      $downloadCache: Boolean
    ) {
      calibrateEc2(
        input: {
          projectRelativePath: $projectRelativePath
          compute: $compute
          apsp: $apsp
          purgeCache: $purgeCache
          purgeCalib: $purgeCalib
          reset: $reset
          downloadCache: $downloadCache
        }
      )
    }
  `,
  simulateEc2: gql`
    mutation SimulateEc2(
      $projectRelativePath: String!
      $compute: String
      $apsp: String
      $purgeCache: Boolean
      $reset: Boolean
      $downloadCache: Boolean
    ) {
      simulateEc2(
        input: {
          projectRelativePath: $projectRelativePath
          compute: $compute
          apsp: $apsp
          purgeCache: $purgeCache
          reset: $reset
          downloadCache: $downloadCache
        }
      )
    }
  `,
  startContainerEc2: gql`
    mutation StartContainerEc2 {
      startContainerEc2
    }
  `,
  stopContainerEc2: gql`
    mutation StopContainerEc2 {
      stopContainerEc2
    }
  `,
  rsyncPush: gql`
    mutation RsyncPush(
      $projectRelativePath: String!
      $connectionType: String!
      $include: [String]
      $exclude: [String]
    ) {
      rsyncPush(
        input: {
          projectRelativePath: $projectRelativePath
          connectionType: $connectionType
          include: $include
          exclude: $exclude
        }
      )
    }
  `,
  rsyncPull: gql`
    mutation RsyncPull(
      $projectRelativePath: String!
      $connectionType: String!
      $include: [String]
      $exclude: [String]
    ) {
      rsyncPull(
        input: {
          projectRelativePath: $projectRelativePath
          connectionType: $connectionType
          include: $include
          exclude: $exclude
        }
      )
    }
  `,
  subscribeTask: gql`
    subscription SubscribeTask($taskId: String!) {
      subscribeTaskOnFrontend(taskId: $taskId) {
        id
        status
        paramsJson
        resultJson
      }
    }
  `,
} as const;
