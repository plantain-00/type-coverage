module.exports = {
  include: [
    'bin/*',
    'dist/*',
    'LICENSE',
    'package.json',
    'README.md'
  ],
  exclude: [
  ],
  askVersion: true,
  changesGitStaged: true,
  postScript: [
    ({ dir, tag }) => tag
      ? `npm publish "${dir}" --access public --tag ${tag}`
      : `npm publish "${dir}" --access public`,
    'git add package.json',
    ({ version }) => `git commit -m "${version}"`,
    ({ version }) => `git tag v${version}`,
    'git push',
    ({ version }) => `git push origin v${version}`
  ]
}
