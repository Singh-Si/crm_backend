const { addIFrame, getIFrames } = require("./controller")
const { checkToken } = require("../middleware")
const router = require("express").Router()


router.post("/add", checkToken, addIFrame)
router.get("/get", checkToken, getIFrames)
module.exports = router
