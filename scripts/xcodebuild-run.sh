#!/usr/bin/env bash
# Runs xcodebuild with the given arguments. On failure, reports the error lines (and the end of
# the log) as a GitHub annotation, so they can be read without downloading the full log.
set -uo pipefail
log="${RUNNER_TEMP:-/tmp}/xcodebuild-$$.log"
xcodebuild "$@" > "$log" 2>&1
status=$?
tail -n 150 "$log"
if [ $status -ne 0 ]; then
  report=$( { grep -E "error:|fatal error|❌|\*\* (BUILD|ARCHIVE|EXPORT) FAILED|Error Domain|requires a provisioning|No profiles|No signing" "$log" | sort -u | head -n 60; echo '--- last lines ---'; tail -n 25 "$log"; } )
  report="${report//'%'/'%25'}"
  report="${report//$'\r'/}"
  report="${report//$'\n'/'%0A'}"
  echo "::error title=xcodebuild failed::$report"
fi
exit $status
