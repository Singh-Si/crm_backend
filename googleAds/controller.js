const { Leads } = require("../leadSource/model")
const { isAdmin } = require("../utils/checkAdmin")
const moment = require("moment")
const {
  errorResponse,
  createResponse,
  fetchResponse,
} = require("../utils/response")
const { urlParser } = require("../utils/urlParser")

const getAdsData = async (req, res) => {
  try {
    let leadsData
    let query = {
      company: req.user.company._id,
      // advertiseName: { $exists: true, $ne: "N/A" },
      leadSource: "advertisement",
      isTrashed: false,
    }
    if (isAdmin(req)) {
      console.log("Admin block");
      leadsData = await Leads.find(query)
        .populate("leadCreatedBy", "firstName lastName")
        .populate("company")
        .populate("users.id", "firstName lastName")
        .sort({ createdDate: 1 })
        .lean()
    } else {
      query["$or"] = [
        { leadCreatedBy: req.user._id },
        {
          users: {
            $elemMatch: {
              id: req.user._id,
              $or: [
                { currentUser: true },
                { leadStatus: "ACCEPTED" },
                { leadStatus: "PENDING", currentUser: true },
                { leadStatus: "REJECTED" },
              ],
            },
          },
        },
      ]
      leadsData = await Leads.find(query)
        .populate("leadCreatedBy", { firstName: 1, lastName: 1, _id: 0 })
        .populate("users.id", "firstName lastName")
        .populate("company")
        .sort({ createdDate: 1 })
        .lean()
    }
    // Sort the leadsData based on the 'createdDate' field in descending order
    leadsData.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
    // Add the userAssociated field to the leadsData
    const updatedLeadsData = leadsData.map((lead) => ({
      ...lead,
      userAssociated: lead.users.find((user) => user.currentUser)?.id
        ? `${lead.users.find((user) => user.currentUser).id.firstName} ${
            lead.users.find((user) => user.currentUser).id.lastName
          }`
        : null,
    }))
    return fetchResponse(
      res,
      "Ads data fetched successfully!",
      updatedLeadsData
    )
  } catch (error) {
    console.log("Error while fetching google ads data : ", error)
    return errorResponse(res, "Something went wrong!", null)
  }
}
const saveAdsData = async (req, res) => {
  try {
    let leadDataObj = { ...req.body }
    leadDataObj["leadSource"] = "advertisement"
    leadDataObj["createdDate"] = moment().format("DD-MM-YYYY")
    leadDataObj["createdTime"] = moment().format("hh:mm A")

    if (req.body.url) {
      const urlObject = urlParser(req.body.url)
      leadDataObj["utm_source"] = urlObject["utm_source"]
      leadDataObj["utm_medium"] = urlObject["utm_medium"]
      leadDataObj["utm_campaign"] = urlObject["utm_campaign"]
      leadDataObj["utm_content"] = urlObject["utm_content"]
    }

    const savedGoogleAd = await Leads.create(leadDataObj)
    // console.log(savedGoogleAd);
    return createResponse(res, "Ads data saved succefully!", savedGoogleAd)
  } catch (error) {
    console.log("Error while saving google ads data : ", error)
    return errorResponse(res, "Something went wrong!", null)
  }
}

module.exports = {
  getAdsData,
  saveAdsData,
}
