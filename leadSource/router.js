const { checkToken } = require("../middleware")
const { exchangeToken } = require("../utils/exchangeFbToken")
const {
  acceptLead,
  getAllLeadsOfUser,
  generateLead,
  reasonForRejectionStatus,
  rejectLead,
  updateLeadInfo,
  getManualLeads,
  getLeadByLeadId,
  deleteLeads,
  assignMultipleLeads,
  importLeads,
  filter,
  fetchLeadsByPageNameFromFB,
  getFbPagesFromDB,
  loadFbPagesFromFB,
  getLeadsByPageNameFromDB,
  fetchFbPagesFromFB,
  savePageDetailsInCompany,
} = require("./controller")
const setupFileUpload = require("../utils/fileUpload")
const upload = setupFileUpload()
const leadRouter = require("express").Router()
leadRouter.post("/update/status", checkToken, reasonForRejectionStatus)
leadRouter.post("/add", checkToken, generateLead)
leadRouter.get("/get", checkToken, getManualLeads)
leadRouter.post("/accept", checkToken, acceptLead)
leadRouter.post("/reject", checkToken, rejectLead)
leadRouter.put("/update/info/:leadId", checkToken, updateLeadInfo)
leadRouter.get("/get/leadbyid/:leadId", checkToken, getLeadByLeadId)
leadRouter.get("/load/fb/page", checkToken, fetchFbPagesFromFB)
leadRouter.get("/fetch/fb/page", checkToken, getFbPagesFromDB)
leadRouter.post("/save/lead/bypage", checkToken, fetchLeadsByPageNameFromFB)
leadRouter.post("/fetch/lead/bypage", checkToken, getLeadsByPageNameFromDB)
// leadRouter.post("/fetch/campaign/leads", checkToken, fetchLeadsForCampaign)
// leadRouter.post("/trash/:leadId", checkToken, trashLeads)
leadRouter.get("/exchange/fbtoken", checkToken, exchangeToken)
leadRouter.post("/leads/delete", checkToken, deleteLeads)
leadRouter.post("/leads/assign/multiple", checkToken, assignMultipleLeads)
leadRouter.post("/import", upload.single("file"), checkToken, importLeads)
leadRouter.post("/filter",  checkToken, filter)
leadRouter.get("/get/byuser",  checkToken, getAllLeadsOfUser)
leadRouter.post("/save/pages",  checkToken, savePageDetailsInCompany)

module.exports = leadRouter
