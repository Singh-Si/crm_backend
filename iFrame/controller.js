const { IFrames } = require("./model")
const {
  errorResponse,
  createResponse,
  fetchResponse,
  duplicateResponse,
  unauthorizedResponse,
} = require("../utils/response")
const { isAdmin } = require("../utils/checkAdmin")

const addIFrame = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return unauthorizedResponse(res, "Access denied!", null)
    }
    const { adName, adId } = req.body
    const isFrameExist = await IFrames.findOne({ adName, adId })
    if (isFrameExist) {
      return duplicateResponse(res, "This I_Frame already Exist!", null)
    }
    const isIFrameExist = await IFrames.create({
      adName,
      adId,
      company: req.user.company._id,
    })
    return createResponse(res, "Ads data fetched successfully!", isIFrameExist)
  } catch (error) {
    console.log("Error while creating Iframes: ", error)
    return errorResponse(res, "Something went wrong!", null)
  }
}

const getIFrames = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return unauthorizedResponse(res, "Access denied!", null)
    }
    const Iframes = await IFrames.find({ company: req.user.company._id },  { adName: 1, adId: 1, company: 1, _id:0 })
    return fetchResponse(res, "IFrames fetched!", Iframes)
  } catch (error) {
    console.log("Error while getting IFrames : ", error)
    return errorResponse(res, "Something went wrong!", null)
  }
}

module.exports = {
  addIFrame,
  getIFrames,
}
