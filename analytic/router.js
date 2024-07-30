const Router = require("express").Router()
const { checkToken } = require("../middleware")
const {intelligenceView} = require("./controller")
Router.get("/intelligence", checkToken, intelligenceView)
module.exports = Router
