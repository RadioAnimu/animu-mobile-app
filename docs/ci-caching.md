# CI caching and artifact reuse

The pipelines keep the same quality gates. Download caches accelerate installs;
portable results avoid repeating deterministic work already completed by trusted
CI for an exact library revision. Dependency audits and full-history secret scans
still run on every app CI build, as do the app's integration tests and bundle check.

## Cache ownership and invalidation

| Layer | Storage | Invalidation / validation |
| --- | --- | --- |
| Jenkins Node downloads | Docker volume `animu-node-cache` | Pnpm/Yarn integrity checks; immutable installs still run |
| Host Node downloads | `~/.cache/animu-ci/{pnpm,yarn,npm,corepack}` | Shared by Sonar/release; installed dependencies stay workspace-local |
| Gitleaks downloads | `$XDG_CACHE_HOME/animu-gitleaks-*` | Pinned version/platform and SHA-256 checked before every execution |
| Sonar plugins, JRE and JS runtime | `~/.cache/animu-ci/sonar` mounted into scanner | Scanner manages compatibility; analysis and quality-gate wait always execute |
| Native release | Existing Android SDK, workspace `.gradle-home`, ccache and `android/` | Gradle task inputs; compiler-content checks; prebuild key includes patches, assets, plugins, manifests, lockfile and Node runtime |
| RNAP GitHub native builds | Gradle `setup-gradle`, Turbo, CocoaPods/Ruby downloads | Gradle owns task caching; Turbo includes root native sources, runner image and Xcode; per-commit archive keys allow caches to evolve |
| RNAP installed dependencies | GitHub cache | OS, architecture, Node, Yarn config/version, lockfile and manifests; always reconciled by immutable install |

Do not delete all dependencies or SDK/Gradle caches on each build. SDK/NDK versions
on the Jenkins native agent are already persistent. Do not upload the entire SDK
or share writable Gradle dependency directories between independent machines.
Keep the shared Jenkins build-host lock: this host also runs Sonar and an emulator,
and parallel native builds have previously exhausted memory.

## Portable results

Each CI pipeline publishes `ci-results.json` only after its quality command has
succeeded. GitHub uploads it as `ci-results`; Jenkins archives it beside the legacy
library package artifact. The JSON contains repository, full commit, producer Node
version, normalized relative LCOV paths, and SHA-256-checked compiled files.

Consumers require a clean checkout and accept only a completed SUCCESS Jenkins
build from the configured project job, or a completed successful `ci.yml` push run
on the upstream repository's `main`. PR/fork artifacts are never reused. GitHub
requires a read-capable token to download artifacts; without one, the consumer
uses Jenkins or local work. No token is forwarded to signed artifact storage URLs.
Download/extraction size and time are bounded; paths, required entry points,
coverage identity and file checksums are validated before writing anything.

App installation/release can reuse either provider's compiled library files.
App CI can reuse the successful standalone library gate but still performs that
library's dependency audit against current advisories. Sonar starts after its CI
job succeeds and can reuse coverage for the checked-out commit. It still installs
analysis dependencies and executes the scanner/quality gate. Missing, expired,
corrupt or mismatched results cause local build/test execution. Set
`CI_REUSE_RESULTS=0` to force fresh portable-result consumers.

Keep Jenkins result files for the retained successful build history; GitHub result
artifacts expire after 30 days. These are optional accelerators, not required
inputs. Download stores can be pruned during maintenance while holding the shared
build lock; removing them should produce a slower successful build, not a bypass.

The shared `ci-cache.sh`, `ci-results*.mjs` and result regression tests are copied
into each standalone repository so its pipeline does not depend on app checkout.
Update their copies together when changing the artifact format or trust policy.

## Measurement

Before this change, app Jenkins CI #62 took 200 seconds (the preceding #61 also
waited for Sonar), API CI #24 took 37 seconds, and RNAP CI #5 took 102 seconds.
Sonar took 112 seconds for the app, 43 for the API and 115 for RNAP. These are
wall-clock observations, not performance guarantees. Compare same-revision warm
runs and separate lock/queue time from execution. Release Gradle profiles and
ccache statistics expose native-cache effectiveness without enabling a potentially
incompatible configuration cache or skipping signing/native validation.

## References reviewed

- [Jenkins pipeline best practices](https://www.jenkins.io/doc/book/pipeline/pipeline-best-practices/): avoid moving large caches through controller stash operations.
- [Pnpm CI guidance](https://pnpm.io/continuous-integration): persist the package store, retain frozen installs, measure cache transfer overhead.
- [SonarScanner Docker caching](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/sonarscanner): persist scanner downloads outside disposable containers.
- [Gradle setup action](https://github.com/gradle/actions/blob/v4/docs/setup-gradle.md): Gradle-managed cache selection, cleanup and main-branch writes.
- [Gradle forum: parallel CI cache use](https://discuss.gradle.org/t/using-gradle-build-cache-in-parallel-ci-cd-pipeline-runs/44614): shared writable dependency caches have locking constraints.
- [Turbo task inputs](https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/reference/configuration.mdx) and [community discussion](https://github.com/vercel/turborepo/discussions/8877): explicitly hash native sources outside the example workspace.
- [CocoaPods command reference](https://guides.cocoapods.org/terminal/commands.html): install pinned pods; update specs when needed.
