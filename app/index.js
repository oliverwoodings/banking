const { CronJob } = require('cron')
const config = require('config')
const operations = require('./operations')
const log = require('./lib/log')
const sentry = require('./lib/sentry')
const pLimit = require('p-limit')

const limit = pLimit(1)

for (const schedule of config.schedules) {
  log.info('Scheduling job:', schedule)
  new CronJob(
    schedule.spec,
    () => {
      limit(executeOperation, schedule)
    },
    null,
    true,
    null,
    null,
    config.runOnStart
  )
}

async function executeOperation ({ operation, args }) {
  try {
    const fn = operations[operation]
    if (!fn) {
      throw new Error(`Cannot find operation '${operation}'`)
    }
    if (fn.length !== args.length) {
      throw new Error(
        `Operation ${operation} expects ${fn.length} arguments but only got ${args.length}`
      )
    }
    await fn(...args)
  } catch (e) {
    log.error(
      `Error while executing operation '${operation}' with args: ${args.join(
        ', '
      )}`,
      e
    )
    sentry.captureException(e)
  }
}
