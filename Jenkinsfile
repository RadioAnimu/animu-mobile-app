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
          echo "node $(node --version) / npm $(npm --version)"

          npm ci --prefix packages/animu-api
          npm run build --prefix packages/animu-api

          npm ci

          npx tsc --noEmit
          npx expo lint
          npm test
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
          npx expo export:embed --platform android --entry-file index.js \
            --bundle-output /tmp/index.android.bundle \
            --assets-dest /tmp/animu-assets --dev false
        '''
      }
    }

    stage('React Doctor score gate') {
      steps {
        sh '''
          set -eux
          score=$(npx react-doctor --score)
          echo "React Doctor score: $score"
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
