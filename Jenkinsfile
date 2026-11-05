pipeline {
  // `agent none` so the shared lock is acquired BEFORE an executor is
  // allocated. With a top-level agent the lock is taken after the executor is
  // assigned, so waiting builds would hold executors. A single stage then runs
  // the whole build in one container (per-stage agents would each be a fresh
  // container, losing node_modules/corepack state between stages).
  agent none

  // A parameter (even a free-text one) makes Jenkins expose this job via
  // "Build with Parameters" so it gets a parameterized play button like the
  // release job. It has no effect on the build.
  parameters {
    string(name: 'NOTE', defaultValue: '', description: 'Optional note for this run (unused).')
  }

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '5', artifactNumToKeepStr: '5'))
    // Share the lock with the release job: both are memory-heavy and run on the
    // same physical host, so they must not overlap.
    lock('animu-build-host')
  }

  environment {
    CI = 'true'
    JENKINS_USER = 'rmotafreitas'
    EXPO_NO_TELEMETRY = '1'
    COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
  }

  stages {
    stage('CI') {
      agent {
        docker {
          image 'node:22-bookworm'
          args '-u root -v animu-node-cache:/opt/animu-cache -e CI_CACHE_DIR=/opt/animu-cache'
        }
      }
      steps {
        withCredentials([string(credentialsId: 'jenkins-api-token', variable: 'JENKINS_API_TOKEN')]) {
          sh '''
          set -eux
          git config --global --add safe.directory "$WORKSPACE"
          git config --global --add safe.directory "$WORKSPACE/packages/animu-api"
          git config --global --add safe.directory "$WORKSPACE/packages/react-native-anything-player"
          bash scripts/init-submodules.sh
          . scripts/ci-cache.sh
          corepack enable
          echo "node $(node --version) / pnpm $(pnpm --version)"

          # Immutable installs reconcile dependencies while preserving reusable files.
          pnpm install --frozen-lockfile

          # Every check (scripts/verify.mjs, what `pnpm verify` runs locally):
          # tooling tests, typecheck, Expo deps and doctor, secrets, audit,
          # ESLint, oxlint, knip + sherif, tests with coverage, both libraries,
          # the Android bundle and its size budget, the web export and React
          # Doctor. Independent steps run side by side, and every step runs
          # even after one fails, so one build shows all that is broken.
          pnpm verify

          node scripts/ci-results.mjs publish RadioAnimu/animu-mobile-app
          '''
        }
        archiveArtifacts artifacts: 'ci-results.json', fingerprint: true
      }
      post {
        always {
          // Git checkout runs as Jenkins outside the root build container.
          // Restore ownership of metadata/source trees updated by submodule fetch.
          sh '''
            owner=$(stat -c '%u:%g' "$WORKSPACE")
            chown -R "$owner" .git packages/animu-api packages/react-native-anything-player
          '''
          junit allowEmptyResults: true, testResults: '**/junit*.xml'
        }
      }
    }
  }

  post {
    success { echo 'Pipeline succeeded.' }
    failure { echo 'Pipeline failed.' }
  }
}
