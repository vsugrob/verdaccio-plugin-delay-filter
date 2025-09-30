# verdaccio-plugin-delay-filter

> **⚠️ Warning:** this plugin works reliably only with Verdaccio 6.2.0. In some of the earlier versions it won't load. In the 8.0.0-next-8.23 version of Verdaccio filtering is not consistent and it will not shield you against unwanted packages! Please use Verdaccio 6.2.0 if you want filtering to be applied correctly.

Plugin for filtering packages and their versions with security purposes. It allows you to make Verdaccio block:

- versions released less than N days ago
- specific versions or version ranges (with semver semantics)
- entire packages or even scopes
- versions released after specific date

Verdaccio configured with this filter allows you to shield yourself against supply chain attacks in popular packages. The most prominent recent attack (Shai-Hulud worm) demonstrated how vulnerable npmjs and public registries are in general. Packages are uploaded without being audited by cybersecurity specialists and any maintainer can be hacked or go rogue and upload malicious code which will be automatically downloaded to your machine upon executing npm install. You can manually restrict direct dependencies of your package to specific versions and think you're protected against such threats, but it's not true since indirect dependecies are most often configured as "download _this_ version or newer" (^1.2.3 format with "^") and there is no way to lock it for new packages which you have no package-lock.json for. It's way better to make npm/pnpm/yarn see only want you want them to see with Verdaccio in conjunction with filtering plugin.

Age-based filtering can protect you at a great degree against threats in popular packages. Community and security firms are quite active in detecting malicious code and usually it takes up to several days for infected versions to be unpublished.

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

#### Block by scope or package

```yaml
filters:
  plugin-delay-filter:
    block:
      - scope: @evil # block all packages in scope
      - package: semvver # block a malicious package
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

Add this if you want to exclude package versions that were published after march 10, 2022.

```yaml
filters:
  plugin-delay-filter:
    dateThreshold: '2022-03-10T23:00:00.000Z'
```

## Development

See the [verdaccio contributing guide](https://github.com/verdaccio/verdaccio/blob/master/CONTRIBUTING.md) for instructions setting up your development environment.
Once you have completed that, use the following npm tasks.

- `npm run build`

  Build a distributable archive

- `npm run test`

  Run unit test

For more information about any of these commands run `npm run ${task} -- --help`.
