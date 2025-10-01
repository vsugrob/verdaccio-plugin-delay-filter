- ✅ Check whether `setupLatestTag()` needs to find latest version in non-next versions.
  UPD: yes, current logic is not entirely right.
  Tag 'latest' must be set to a version that has no other tags associated with it.
- 🔴 Fix `setupLatestTag()` logic:
  - ✅ Modify `dist-tags/latest` only if it was removed by `cleanupTags()` earlier.
  - ✅ Make it set `dist-tags/latest` to a version that has no tags associated with it.
  - 🔴 Add unit tests.
- 🔴 Investigate whether `_attachments` and `_distfiles` needs to be cleaned.
  See whether there are other parts of `package.json` are in need of cleaning.
- ✅ Add `minAgeDays` configuration option.
  - ✅ Implement filtering based on age.
  - ✅ Add unit test for this option.
  - ✅ Describe in README.md why this option is helpful in the light of the latest supply chain attack (Shai Hulud).
- ✅ Rewrite all tests to test `VerdaccioMiddlewarePlugin` instead of `filterBlockedVersions()`.
  - ✅ Remove export for filterBlockedVersions().
- ✅ Fix `dist-tags/latest` still contains version that was filtered out.
- ✅ Make `dist-tags/latest` set to latest version after filtering.
- ✅ Fix `time` property still contains entries for versions that were cut.
- ✅ Fix side effects of not cloning package under some conditions.
- ✅ Fix `minAgeDays` sets `dateThreshold` internally.
  Server can be run for days/months and `dateThreshold` will stay fixed
  while user expects age to be calculated based on the current date.
  - ✅ Compare version age with minAgeDays in each `filter_metadata()` call.
  - ✅ Add unit test checking that earliest effective date threshold is applied.
- ✅ Fix `created` and `modified` are removed from `time`.
  - ✅ Recalculate `created` and `modified` and write to `time`.
  - ✅ Update tests accordingly. Add `created` and `modified` to initial data.
- ✅ Fix `filterBlockedVersions()` should not update readme when no actual changes to package were made.
- ✅ Test that block by version does not modify readme when nothing was changed.
- ✅ Test that replace by version does not modify readme when nothing was changed.
- ✅ Fix replace by version strategy is not specified in type of config input.
- ✅ Test that replace by version setting works.
- ✅ Test that `dateThreshold` setting works.
- ✅ Update README.md:
  - ✅ Split config into several task-based sections.
  - ✅ Describe main intent of this package - filtering versions by age to prevent 0-day attacks.
  - ✅ Describe configuration of `minAgeDays` parameter.
  - ✅ Describe installation more thoroughly. It's not enough to just run `npm i -g verdaccio-plugin-delay-filter`. UPD: it seems to be enough now in Verdaccio 6.2.0.
  - ✅ Mention where to configure "filters:" (config.yaml verdaccio).
  - ✅ Remove deprecation from `dateThreshold` parameter. It's not that useless actually.
- ✅ Do not compile index.test.ts into lib/index.test.js. It should not end up in distrubution files.
- 🔴 Fix vulnerabilities revealed by npm audit: 39 vulnerabilities (7 low, 18 moderate, 14 high).
