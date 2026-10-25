# `oa monit`

`oa monit <folder>` watches a required local folder for changes to mapped JSON resources and periodically compares them with the remote service. It can pull remote-only changes or push local-only changes after schema validation. When both sides changed since the last successful synchronization, it records a conflict and leaves both versions untouched.

```sh
oa monit data/system/applications
```

The folder argument is compulsory. The command remains active until Ctrl+C. It scans recursively for JSON files, excluding `.oa`, `.logs`, `.cache`, and `scripts` folders. The remote mapping must be present in the file metadata or discoverable from the folder convention (`data/<service>/<collection>/...` and that folder's `.oa/meta/.../index.json`). Per-file `id` or `code` identifies the remote record.

## What it does

| Situation | Monitor behavior |
| --- | --- |
| Local and remote match the saved baseline | No action. |
| Only remote changed | Pull the complete remote JSON file to local on a pull cycle. |
| Only local changed | Validate the complete JSON document, queue a full-file push task, and push it on a push cycle. |
| Both changed differently | Record an unresolved conflict in the file metadata; do not pull or push. |
| Baseline is missing | Pull the full remote file to local and save that remote version as the new baseline. If the local file changes during the fetch, defer the overwrite and record a conflict instead. |
| A newly created local file has no remote record | Add it to the pending list. Never push it automatically. |
| Local JSON is invalid or fails schema validation | Do not queue/push it; write a blocked/error event to the daily log. |
| Remote is unavailable | Keep the local file untouched, log the failure, and retry on a later cycle. |

All pushes publish the entire JSON resource. There is no partial remote write. Schema validation runs before queuing a push and again for an explicitly approved new file. A missing endpoint schema blocks a push; create `.oa/schemas/<service>.<collection>.schema.json`.

The queue is stored in `.cache/monit/pending.json`. New files are listed there and in the Monitor page in the web UI. Review the suggested service, collection, query, and local file metadata before approving one:

```sh
oa monit data/system/applications --approve data/system/applications/test.json
```

Approval creates the complete remote resource and records its mapping and pushed baseline. You can approve a file individually or use the web **Flush queue** action to approve all awaiting new-file tasks and process queued full-file pushes after one confirmation. The queue page shows task totals by status.

## Configuration

Pull and push polling have independent settings under `monit`. Both default to five minutes; configure them in minutes (minimum one minute):

```sh
oa config monit.pullIntervalMinutes 5
oa config monit.pushIntervalMinutes 5
```

Changes take effect when `oa monit` starts. The first scan runs immediately. The monitor has one sequential scan loop, so slow remote requests can make a cycle finish later than its configured interval; it does not overlap runs.

## Conflicts and the web view

For each mapped file, the conflict record is stored beside its remote mapping in `.oa/meta`, with status, reason, detection time, signature, and hashes of the base/local/remote contents. The file contents themselves remain in their normal locations. The latest base snapshot is not replaced by a conflict. The monitor prints a link to `#section=data&path=...&monit=conflicts`; the web server must already be running (default port 3000). The page lists unresolved conflicts and pending new files, including suggested mapping metadata. Open a conflict row to return to that file's normal comparison view. The activity toolbar's **Monitor Logs** button opens a searchable log viewer with date, file, operation, error-type, and free-text filters; it reads flat daily logs and older nested log files.

Successful pulls update the saved base snapshot only after the local write succeeds. Successful pushes update it after the remote service confirms the full-file update. Each daily JSON-lines log is a single file directly under `.logs`; path separators are encoded as `__` between components. For example, `data/system/applications/console.json` is logged to `.logs/data__system__applications__console.json.<YYYY-MM-DD>.log`. Events include pulls, pushes, conflicts, validation blocks, and remote failures. A schema-validation block includes the schema code, the applied `.oa/schemas/...` file path when one was resolved, and the validation errors. The filename rolls over using the machine's local date; each event timestamp is recorded in UTC. Older logs remain in their previous locations.

## Concurrency and safety

`oa monit` does not lock local files. Before a pull it checks that local content has not changed since the comparison read. Before a push it validates again, rereads local content, and fetches the remote resource again to check it still matches the baseline. If a local edit or remote update is detected, it defers the operation or records a conflict. The remote service does not expose a conditional-write/version precondition through the current CLI transport, so an update arriving in the narrow interval between the final remote check and the remote write cannot be ruled out. Keep the daily logs and use the normal file comparison view to review such cases.

The monitor owns only the process running `oa monit`; Ctrl+C stops future cycles after the current file operation. It does not run as a background service or install a filesystem watcher. It polls local disk and remote resources, so remote change detection is bounded by the pull interval and network latency.

## Architecture (maintainers)

- `lib/constants/actions.js` registers the command; `lib/handlers/monit.js` requires a folder, initializes settings, polls, manages approvals, and coordinates safe reads/writes.
- `lib/helpers/file.js` resolves workspace paths, enumerates JSON files, and writes the per-file metadata records. The monitor uses `.cache/monit/pending.json` for schedule state and explicit new-file approvals. Existing queues at `.oa/meta/.monit/pending.json` are moved to the new location on first access.
- `lib/helpers/request.js` is the existing transport boundary for remote reads and complete create/update calls. The monitor uses `origin` metadata and the existing remote mapping convention.
- `lib/helpers/schema-validation.js` performs non-interactive schema lookup and Draft 2020-12 validation. Unlike interactive `oa validate`, it never prompts to invent a mapping while a monitor is running; missing schema configuration fails closed.
- `web/apis/monit.js` exposes unresolved conflict metadata and pending tasks to the local web client. `web/app.js` renders the list for `monit=conflicts`; selecting a conflict opens the regular file viewer.
- `.logs` records append-only JSON-lines events. Per-file metadata stores the synchronization baseline and conflict provenance, so a restart can continue comparison without an in-memory baseline.

Each cycle compares canonicalized JSON values (object whitespace and key-order formatting do not by themselves create changes) while retaining two-space JSON serialization for snapshots and pulls. When no baseline exists, the remote representation becomes the initial authority: the complete local file is replaced by remote content and then saved as the baseline. The monitor first checks that local bytes have not changed during the fetch. The baseline thereafter is the last successfully synchronized representation. Local writes use an optimistic reread check, not an operating-system lock. Queue persistence uses a temporary file followed by rename to avoid exposing truncated queue JSON after interruption.

## Limits

V1 handles JSON files with a resolvable remote mapping. It does not provide three-way merge UI, partial remote writes, binary resources, deletion propagation, folder deletion, arbitrary file formats, background-service installation, remote compare-and-swap, or cross-process locking. A changed local file is always sent as a whole resource after validation. Newly discovered files require explicit approval, individually or through the confirmed web queue flush.
