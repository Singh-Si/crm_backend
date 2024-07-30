const { acceptLead } = require("../leadSource/controller");
const { Leads } = require("../leadSource/model");
const { isAdmin } = require("../utils/checkAdmin");
const { fetchResponse, errorResponse } = require("../utils/response");
const { Analytic } = require("./model");

async function intelligenceView(req, res) {
  try {
    const fetchedData = await Analytic.findOne({
      user: req.user._id,
    });
    let responseObj = {
      rejectedLeads: fetchedData?.rejectedLeads || 0,
      receivedleads: fetchedData?.assignedLeads || 0,
      attended: fetchedData?.attended || 0,
    };
    let filter = {};
    if (!isAdmin(req)) {
      filter = {
        users: {
          $elemMatch: {
            id: req.user._id,
            leadStatus: 'ACCEPTED',
          },
        },
      };
    } else {
      filter = {
        company: req.user.company._id,
      };
    }

    const leads = await Leads.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: "$leadType",
          count: { $sum: 1 },
        },
      },
    ]);

    let hot = 0;
    let cold = 0;

    leads.forEach((lead) => {
      if (lead._id === 'hot-lead') {
        hot += lead.count;
      } else if (lead._id === 'cold-lead') {
        cold += lead.count;
      }
    });

    const total = hot + cold;

    responseObj = {
      ...responseObj,
      hot,
      cold,
      total,
    };

    // console.log("responseObj data:", responseObj);
    return fetchResponse(res, "Intelligence view data fetched!", responseObj);
  } catch (error) {
    console.log("Error in Intelligence view API:", error);
    return errorResponse(res, "Something went wrong!", "");
  }
}

module.exports = {
  intelligenceView,
};
