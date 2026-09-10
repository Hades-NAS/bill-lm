# Ready-to-move implementation spec: Bill-LM CI acceleration

## Destination and scope

Move this file unchanged to
`../bill-lm/docs/superpowers/specs/2026-09-10-dual-runner-cache-retention-implementation.md`
once its Harness MCP is available. Then modify only the listed workflow,
retention files and deployment documentation.

The target workflow is `../bill-lm/.github/workflows/deploy-build-push.yml`.
It publishes two Hades repositories:

| Dockerfile | Published repository | Cache tag |
| --- | --- | --- |
| `docker/Dockerfile` | `bill-lm-server` | `bill-lm-server:buildcache` |
| `docker/Dockerfile.worker` | `bill-lm-worker` | `bill-lm-worker:buildcache` |

Keep the existing Bun 1.3.5 quality runtime, Firebase mount used by health,
build args, deploy validation, release tags, concurrency behavior and optional
Discord notifications unchanged. This work does not migrate the application
from Bun nor revise secret delivery.

## Preconditions

1. Restore the Bill-LM Harness MCP and create/claim the task according to its
   repository instructions.
2. Confirm `Hades-Tests-Runner` has Node 24, Bun 1.3.5 and access to the
   Firebase fixture at `/home/cardor/secrets/bill-lm/bill-lm-firebase.json`.
   `health.sh` explicitly requires that file even with `SKIP_E2E=true`.
3. Do not move quality until a manual runner proof passes:

```bash
PLAYWRIGHT_PORT=3100 \
GOOGLE_APPLICATION_CREDENTIALS=/home/cardor/secrets/bill-lm/bill-lm-firebase.json \
SKIP_E2E=true \
bash health.sh
```

This confirms the test runner can execute typecheck, build, Vitest and the
intentionally skipped Playwright path without relying on the deploy daemon.

## Reference files

Use the same safety mechanics already implemented in `medialog-server`:

- `../medialog-server/.github/workflows/deploy-build-push.yml`
- `../medialog-server/.github/workflows/registry-retention.yml`
- `../medialog-server/scripts/registry-retention.sh`
- `../medialog-server/docs/superpowers/specs/2026-09-10-registry-retention-design.md`

Adapt only repository/image names and this project’s existing concurrency key.
Do not copy Node/pnpm commands: Bill-LM’s `bun.lock`, `health.sh` and existing
workflow establish Bun as the package manager/runtime for quality.

## Exact workflow transformation

### 1. Runner allocation

Set `quality` to:

```yaml
runs-on:
  group: Tests
  labels: tests
```

Leave its current checkout, Node 24, Bun 1.3.5, frozen install and health
environment exactly intact. `quality` already runs independently of build.

Set `build`, `validate-health`, `push-to-registry`,
`notify-deployment-failure` and `notify-deployment-success` to:

```yaml
runs-on:
  group: Default
  labels: self-hosted
```

The two notification jobs do not require Docker, but pinning them avoids the
new generic `self-hosted` selector accidentally scheduling them on an
incompatible runner. Do not change their notification logic.

Keep dependencies exactly as versioned:

```yaml
validate-health:
  needs: build
push-to-registry:
  needs: [quality, validate-health, build]
```

Thus quality and build start together, while registry push still waits for all
gates.

### 2. Registry cache for both images

Configure the existing Buildx action:

```yaml
- name: BuildX setup
  uses: docker/setup-buildx-action@v4
  with:
    driver-opts: network=host
```

For the server step insert, before the existing `docker buildx build`:

```bash
CACHE_IMAGE="127.0.0.1:5000/bill-lm-server:buildcache"
cache_from=()
if docker manifest inspect "$CACHE_IMAGE" >/dev/null 2>&1; then
  cache_from=(--cache-from "type=registry,ref=$CACHE_IMAGE")
fi
```

Then add to the existing build command, without removing any current build arg:

```bash
"${cache_from[@]}" \
--cache-to "type=registry,ref=$CACHE_IMAGE,mode=max" \
```

Repeat with `bill-lm-worker:buildcache` in the worker step. Each Dockerfile
gets an isolated cache reference. Keep `IMAGE="localhost:5000/..."` and
`docker push` unchanged: those run from the host Docker daemon. The IPv4 cache
ref plus `network=host` is specific to BuildKit, which otherwise treats
`localhost` as its container-local loopback.

### 3. Registry retention

Create the manual workflow and script patterned on medialog-server. The script
must hard-code/allowlist exactly `bill-lm-server` and `bill-lm-worker`; no free
form repository or registry URL input. For each repository:

| Tag family | Retain |
| --- | ---: |
| `X.Y.Z` | 3 production tags |
| `X.Y.Z-dev` | 3 development tags (currently none on main, but preserve policy) |
| `buildcache` | exact protected tag |
| Unknown/malformed | retain and report |

The workflow has only `workflow_dispatch`, defaults to preview, requires
`mode=apply` plus exact `confirm=DELETE`, and shares:

```yaml
concurrency:
  group: bill-lm-deploy
  cancel-in-progress: false
```

It must show tags/digests/creation time/manifest size/decision in the job
summary before deletion. A digest shared with a protected tag remains
protected. Never call `DELETE` in normal deploy and never invoke registry GC;
NAS owns the maintenance window and GC.

Rename both existing `Cleanup old images` steps to make clear they run only
`docker rmi` against the local runner daemon. They do not delete published
registry tags and must not be presented as retention.

## Verification and acceptance

1. Static: `bash -n scripts/registry-retention.sh`, Prettier checks, YAML
   validation and `git diff --check`.
2. Local: normal `bash health.sh` remains green.
3. Runner proof: quality uses `Tests`; Docker jobs stay `Default`; the mounted
   Firebase fixture and Bun health command work on Tests.
4. Cache proof: run two comparable builds and confirm second-run cache import
   for server and worker separately.
5. Retention: run preview only, approve its full table, then optionally apply;
   verify protected tags resolve after apply. Record NAS garbage collection
   separately—tag removal alone is not storage reclamation.
