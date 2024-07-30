const url = require("url")

function urlParser(urlString) {
  const parsedUrl = new URL(urlString)
  // Accessing the query parameters
  const queryParams = parsedUrl.searchParams
  // Iterate through the query parameters
  let urlObject = {}
  queryParams.forEach((value, key) => {
    urlObject[key] = value
  })
  return urlObject
}

module.exports = {
  urlParser,
}
