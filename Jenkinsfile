pipeline {
  agent {
    docker {
      image 'node:22-bookworm'
      args '-u root'
    }
  }

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '5', artifactNumToKeepStr: '5'))
  }

  environment {
    CI = 'true'
    EXPO_NO_TELEMETRY = '1'
    COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
  }

  stages {
    stage('Checkout submodules') {
      steps {
        sh '''
          set -eux
          git config --global --add safe.directory "$WORKSPACE"
          git submodule update --init --recursive
        '''
      }
    }

    stage('CI') {
      steps {
        sh '''
          set -eux
          corepack enable
          echo "node $(node --version) / pnpm $(pnpm --version)"

          pnpm install --frozen-lockfile

          pnpm exec tsc --noEmit
          pnpm exec expo lint
          pnpm test
        '''
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: '**/junit*.xml'
        }
      }
    }

    stage('Bundle smoke test') {
      steps {
        sh '''
          set -eux
          pnpm exec expo export:embed --platform android --entry-file index.js \
            --bundle-output /tmp/index.android.bundle \
            --assets-dest /tmp/animu-assets --dev false
        '''
      }
    }

    stage('React Doctor score gate') {
      steps {
        sh '''
          set -eux
          raw=$(pnpm exec react-doctor --score 2>/dev/null || true)
          score=$(printf '%s\\n' "$raw" | grep -oE '^[0-9]+$' | tail -1)
          echo "React Doctor score: ${score:-<none>}"
          case "$score" in
            ''|*[!0-9]*) echo "Could not parse a React Doctor score"; exit 1 ;;
          esac
          if [ "$score" -lt 85 ]; then
            echo "React Doctor score $score is below the required minimum of 85"
            exit 1
          fi
        '''
      }
    }
  }

  post {
    success { echo 'Pipeline succeeded.' }
    failure { echo 'Pipeline failed.' }
  }
}
