const { validationResult } = require("express-validator")
const { errorResponse } = require("./response")
function isInputValidated(req, res) {
    // console.log("123");
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg)
    return errorResponse(res, "Inputs are incorrect!", errorMessages)
  }
  return true
}
module.exports = {
  isInputValidated,
}
