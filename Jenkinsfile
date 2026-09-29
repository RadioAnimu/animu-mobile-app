pipeline {
  agent none

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  stages {
    stage('Checkout') {
      agent {
        docker {
          image 'alpine/git:latest'
          args '-u root --entrypoint=""'
        }
      }
      steps {
        sh '''
          set -eux
          git -c http.sslVerify=true clone --recurse-submodules --depth 1 \
            https://github.com/RadioAnimu/animu-mobile-app.git .
        '''
      }
    }

    stage('CI') {
      agent {
        docker {
          image 'node:22-bookworm'
          args '-u root -v /var/run/docker.sock:/var/run/docker.sock'
        }
      }
      environment {
        CI = 'true'
        EXPO_NO_TELEMETRY = '1'
      }
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
      agent {
        docker { image 'node:22-bookworm' }
      }
      environment { EXPO_NO_TELEMETRY = '1' }
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
      agent {
        docker { image 'node:22-bookworm' }
      }
      environment { EXPO_NO_TELEMETRY = '1' }
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
