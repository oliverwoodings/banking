const config = require('config')
const withPage = require('./lib/withPage')
const log = require('./lib/log')('money-dashboard')

module.exports = {
  updateLisaBalance: withPage(updateLisaBalance)
}

async function updateLisaBalance (page, userConfig, balance) {
  const accountName = userConfig.moneyDashboard.lisaAccountName

  log.info('Logging in...')
  await page.goto('https://my.moneydashboard.com/?signin=true')
  await page.waitFor('.cookie-control-dialog')
  await page.click('.cookie-control-dialog button')
  await page.waitFor(300)
  await page.type('input[name="email"]', config.moneyDashboard.username)
  await page.waitFor(500)
  await page.type('input[name="password"]', config.moneyDashboard.password)
  await page.waitFor(500)
  await page.click('button[type="submit"]')
  await page.waitForNavigation()

  log.info('Opening balance update dialog...')
  await page.goto('https://my.moneydashboard.com/account')

  const xpath = `//div[contains(., '${accountName}')][contains(@class, 'accountContainer')]`
  await page.waitForXPath(xpath)
  const [accountContainer] = await page.$x(xpath)
  const refreshAccount = await accountContainer.$('button')
  await refreshAccount.click('button')

  log.info('Submitting new balance...')
  await page.waitFor('input[name="OpeningBalance"]')
  await page.type('input[name="OpeningBalance"]', String(balance))
  await page.waitFor(500)
  await page.click('.button[type="submit"]')
  await page.waitFor('.notificationInformation')
}
