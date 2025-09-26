- Add 'minAgeDays' configuration option.
  - ✅ Implement filtering base on age.
  - ✅ Add unit test for this option.
  - Describe in README.md why this option is helpful in the light of the latest supply chain attack (Shai Hulud).
- Rewrite all tests to test VerdaccioMiddlewarePlugin instead of filterBlockedVersions().
  - Remove export for filterBlockedVersions().
- Fix dist-tags/latest still contains version that was filtered out.
- Fix time still contains entries for versions that were cut.
- Fix vulnerabilities revealed by npm audit:
  39 vulnerabilities (7 low, 18 moderate, 14 high).
