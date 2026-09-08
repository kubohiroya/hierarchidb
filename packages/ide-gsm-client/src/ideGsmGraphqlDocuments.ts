import { gql } from 'graphql-request';

/** GraphQL documents for the pinned IDE-GSM frontend surface. */
export const ideGsmGraphqlDocuments = {
  fdmSpaces: gql`
    query FdmSpaces {
      fdmSpaces {
        defaultSpaceId
        spaces {
          spaceId
          label
          defaultSpace
          visible
          archived
          owner
          layoutVersion
          legacyRoot
          order
          createdAt
          defaults {
            profile
            dataset
            compute
            timeline
          }
          warnings
        }
      }
    }
  `,
  fdmDirectoryTree: gql`
    query FdmDirectoryTree($spaceId: String, $path: String, $depth: Int) {
      fdmDirectoryTree(input: { spaceId: $spaceId, path: $path, depth: $depth }) {
        selectedPath
        maxDepth
        root {
          name
          relativePath
          kind
          directory
          exists
          sizeBytes
          updatedAt
          childCount
          children {
            name
            relativePath
            kind
            directory
            exists
            sizeBytes
            updatedAt
            childCount
            children {
              name
              relativePath
              kind
              directory
              exists
              sizeBytes
              updatedAt
              childCount
              children {
                name
                relativePath
                kind
                directory
                exists
                sizeBytes
                updatedAt
                childCount
              }
            }
          }
        }
      }
    }
  `,
  fdmDirectoryInfo: gql`
    query FdmDirectoryInfo($spaceId: String, $path: String, $depth: Int) {
      fdmDirectoryInfo(input: { spaceId: $spaceId, path: $path, depth: $depth }) {
        requestedPath
        descendantCount
        node {
          name
          relativePath
          kind
          directory
          exists
          sizeBytes
          updatedAt
          childCount
          children {
            name
            relativePath
            kind
            directory
            exists
            sizeBytes
            updatedAt
            childCount
          }
        }
      }
    }
  `,
  fdmDirectoryRemove: gql`
    mutation FdmDirectoryRemove($spaceId: String!, $path: String!, $apply: Boolean!) {
      fdmDirectoryRemove(input: { spaceId: $spaceId, path: $path, apply: $apply }) {
        targetPath
        apply
        existed
        deleted
        deletedFiles
        deletedBytes
        target {
          name
          relativePath
          kind
          directory
          exists
          sizeBytes
          updatedAt
          childCount
          children {
            name
            relativePath
            kind
            directory
            exists
            sizeBytes
            updatedAt
            childCount
          }
        }
      }
    }
  `,
  fdmSpaceCreate: gql`
    mutation FdmSpaceCreate($spaceId: String, $label: String, $defaultSpace: Boolean) {
      fdmSpaceCreate(input: { spaceId: $spaceId, label: $label, defaultSpace: $defaultSpace }) {
        spaceId
        label
        defaultSpace
        visible
        archived
        owner
        layoutVersion
        legacyRoot
        order
        createdAt
        defaults {
          profile
          dataset
          compute
          timeline
        }
        warnings
      }
    }
  `,
  fdmSpaceUpdate: gql`
    mutation FdmSpaceUpdate(
      $spaceId: String!
      $label: String
      $visible: Boolean
      $archived: Boolean
      $defaultSpace: Boolean
      $order: Int
    ) {
      fdmSpaceUpdate(
        input: {
          spaceId: $spaceId
          label: $label
          visible: $visible
          archived: $archived
          defaultSpace: $defaultSpace
          order: $order
        }
      ) {
        spaceId
        label
        defaultSpace
        visible
        archived
        owner
        layoutVersion
        legacyRoot
        order
        createdAt
        defaults {
          profile
          dataset
          compute
          timeline
        }
        warnings
      }
    }
  `,
  fdmSpaceDelete: gql`
    mutation FdmSpaceDelete(
      $spaceId: String!
      $apply: Boolean
      $deleteFiles: Boolean
      $confirmation: String
    ) {
      fdmSpaceDelete(
        input: {
          spaceId: $spaceId
          apply: $apply
          deleteFiles: $deleteFiles
          confirmation: $confirmation
        }
      ) {
        apply
        archived
        byteCount
        confirmed
        deleted
        fileCount
        physicalDelete
        spaceId
        topLevelEntries
        spaces {
          defaultSpaceId
          spaces {
            spaceId
            label
            defaultSpace
            visible
            archived
            owner
            layoutVersion
            legacyRoot
            order
            createdAt
            defaults {
              profile
              dataset
              compute
              timeline
            }
            warnings
          }
        }
      }
    }
  `,
  fdmDashboardStatus: gql`
    query FdmDashboardStatus(
      $spaceId: String!
      $parameterSet: String
      $profile: String
      $dataset: String
      $compute: String
      $timeline: String
      $stateDir: String
    ) {
      fdmDashboardStatus(
        input: {
          spaceId: $spaceId
          parameterSet: $parameterSet
          profile: $profile
          dataset: $dataset
          compute: $compute
          timeline: $timeline
          stateDir: $stateDir
        }
      ) {
        generatedAt
        selectedSpaceId
        selectedStateDir
        availableStateDirs
        parameterSet
        profile
        dataset
        compute
        timeline
        state {
          status
        }
        live {
          status
          startedAt
        }
        startup {
          ready
          phase
          startedAt
          finishedAt
          waitedMillis
          waitingForHolder
          apiStartupLock {
            active
            acquiredAt
            ageMillis
            fileName
            host
            owner
            pid
            role
            staleMetadata
          }
          simulatorLock {
            active
            acquiredAt
            ageMillis
            fileName
            host
            owner
            pid
            role
            staleMetadata
          }
        }
        cells {
          parameterSet
          profile
          dataset
          compute
          timelinePoint
          checkpoint
          label
          source
          bucket
          rawStatus
          accuracyLabel
          summaryFile
          current
          next
          blockingDrift
          variantCount
        }
      }
    }
  `,
  fdmCellDetail: gql`
    query FdmCellDetail(
      $spaceId: String!
      $parameterSet: String!
      $dataset: String!
      $compute: String!
      $timelinePoint: String!
      $label: String
      $stateDir: String
    ) {
      fdmCellDetail(
        input: {
          spaceId: $spaceId
          parameterSet: $parameterSet
          dataset: $dataset
          compute: $compute
          timelinePoint: $timelinePoint
          label: $label
          stateDir: $stateDir
        }
      ) {
        generatedAt
        selectedStateDir
        startedAt
        updatedAt
        finishedAt
        elapsedMs
        estimatedRemainingMs
        estimatedCompletedAt
        logPath
        latestLogLines
        stage {
          parameterSet
          profile
          dataset
          compute
          timelinePoint
          checkpoint
          label
          source
        }
      }
    }
  `,
  fdmRuntimeDiagnostics: gql`
    query FdmRuntimeDiagnostics($projectRelativePath: String!) {
      fdmRuntimeDiagnostics(input: { projectRelativePath: $projectRelativePath }) {
        generatedAt
        startup {
          ready
          phase
          startedAt
          finishedAt
          waitedMillis
          waitingForHolder
          apiStartupLock {
            active
            acquiredAt
            ageMillis
            fileName
            host
            owner
            pid
            role
            staleMetadata
          }
          simulatorLock {
            active
            acquiredAt
            ageMillis
            fileName
            host
            owner
            pid
            role
            staleMetadata
          }
        }
        recoveredStates {
          command
          compute
          connectionType
          launchLogFile
          launchPid
          launchPlanName
          liveStatus
          message
          phase
          recovered
          runtimeIdentity
          stateDir
          taskId
        }
      }
    }
  `,
  fdmCapabilities: gql`
    query FdmCapabilities {
      fdmCapabilities {
        capabilities {
          level
          name
          note
          operations
          supported
        }
        workflows {
          capabilities
          workflowId
          runId
          stateDir
          status
          sourceFile
          sourceRevision
        }
        runs {
          capabilities
          diagnostics {
            code
            message
            path
            severity
          }
          operations {
            attemptId
            disposition
            evidence
            operationId
            outcome
            status
            updatedAt
          }
          projectionConsistent
          runId
          stateDir
          status
          workflowId
        }
        jobs {
          capabilities
          diagnostics {
            code
            message
            path
            severity
          }
          executionKind
          jobId
          operationId
          runId
          status
          taskId
          workflowId
        }
        rulesets {
          capabilities
          operations
          reference
          roles
          rulesetId
          version
        }
        baselines {
          baselineId
          capabilities
          computeEngine
          dataset
          profile
          source
          timelinePoint
        }
        forks {
          capabilities
          forkId
          sourceRunId
          sourceWorkflowId
          status
          targetRunId
          targetWorkflowId
        }
        lineage {
          capabilities
          lineageId
          operationId
          runId
          sourceOperationId
          sourceRunId
          workflowId
        }
      }
    }
  `,
  fdmWorkflow: gql`
    query FdmWorkflow($spaceId: String, $workflowId: String, $runId: String, $stateDir: String) {
      fdmWorkflow(
        input: { spaceId: $spaceId, workflowId: $workflowId, runId: $runId, stateDir: $stateDir }
      ) {
        capabilities
        workflowId
        runId
        stateDir
        status
        sourceFile
        sourceRevision
      }
    }
  `,
  fdmWorkflows: gql`
    query FdmWorkflows($spaceId: String) {
      fdmWorkflows(input: { spaceId: $spaceId }) {
        capabilities
        workflowId
        runId
        stateDir
        status
        sourceFile
        sourceRevision
      }
    }
  `,
  fdmRun: gql`
    query FdmRun($spaceId: String, $workflowId: String, $runId: String, $stateDir: String) {
      fdmRun(input: { spaceId: $spaceId, workflowId: $workflowId, runId: $runId, stateDir: $stateDir }) {
        capabilities
        diagnostics {
          code
          message
          path
          severity
        }
        operations {
          attemptId
          disposition
          evidence
          operationId
          outcome
          status
          updatedAt
        }
        projectionConsistent
        runId
        stateDir
        status
        workflowId
      }
    }
  `,
  fdmRuns: gql`
    query FdmRuns($spaceId: String) {
      fdmRuns(input: { spaceId: $spaceId }) {
        capabilities
        diagnostics {
          code
          message
          path
          severity
        }
        operations {
          attemptId
          disposition
          evidence
          operationId
          outcome
          status
          updatedAt
        }
        projectionConsistent
        runId
        stateDir
        status
        workflowId
      }
    }
  `,
  fdmJob: gql`
    query FdmJob(
      $spaceId: String
      $workflowId: String
      $runId: String
      $jobId: String
      $taskId: String
      $operationId: String
      $executionKind: String
    ) {
      fdmJob(
        input: {
          spaceId: $spaceId
          workflowId: $workflowId
          runId: $runId
          jobId: $jobId
          taskId: $taskId
          operationId: $operationId
          executionKind: $executionKind
        }
      ) {
        capabilities
        diagnostics {
          code
          message
          path
          severity
        }
        executionKind
        jobId
        operationId
        runId
        status
        taskId
        workflowId
      }
    }
  `,
  fdmJobs: gql`
    query FdmJobs($spaceId: String) {
      fdmJobs(input: { spaceId: $spaceId }) {
        capabilities
        diagnostics {
          code
          message
          path
          severity
        }
        executionKind
        jobId
        operationId
        runId
        status
        taskId
        workflowId
      }
    }
  `,
  projectDirectoryTree: gql`
    query ProjectDirectoryTree($projectRelativePath: String!, $path: String, $depth: Int) {
      projectDirectoryTree(
        input: { projectRelativePath: $projectRelativePath, path: $path, depth: $depth }
      ) {
        projectRelativePath
        selectedPath
        maxDepth
        root {
          name
          relativePath
          kind
          directory
          exists
          sizeBytes
          updatedAt
          childCount
          children {
            name
            relativePath
            kind
            directory
            exists
            sizeBytes
            updatedAt
            childCount
            children {
              name
              relativePath
              kind
              directory
              exists
              sizeBytes
              updatedAt
              childCount
              children {
                name
                relativePath
                kind
                directory
                exists
                sizeBytes
                updatedAt
                childCount
              }
            }
          }
        }
      }
    }
  `,
  projectDirectoryInfo: gql`
    query ProjectDirectoryInfo($projectRelativePath: String!, $path: String, $depth: Int) {
      projectDirectoryInfo(
        input: { projectRelativePath: $projectRelativePath, path: $path, depth: $depth }
      ) {
        projectRelativePath
        requestedPath
        descendantCount
        node {
          name
          relativePath
          kind
          directory
          exists
          sizeBytes
          updatedAt
          childCount
          children {
            name
            relativePath
            kind
            directory
            exists
            sizeBytes
            updatedAt
            childCount
          }
        }
      }
    }
  `,
  projectYamlFileContent: gql`
    query ProjectYamlFileContent($projectRelativePath: String!, $relativePath: String!) {
      projectYamlFileContent(
        input: { projectRelativePath: $projectRelativePath, relativePath: $relativePath }
      ) {
        projectRelativePath
        relativePath
        content
        contentDigest
        updatedAt
        byteCount
      }
    }
  `,
  conditionalProjectYamlWrite: gql`
    mutation ConditionalProjectYamlWrite(
      $projectRelativePath: String!
      $relativePath: String!
      $expectedDigest: String!
      $content: String!
    ) {
      conditionalProjectYamlWrite(
        input: {
          projectRelativePath: $projectRelativePath
          relativePath: $relativePath
          expectedDigest: $expectedDigest
          content: $content
        }
      ) {
        status
        projectRelativePath
        relativePath
        contentDigest
        updatedAt
        byteCount
        resyncRequired
      }
    }
  `,
  beginProjectFileContentTransfer: gql`
    mutation BeginProjectFileContentTransfer(
      $projectRelativePath: String!
      $relativePath: String!
    ) {
      beginProjectFileContentTransfer(
        input: { projectRelativePath: $projectRelativePath, relativePath: $relativePath }
      ) {
        transferId
        contentDigest
        updatedAt
        byteCount
        chunkSizeBytes
        expiresAt
      }
    }
  `,
  projectFileContentPage: gql`
    query ProjectFileContentPage($transferId: String!, $cursor: String) {
      projectFileContentPage(input: { transferId: $transferId, cursor: $cursor }) {
        contentChunkBase64
        rawByteCount
        nextCursor
        hasNext
      }
    }
  `,
  closeProjectFileContentTransfer: gql`
    mutation CloseProjectFileContentTransfer($transferId: String!) {
      closeProjectFileContentTransfer(transferId: $transferId)
    }
  `,
  activeProjectTasks: gql`
    query ActiveProjectTasks($projectRelativePath: String!) {
      activeProjectTasks(projectRelativePath: $projectRelativePath) {
        taskId
        commandId: command
        status
        projectRelativePath
        progress
        phase
        registeredAt: registerAt
        startedAt: startAt
        updatedAt: updateAt
        runId
        jobId
        workflowId
        executionKind
      }
    }
  `,
  cancelTask: gql`
    mutation CancelTask($taskId: String!) {
      cancelTask(taskId: $taskId) {
        taskId
        accepted
      }
    }
  `,
  fdmVerify: gql`
    mutation FdmVerify(
      $spaceId: String!
      $planName: String
      $parameterSet: [String]
      $dataset: [String]
      $computeEngine: [String]
      $timeline: [String]
      $sources: [String]
      $stateDir: String
      $defaultCompute: String
      $targetComputes: [String]
      $baselineCompute: String
      $compareSelectors: String
      $tolerance: String
      $toleranceProfile: String
      $snapshotLevel: String
      $snapshotPolicy: String
      $compatibleSnapshotCommits: [String]
      $compatibleSnapshotRevisions: [String]
      $axisPriority: [String]
      $benchmarkAggregateMode: String
      $remoteInventoryFile: String
      $remoteLabel: String
      $sshProfile: String
      $originalSourceParameterSet: String
      $originalSourceProjectDir: String
      $preflight: Boolean
    ) {
      fdmVerify(
        input: {
          spaceId: $spaceId
          planName: $planName
          parameterSet: $parameterSet
          dataset: $dataset
          computeEngine: $computeEngine
          timeline: $timeline
          sources: $sources
          stateDir: $stateDir
          defaultCompute: $defaultCompute
          targetComputes: $targetComputes
          baselineCompute: $baselineCompute
          compareSelectors: $compareSelectors
          tolerance: $tolerance
          toleranceProfile: $toleranceProfile
          snapshotLevel: $snapshotLevel
          snapshotPolicy: $snapshotPolicy
          compatibleSnapshotCommits: $compatibleSnapshotCommits
          compatibleSnapshotRevisions: $compatibleSnapshotRevisions
          axisPriority: $axisPriority
          benchmarkAggregateMode: $benchmarkAggregateMode
          remoteInventoryFile: $remoteInventoryFile
          remoteLabel: $remoteLabel
          sshProfile: $sshProfile
          originalSourceParameterSet: $originalSourceParameterSet
          originalSourceProjectDir: $originalSourceProjectDir
          preflight: $preflight
        }
      ) {
        axisPriority
        baselineCompute
        benchmarkAggregateMode
        calibrationRuntimeOptions {
          key
          value
        }
        command
        compareSelectors
        compatibleSnapshotCommits
        compatibleSnapshotRevisions
        compute
        dataset
        dryRun
        executionKind
        logFile
        pathContext {
          allowedProjectRoots
          allowedProjectRootsSource
          fdmDirectory
          fdmDirectorySource
          fixtureDirectory
          fixtureDirectorySource
        }
        pid
        planFile
        planName
        profile
        remoteDataset
        remoteInventoryFile
        remoteLabel
        runId
        snapshotLevel
        snapshotPolicy
        snapshotReusePolicy
        sources
        sshCompute
        sshProfile
        stateDir
        stateSegment
        timeline
        tolerance
        toleranceProfile
        useSharedBaseline
        workflowId
      }
    }
  `,
  fdmSweep: gql`
    mutation FdmSweep(
      $spaceId: String!
      $planName: String
      $parameterSet: [String]
      $dataset: [String]
      $computeEngine: [String]
      $timeline: [String]
      $sources: [String]
      $stateDir: String
      $defaultCompute: String
      $targetComputes: [String]
      $baselineCompute: String
      $compareSelectors: String
      $tolerance: String
      $toleranceProfile: String
      $snapshotLevel: String
      $snapshotPolicy: String
      $compatibleSnapshotCommits: [String]
      $compatibleSnapshotRevisions: [String]
      $axisPriority: [String]
      $benchmarkAggregateMode: String
      $remoteInventoryFile: String
      $remoteLabel: String
      $sshProfile: String
      $originalSourceParameterSet: String
      $originalSourceProjectDir: String
      $preflight: Boolean
    ) {
      fdmSweep(
        input: {
          spaceId: $spaceId
          planName: $planName
          parameterSet: $parameterSet
          dataset: $dataset
          computeEngine: $computeEngine
          timeline: $timeline
          sources: $sources
          stateDir: $stateDir
          defaultCompute: $defaultCompute
          targetComputes: $targetComputes
          baselineCompute: $baselineCompute
          compareSelectors: $compareSelectors
          tolerance: $tolerance
          toleranceProfile: $toleranceProfile
          snapshotLevel: $snapshotLevel
          snapshotPolicy: $snapshotPolicy
          compatibleSnapshotCommits: $compatibleSnapshotCommits
          compatibleSnapshotRevisions: $compatibleSnapshotRevisions
          axisPriority: $axisPriority
          benchmarkAggregateMode: $benchmarkAggregateMode
          remoteInventoryFile: $remoteInventoryFile
          remoteLabel: $remoteLabel
          sshProfile: $sshProfile
          originalSourceParameterSet: $originalSourceParameterSet
          originalSourceProjectDir: $originalSourceProjectDir
          preflight: $preflight
        }
      ) {
        axisPriority
        baselineCompute
        benchmarkAggregateMode
        calibrationRuntimeOptions {
          key
          value
        }
        command
        compareSelectors
        compatibleSnapshotCommits
        compatibleSnapshotRevisions
        compute
        dataset
        dryRun
        executionKind
        logFile
        pathContext {
          allowedProjectRoots
          allowedProjectRootsSource
          fdmDirectory
          fdmDirectorySource
          fixtureDirectory
          fixtureDirectorySource
        }
        pid
        planFile
        planName
        profile
        remoteDataset
        remoteInventoryFile
        remoteLabel
        runId
        snapshotLevel
        snapshotPolicy
        snapshotReusePolicy
        sources
        sshCompute
        sshProfile
        stateDir
        stateSegment
        timeline
        tolerance
        toleranceProfile
        useSharedBaseline
        workflowId
      }
    }
  `,
  fdmRunCancel: gql`
    mutation FdmRunCancel($workflowId: String, $runId: String, $jobId: String, $taskId: String) {
      fdmRunCancel(
        input: { workflowId: $workflowId, runId: $runId, jobId: $jobId, taskId: $taskId }
      )
    }
  `,
  fdmJobCancel: gql`
    mutation FdmJobCancel($workflowId: String, $runId: String, $jobId: String, $taskId: String) {
      fdmJobCancel(
        input: { workflowId: $workflowId, runId: $runId, jobId: $jobId, taskId: $taskId }
      )
    }
  `,
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
        runId
        jobId
        workflowId
        executionKind
      }
    }
  `,
  subscribeTaskLog: gql`
    subscription SubscribeTaskLog($taskId: String!) {
      subscribeTaskLog(taskId: $taskId) {
        taskId
        sequence
        timestamp
        stream
        text
      }
    }
  `,
  subscribeFdmCellLog: gql`
    subscription SubscribeFdmCellLog(
      $spaceId: String!
      $parameterSet: String!
      $dataset: String!
      $compute: String!
      $timelinePoint: String!
      $label: String
      $stateDir: String
    ) {
      subscribeFdmCellLog(
        input: {
          spaceId: $spaceId
          parameterSet: $parameterSet
          dataset: $dataset
          compute: $compute
          timelinePoint: $timelinePoint
          label: $label
          stateDir: $stateDir
        }
      ) {
        generatedAt
        logPath
        latestLogLines
        stage {
          parameterSet
          profile
          dataset
          compute
          timelinePoint
          checkpoint
          label
          source
        }
      }
    }
  `,
  subscribeFdmRuntimeEvents: gql`
    subscription SubscribeFdmRuntimeEvents($projectRelativePath: String!, $stateDir: String) {
      subscribeFdmRuntimeEvents(
        input: { projectRelativePath: $projectRelativePath, stateDir: $stateDir }
      ) {
        backendType
        command
        compute
        connectionType
        message
        phase
        progress
        projectRelativePath
        receivedAt
        recovered
        taskId
        username
        backendMetadata {
          key
          value
        }
      }
    }
  `,
} as const;
