const ora = require('ora')

const spinner = ora({
  spinner: 'dots2',
  color: 'cyan',
  stream: process.stderr,
})

module.exports = { spinner }