# verdaccio-plugin-delay-filter

> **⚠️ Warning:** this plugin works reliably only with Verdaccio starting from version 6.2.0. In some of the earlier versions it won't load or might provide inconsistent results across requests.

Plugin for filtering packages and their versions with security purposes. It allows you to make Verdaccio block:

- versions released less than N days ago
- specific versions or version ranges (with semver semantics)
- entire packages or even scopes
- versions released after specific date

Verdaccio configured with this filter allows you to shield yourself against supply chain attacks in popular packages. The most prominent recent attack (Shai-Hulud worm) demonstrated how vulnerable npmjs and public registries are in general. Packages are uploaded without being audited by cybersecurity specialists and any maintainer can be hacked or go rogue and upload malicious code which will be automatically downloaded to your machine upon executing npm install. You can manually restrict direct dependencies of your package to specific versions and think you're protected against such threats, but it's not true since indirect dependecies are most often configured as "download _this_ version or newer" (^1.2.3 format with "^") and there is no way to lock it for new packages which you have no package-lock.json for. It's way better to make npm/pnpm/yarn/npx/pnpx and etc see only want you want them to see with Verdaccio in conjunction with filtering plugin. Note that you have to configure these tools to fetch data from your proxy instead of npmjs registry, e.g. with `npm config set registry http://localhost:4873/` where http://localhost:4873/ is an address of your Verdaccio server.

Age-based filtering can protect you at a great degree against threats in popular packages. Community and security firms are quite active in detecting malicious code and usually it takes up to several days for infected versions to be unpublished.

## What this plugin do

It transforms package manifests to make your private registry proxy serve only package versions that satisfy predefined filtering rules.

### How it transforms package manifest

- Removes blocked versions from the `versions` map.
- Removes tags for blocked version from `dist-tags`.
- Sets `dist-tags.latest` to most recent stable version that survived filtering.
- Removes `time` entries corresponding to blocked versions.
- Fixed `created` and `modified` fields of `time`.
- Removes no longer relevant files from `_distfiles`.

---

## Usage

### Install the plugin

```shell
npm i -g verdaccio-plugin-delay-filter
```

### Configure options:

Edit `config.yaml` of Verdaccio to achieve desired filtering.

#### Filter package versions by age

```yaml
filters:
  plugin-delay-filter:
    minAgeDays: 30 # Block versions younger than 30 days
```

Note that this option is global for all packages and scopes.
If you want some scopes, packages or package version to survive this filtering,
seek for `allow` rules later in this document.

#### Block by scope or package

```yaml
filters:
  plugin-delay-filter:
    block:
      - scope: @evilscope # block all packages in this scope
      - package: semvver # block a malicious package trying to pretend 'semver'
      - package: @coolauthor/stolen # block a malicious package
```

#### Block package versions

```yaml
filters:
  plugin-delay-filter:
    block:
      - package: @coolauthor/stolen
        versions:
          '>2.0.1' # block some malicious versions of previously ok package
          # uses https://www.npmjs.com/package/semver syntax
```

#### Replace newer package versions with older version

```yaml
filters:
  plugin-delay-filter:
    block:
      - package: @coolauthor/stolen
        versions: '>2.0.1'
        strategy:
          replace # block some malicious versions of previously ok package,
          # replacing them with older, correct versions.
          # use this when package is used in transient dependencies and 'block' breaks the installs
```

#### dateThreshold

```yaml
filters:
  plugin-delay-filter:
    dateThreshold: '2022-03-10T23:00:00.000Z' # Allow only packages released up to this date
```

#### Whitelisting blocked packages

In some cases, you may need to bypass your own rules
and whitelist certain scopes, packages, or package versions
even though they fall within a blocked area.
For example, this might happen when you own some private registry or you really need
latest version of some package and you ensured that its code is safe.
You can configure whitelist rules with `allow` clause,
which follows the same rules as `block`.
Rules specified in `allow` take precedence over all blocking rules
(even `minAgeDays` and `dateThreshold`).

```yaml
filters:
  plugin-delay-filter:
    minAgeDays: 30 # Block versions younger than 30 days
    allow:
      - scope: @my-company-scope # Don't block the scope that belongs to you
      - package: @coolauthor/not-stolen # Don't block package you really trust
      - package: semver
        versions: '7.7.3' # Don't block specific package version that you know is not malicious
```

## Development

See the [verdaccio contributing guide](https://github.com/verdaccio/verdaccio/blob/master/CONTRIBUTING.md) for instructions setting up your development environment.
Once you have completed that, use the following npm tasks.

- `npm run build`

  Build a distributable archive

- `npm run test`

  Run unit test

For more information about any of these commands run `npm run ${task} -- --help`.
