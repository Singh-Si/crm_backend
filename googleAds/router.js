const { getAdsData, saveAdsData } = require("./controller")
const router = require("express").Router()
const { checkToken } = require("../middleware")
router.post("/save", saveAdsData)
router.get("/get", checkToken, getAdsData)
module.exports = router
