const puppeteer = require('puppeteer')
const config = require('config')
const pTimeout = require('p-timeout')

module.exports = function withPage (fn) {
  return async (...args) => {
    const browser = await puppeteer.launch(config.puppeteer.options)
    const page = await browser.newPage()
    try {
      const result = await pTimeout(fn(page, ...args), config.puppeteer.timeout)
      await browser.close()
      return result
    } catch (e) {
      if (config.puppeteer.closeOnError) {
        await browser.close()
      }
      throw e
    }
  }
}
