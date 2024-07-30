const { uploadDocuments, getDocumentsByLeadId } = require("./controller")
const { checkToken } = require("../middleware")
const router = require("express").Router()
const setupFileUpload = require("../utils/fileUpload")
const upload = setupFileUpload()

router.post("/upload", checkToken, upload.array('files', '10'), uploadDocuments)
router.get("/get/:leadId", checkToken, getDocumentsByLeadId)
module.exports = router
