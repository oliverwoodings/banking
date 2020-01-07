const config = require('config')
const { getLisaBalance } = require('./skipton')
const { updateLisaBalance } = require('./moneyDashboard')
const log = require('./lib/log')
require('./lib/sentry')

module.exports = { syncLisaBalance }

async function syncLisaBalance (name) {
  if (!config[name]) {
    throw new Error(`'${name}' is not a valid name`)
  }
  log.info(`Syncing LISA balance for ${name} from Skipton to Money Dashboard`)
  const balance = await getLisaBalance(config[name])
  log.info('Got balance from Skipton:', balance)
  await updateLisaBalance(config[name], balance)
  log.info('Done!')
}
