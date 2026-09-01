# Update Runbook

This document covers how to refresh the dataset when upstream data changes and how to roll back to a previous snapshot.

## Prerequisites

```sh
export PATH="$HOME/.local/bin:$PATH"
```

## Updating to a new upstream commit

### 1. Update the local clone

```sh
cd /home/forge/mlperf
git fetch origin
git checkout <new-commit-sha>
git rev-parse HEAD   # verify the commit you are on
```

Replace `<new-commit-sha>` with the specific commit you want to pin. Do not use `git pull` without knowing the target commit: the pipeline must be pinned to an exact commit, not a moving branch tip.

### 2. Update the pinned commit in source-registry.ts

Open `src/pipeline/source-registry.ts` and update `PINNED_COMMIT`:

```typescript
export const PINNED_COMMIT = '<new-commit-sha>';
```

### 3. Run the full pipeline

```sh
bun run pipeline:full
```

This will fail with a hash mismatch error because the committed expected hash no longer matches the new output. That is expected — the hash guard is working correctly.

Example output when the new data differs from the committed hash:

```
Records:     <N> released, <M> quarantined
Mismatches:  <K> scenario mismatches
recordsHash: <new-hash>
ERROR: recordsHash mismatch!
  expected: <old-hash>
  got:      <new-hash>
```

### 4. Review the change

Before re-pinning the expected hash, examine what changed:

- Did the record counts change? Compare the new `released` and `quarantined` counts against the previous values.
- Are new quarantine reasons appearing? Inspect `pipeline-output/full-snapshot.json`, section `quarantine`, for new entries.
- Are there new accelerator names that need alias entries? Check `pipeline-output/full-snapshot.json` for new entries in `coverageMatrix`.
- Does the new data contain the same known traps documented in `DATA_SOURCES.md`?

This review step is a human decision. The pipeline cannot make it for you.

### 5. Re-pin the expected hash

Once the new data has been reviewed and accepted, overwrite the expected hash file:

```sh
cat pipeline-output/full-hash.txt > pipeline-output/full-expected-hash.txt
```

Or if you prefer to inspect the value first:

```sh
cat pipeline-output/full-hash.txt
# review the printed hash, then:
cp pipeline-output/full-hash.txt pipeline-output/full-expected-hash.txt
```

### 6. Run verification

```sh
bun run pipeline:verify
```

Expected output:

```
Verifying fixture mode...
PASS fixture: <fixture-hash>
Verifying full-source mode...
PASS full-source: <new-full-hash>
All hashes verified. OK.
```

Both modes must pass. If the fixture mode fails, a fixture file was inadvertently modified — restore it from git before continuing.

### 7. Run tests and build

```sh
bun test
bun run type-check
bun run build
```

All three must succeed before committing.

### 8. Commit

Commit the updated files:

```sh
git add src/pipeline/source-registry.ts
git add pipeline-output/full-snapshot.json
git add pipeline-output/full-hash.txt
git add pipeline-output/full-expected-hash.txt
git commit -m "Update to MLPerf v6.0 commit <new-commit-sha>"
```

## What a hash mismatch means

A hash mismatch from `pipeline:verify` means one of:

- The upstream data at the pinned commit changed (impossible if the commit is immutable, but possible if the local clone was modified).
- The pinned commit in `source-registry.ts` was changed without updating the expected hash.
- Pipeline code changed in a way that alters parsed output.
- A fixture file was modified (for fixture mode mismatches).

The decision a reviewer must make: is the new hash correct? Inspect the diff in `pipeline-output/full-snapshot.json` before overwriting the expected hash. The hash guard exists to make silent data mutations impossible, not to block intentional updates.

## Rollback procedure

To return to a previous snapshot without running the pipeline again:

### 1. Check out the previous committed state

```sh
git log --oneline pipeline-output/full-expected-hash.txt
# identify the commit you want to return to, e.g. <prev-commit>
git checkout <prev-commit> -- \
  src/pipeline/source-registry.ts \
  pipeline-output/full-snapshot.json \
  pipeline-output/full-hash.txt \
  pipeline-output/full-expected-hash.txt
```

### 2. Verify the restored state

```sh
bun run pipeline:verify
```

This re-runs the pipeline against the local clone at the commit recorded in `source-registry.ts`. For the verify to pass, the local clone must be at that commit:

```sh
cd /home/forge/mlperf
git checkout <previous-pinned-commit>
cd /home/forge/ceo/workspace/auftraege/tsk-wan8h9g1/app
bun run pipeline:verify
```

### 3. Rebuild and test

```sh
bun test
bun run build
```

### 4. Commit the rollback

```sh
git add src/pipeline/source-registry.ts
git add pipeline-output/full-snapshot.json
git add pipeline-output/full-hash.txt
git add pipeline-output/full-expected-hash.txt
git commit -m "Rollback to MLPerf v6.0 commit <previous-pinned-commit>"
```
