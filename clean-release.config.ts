export default {
  include: [
    'packages/*/dist/*',
    'packages/*/es/*',
    'packages/*/bin/*',
    'packages/*/package.json',
    'packages/*/README.md',
  ],
  exclude: [
  ],
  askVersion: true,
  changesGitStaged: true,
  postScript: ({ dir, tag, version, effectedWorkspacePaths }) => [
    ...effectedWorkspacePaths.map((w) => w.map((e) => {
      return tag
        ? `npm publish "${dir}/${e}" --access public --tag ${tag}`
        : `npm publish "${dir}/${e}" --access public`
    })),
    `git-commits-to-changelog --release ${version}`,
    'git add CHANGELOG.md',
    `git commit -m "${version}"`,
    `git tag -a v${version} -m 'v${version}'`,
    'git push',
    `git push origin v${version}`
  ]
}
