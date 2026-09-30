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
    EXPO_NO_TELEMETRY = '1'
    COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
  }

  stages {
    stage('CI') {
      agent {
        docker {
          image 'node:22-bookworm'
          args '-u root'
        }
      }
      steps {
        sh '''
          set -eux
          git config --global --add safe.directory "$WORKSPACE"
          git submodule update --init --recursive
          corepack enable
          echo "node $(node --version) / pnpm $(pnpm --version)"

          pnpm install --frozen-lockfile

          pnpm run typecheck
          # Expo-managed packages must match the installed SDK (deliberate
          # exceptions live in expo.install.exclude).
          pnpm run check:expo-deps
          # Known-vulnerability gate on the resolved dependency tree.
          pnpm run check:audit
          pnpm exec expo lint
          pnpm test
          # The API client is a git submodule compiled into the app.
          pnpm run check:animu-api

          # Bundles the app so broken asset paths and unresolvable imports fail
          # CI (TypeScript cannot catch these).
          pnpm exec expo export:embed --platform android --entry-file index.js \
            --bundle-output /tmp/index.android.bundle \
            --assets-dest /tmp/animu-assets --dev false

          # React Doctor health-score gate (minimum 85).
          pnpm run doctor:gate
        '''
      }
      post {
        always {
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
