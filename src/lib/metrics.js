// Health math for Qualflare launches — ported from
// app-ui/src/components/public/metrics.ts. This file is listed BEFORE content.js
// in the content_scripts entry, so it runs first in the same isolated world and
// exposes its helpers on globalThis.QF for content.js to use.
globalThis.QF = (function () {
  const n = (x) => (typeof x === 'number' && isFinite(x) ? x : 0);

  // failed + error + timeout + aborted (mirrors metrics.ts failingCount()).
  function failingCount(l) {
    return n(l.failedCount) + n(l.errorCount) + n(l.timeoutCount) + n(l.abortedCount);
  }

  function total(l) {
    return n(l.totalCount) || n(l.passedCount) + failingCount(l) + n(l.skippedCount);
  }

  // Pass rate over non-skipped tests.
  function passRate(l) {
    const t = total(l) - n(l.skippedCount);
    return t > 0 ? n(l.passedCount) / t : 0;
  }

  // Roll several launches (same branch, different frameworks/platforms) into one
  // summary — a PR's commit typically produces multiple launches.
  function aggregate(launches) {
    const keys = [
      'totalCount', 'passedCount', 'failedCount', 'errorCount',
      'skippedCount', 'timeoutCount', 'abortedCount', 'flakyCount', 'retryCount',
    ];
    const sum = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const l of launches) for (const k of keys) sum[k] += n(l[k]);
    sum.launchCount = launches.length;
    return sum;
  }

  // Worst-wins overall status for the aggregate.
  function overallStatus(agg) {
    if (failingCount(agg) > 0) return 'failed';
    if (n(agg.passedCount) > 0) return 'passed';
    if (n(agg.skippedCount) > 0) return 'skipped';
    return 'pending';
  }

  return { n, failingCount, total, passRate, aggregate, overallStatus };
})();
