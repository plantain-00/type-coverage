module.exports = {
  include: [
    'bin/*',
    'dist/*.js',
    'package.json',
    'yarn.lock'
  ],
  exclude: [
  ],
  postScript: [
    'cd "[dir]" && yarn --production',
    'node [dir]/dist/index.js -p src --detail --at-least 90 --supressError'
  ]
}
