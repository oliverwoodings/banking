const axios = require('axios')
const { CookieJar } = require('tough-cookie')
const axiosCookieJarSupport = require('axios-cookiejar-support').default
const fs = require('fs-extra')
const path = require('path')
const querystring = require('querystring')
const config = require('config').danni
const cheerio = require('cheerio')
const curlirize = require('axios-curlirize')

const TMP = path.resolve(__dirname, '../tmp')

axiosCookieJarSupport(axios)
curlirize(axios, (result) => {
  console.log(result.command)
})

dooby().catch(e => {
  if (e.response) {
    console.error(e.response)
  } else {
    console.error(e)
  }
})

async function dooby () {
  const jar = new CookieJar()

  const index = await axios.get('https://secure.skipton.co.uk/portal/SignUp', {
    jar,
    withCredentials: true
  })
  await dump('index.html', index.data)

  const loginPayload = querystring.stringify({
    __RequestVerificationToken: getVerificationToken('/portal/SignUp/Login', index.data),
    LoginId: config.skipton.username,
    Password: config.skipton.password,
    RememberMe: false
  })
  const login = await axios({
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': jar.getCookieStringSync('https://secure.skipton.co.uk/portal/SignUp/Login')
    },
    method: 'POST',
    url: 'https://secure.skipton.co.uk/portal/SignUp/Login',
    data: loginPayload,
    jar
  })
  await dump('login.json', login.data)

  const securityDetails = await axios.get('https://secure.skipton.co.uk/portal/Login/SecurityDetails', {
    jar,
    withCredentials: true
  })
  await dump('security.html', securityDetails.data)

  const question = getSecurityQuestion(securityDetails.data)
  const answer = config.skipton.answers[question]
  if (!answer) {
    throw new Error(`Could not find answer to security question: ${question}`)
  }
  const securityPayload = querystring.stringify({
    __RequestVerificationToken: getVerificationToken('/portal/Login/SecurityDetails', securityDetails.data),
    ForgottenPassword: false,
    SecurityPhrase: 'Purple flower', // Hippo
    SecurityQuestion: question,
    ForgottenSecurityQuestions: false,
    IsSecurityAnswerRequired: true,
    SecurityAnswer: answer
  })
  const submitSecurity = await axios({
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': jar.getCookieStringSync('https://secure.skipton.co.uk/portal/Login/SecurityDetails')
    },
    method: 'POST',
    url: 'https://secure.skipton.co.uk/portal/Login/SecurityDetails',
    data: securityPayload,
    jar
  })
  await dump('security.json', submitSecurity.data)
  if (wasAnswerIncorrect(submitSecurity.data.viewModel)) {
    throw new Error(`'${answer}' was not the correct answer for '${question}'`)
  }

  if (submitSecurity.data.stepName !== 'Finished') {
    throw new Error(`Expected auth flow to be finished but got step name '${submitSecurity.data.stepName}'`)
  }

  const finished = await axios({
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://secure.skipton.co.uk/portal/Login/SecurityDetails',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': 1,
      'Cookie': jar.getCookieStringSync('https://secure.skipton.co.uk/portal/Login/Finished')
    },
    method: 'POST',
    url: 'https://secure.skipton.co.uk/portal/Login/Finished',
    data: querystring.stringify({
      __RequestVerificationToken: getVerificationToken('/portal/Login/Finished', securityDetails.data),
      RedirectToUnlock: false,
      RedirectToSignUp: false,
      UserJourney: 'Unavailable',
      SignUpErrorMessage: '',
      SignUpConfirmationMessage: ''
    }),
    maxRedirects: 5,
    jar
  })
  await dump('finished.json', finished.data)

  const check = await axios({
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': jar.getCookieStringSync('https://secure.skipton.co.uk/portal/Session/Check')
    },
    method: 'POST',
    url: 'https://secure.skipton.co.uk/portal/Session/Check',
    jar
  })
  await dump('check.json', check.data)
  if (!check.success) {
    throw new Error('Auth was not succesful')
  }

  const home = await axios.get('https://secure.skipton.co.uk/portal/', {
    jar,
    withCredentials: true
  })
  await dump('home.html', home.data)

  const investments = await axios({
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': jar.getCookieStringSync('https://secure.skipton.co.uk/portal/Home/GetInvestmentAccounts')
    },
    method: 'POST',
    url: 'https://secure.skipton.co.uk/portal/Home/GetInvestmentAccounts',
    data: querystring.stringify({
      __RequestVerificationToken: getVerificationToken('/portal/Home/GetInvestmentAccounts', home.data),
    }),
    jar
  })
  await dump('investments.json', investments.data)
}

function wasAnswerIncorrect (data) {
  data = JSON.parse(data)
  return data.isSecurityAnswerIncorrect
}

async function dump (name, data) {
  if (typeof data !== 'string') {
    data = JSON.stringify(data, null, 2)
  }
  await fs.mkdirp(TMP)
  await fs.writeFile(path.join(TMP, name), data)
}

function getSecurityQuestion (html) {
  const $ = cheerio.load(html)
  const question = $('#SecurityQuestion').attr('value')
  return question
}

function getVerificationToken (action, html) {
  const $ = cheerio.load(html)
  const $form = $('form').filter((i, form) => {
    const action = $(form).attr('action') || ''
    return action.toLowerCase() === action.toLowerCase()
  })
  const token = $form.find('input[name="__RequestVerificationToken"]').attr('value')
  if (!token) {
    throw new Error(`No token found for ${action}`)
  }
  return token
}
