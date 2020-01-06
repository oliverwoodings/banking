const withPage = require('./lib/withPage')
const log = require('./lib/log')('skipton')

module.exports = {
  getLisaBalance: withPage(getLisaBalance)
}

async function getLisaBalance (page, userConfig) {
  log.info('Logging in...')
  await page.goto('https://secure.skipton.co.uk/portal/SignUp')
  await page.type('#loginId', userConfig.skipton.username)
  await page.type('#Password', userConfig.skipton.password)
  await page.click('button.btn.btn-primary.btn-lg')
  await page.waitForNavigation()

  log.info('Answering security question...')
  const question = await getText(page, 'label[for="SecurityAnswer"]')
  const answer = userConfig.skipton.answers[question.trim()]
  if (!answer) {
    boom(`Could not find answer for question: ${question}`)
  }
  await page.type('#SecurityAnswer', answer)
  await page.click('button.btn.btn-primary.btn-lg')
  await page.waitForNavigation()

  log.info('Scraping balance...')
  const balance = await getText(page, '.current-bal')
  return parseBalance(balance)
}

async function getText (page, sel) {
  await page.waitFor(sel, { visible: true })
  const element = await page.$(sel)
  if (!element) {
    throw new Error(`Cannot find element for selector '${sel}'`)
  }
  const text = await page.evaluate(element => element.textContent, element)
  return text.trim()
}

function boom (msg) {
  throw new Error('msg')
}

function parseBalance (str) {
  return Number(str.replace(/[£,]/g, ''))
}
