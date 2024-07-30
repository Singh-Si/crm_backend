const { Users } = require("../Auth/model")
const { Analytic } = require("../analytic/model")
const { Leads } = require("../leadSource/model")
const { isAdmin } = require("../utils/checkAdmin")
const { fetchResponse, errorResponse } = require("../utils/response")
const moment = require("moment")
const usersLeadData = async (req, res) => {
  try {
    const permissions = ["read", "create", "delete", "update"] // Define the required permissions
    const hasPermissions = permissions.every((requiredPermission) =>
      req.user.role.permission.some(
        (userPermission) => userPermission.value === requiredPermission
      )
    )
    // Define an array of lead types you want to include in the response
    const leadTypesToInclude = [
      "warm-lead",
      "hot-lead",
      "cold-lead",
      "closed-lead",
    ]
    const userId = req.user._id // Assuming you have the req.user._id available
    const company = req.user.company._id
    let matchObj = {
      company,
      leadType: { $in: leadTypesToInclude },
    }
    if (!hasPermissions) {
      matchObj["users"] = { $elemMatch: { id: userId, currentUser: true } }
    }
    // Create an aggregation pipeline based on the lead types to include
    const pipeline = [
      {
        $match: matchObj,
      },
      {
        $group: {
          _id: "$leadType",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          leadType: "$_id",
          count: 1,
        },
      },
    ]
    const result = await Leads.aggregate(pipeline)
    // Create an object with zero counts for missing lead types
    const response = leadTypesToInclude.reduce((acc, leadType) => {
      const foundLead = result.find((item) => item.leadType === leadType)
      acc.push({
        leadType,
        count: foundLead ? foundLead.count : 0,
      })
      return acc
    }, [])

    return res.status(200).json({
      code: "SUCCESS",
      data: response,
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const todaysLead = async (req, res) => {
  try {
    const permissions = ["read", "create", "delete", "update"] // Define the required permissions
    const hasPermissions = permissions.every((requiredPermission) =>
      req.user.role.permission.some(
        (userPermission) => userPermission.value === requiredPermission
      )
    )
    matchQuery = {}
    matchQuery["company"] = req.user.company._id
    matchQuery["isTrashed"] = false
    if (hasPermissions) {
      matchQuery["createdDate"] = moment().format("DD-MM-YYYY")
    } else {
      matchQuery["users"] = {
        $elemMatch: {
          id: req.user._id,
          currentUser: true,
          assignedDate: moment().format("DD-MM-YYYY"),
        },
      }
    }

    const result = await Leads.find(matchQuery).populate("company")
    // console.log(result);
    return res.status(200).json({
      code: "SUCCESS",
      data: result,
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const penVsAccVsRej = async (req, res) => {
  try {
    const userId = req.user._id // Assuming you have the req.user._id available
    const { startDate, endDate, today } = req.query // Assuming you get date parameters as query parameters
    const matchQuery = {
      "users.id": userId,
    }
    // Add date range filtering if startDate and endDate parameters are provided
    if (startDate && endDate) {
      matchQuery.formattedCreatedAt = {
        $gte: startDate,
        $lte: endDate,
      }
    }

    // Add filtering for today's date if the 'today' parameter is provided
    if (true) {
      const todayDate = new Date().toISOString().split("T")[0]
      matchQuery.formattedCreatedAt = todayDate
    }

    const result = await Leads.aggregate([
      {
        $unwind: "$users",
      },
      {
        $match: {
          "users.id": userId,
        },
      },
      {
        $addFields: {
          formattedCreatedAt: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
        },
      },
      {
        $match: matchQuery,
      },
      {
        $group: {
          _id: "$users.leadStatus",
          count: { $sum: 1 },
        },
      },
    ])

    // Initialize leadCounts with default values
    const leadCounts = {
      pending: 0,
      rejected: 0,
      accepted: 0,
    }

    // Populate leadCounts based on the aggregation result
    result.forEach((entry) => {
      if (entry._id === "PENDING") {
        leadCounts.pending = entry.count
      } else if (entry._id === "REJECTED") {
        leadCounts.rejected = entry.count
      } else if (entry._id === "ACCEPTED") {
        leadCounts.accepted = entry.count
      }
    })

    return res.status(200).json({
      code: "SUCCESS",
      data: leadCounts,
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const leadSourceData = async (req, res) => {
  try {
    const permissions = ["read", "create", "delete", "update"] // Define the required permissions
    const hasAllPermissions = permissions.every((requiredPermission) =>
      req.user.role.permission.some(
        (userPermission) => userPermission.value === requiredPermission
      )
    )
    const company = req.user.company._id
    // Define an array of lead sources you want to include in the response
    const leadSourcesToInclude = [
      "facebook",
      "employee-ref",
      "web-referal",
      "google",
      "linkdin", // Added "google-ads" to the array
      "just-dial",
      "other",
    ]

    // Create a match query to filter based on the specified lead sources
    const matchQuery = {
      company,
      leadSource: { $in: leadSourcesToInclude },
    }
    if (!hasAllPermissions) {
      matchQuery["users.id"] = req.user._id
      matchQuery["users.currentUser"] = true
    }
    const data = await Leads.aggregate([
      {
        $match: matchQuery,
      },
      {
        $group: {
          _id: "$leadSource",
          count: { $sum: 1 },
        },
      },
    ])

    // Create an object with zero counts for missing lead sources
    const response = leadSourcesToInclude.map((leadSource) => ({
      leadSource,
      count: 0, // Default to zero count
    }))

    // Update counts for lead sources that exist in the aggregation result
    data.forEach((item) => {
      const index = response.findIndex((entry) => entry.leadSource === item._id)
      if (index !== -1) {
        response[index].count = item.count
      }
    })

    return fetchResponse(res, "Lead source count fetched!", response)
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const tickerAPIReminderCall = async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Set the time to the start of the day (midnight)
    let matchQuery = {
      company: req.user.company._id,
    }

    const permissions = ["read", "create", "delete", "update"]

    // Check if the user has all required permissions
    const hasAllPermissions = permissions.every((requiredPermission) =>
      req.user.role.permission.some(
        (userPermission) => userPermission.value === requiredPermission
      )
    )

    if (!hasAllPermissions) {
      matchQuery.users = {
        $elemMatch: {
          id: req.user._id,
          currentUser: true,
          leadStatus: "ACCEPTED",
        },
      }
    }

    // Use Mongoose's aggregate method to perform the aggregation
    const reminders = await Leads.aggregate([
      {
        $match: matchQuery,
      },
      {
        $match: {
          reminderCall: today,
        },
      },
    ]).exec()

    // Map the reminders and format the messages
    const reminderMessages = reminders.map((reminder) => {
      const { firstName, lastName } = reminder
      const reminderCallTime = reminder.reminderCall.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
      return `You have a call with ${firstName} ${lastName} at ${reminderCallTime}`
    })

    return res.status(200).json({
      code: "SUCCESS",
      data: reminderMessages,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const getFacebookLeads = async (req, res) => {
  try {
    // console.log(req.user);
    const permissionLength = req.user.role.permission.length
    let leadsData

    if (permissionLength == 5 || permissionLength == 4) {
      leadsData = await Leads.find({ leadSource: "facebook" })
        .populate("leadCreatedBy", "firstName lastName")
        .populate("users.id", "firstName lastName")
        .sort({ createdAt: -1 })
        .lean()
    } else {
      // Your existing code for permission check
      const userId = req.user._id
      const currentDate = new Date()
      leadsData = await Leads.find({
        leadSource: "facebook",
        $or: [
          {
            leadCreatedBy: req.user._id,
          },
          {
            users: {
              $elemMatch: {
                id: req.user._id,
                currentUser: true,
              },
            },
          },
          {
            users: {
              $elemMatch: {
                id: req.user._id,
                leadStatus: "ACCEPTED",
              },
            },
          },
          {
            users: {
              $elemMatch: {
                id: req.user._id,
                leadStatus: "REJECTED",
                reasonForRejection: null,
              },
            },
          },
        ],
      })
        .populate("leadCreatedBy", { firstName: 1, lastName: 1, _id: 0 })
        .populate("users.id", "firstName lastName")
        .sort({ createdAt: -1 })
        .lean()
    }
    // Add the userAssociated field to the leadsData
    const updatedLeadsData = leadsData.map((lead) => ({
      ...lead,
      userAssociated: lead.users.find((user) => user.currentUser)?.id
        ? `${lead.users.find((user) => user.currentUser).id.firstName} ${
            lead.users.find((user) => user.currentUser).id.lastName
          }`
        : null,
    }))
    return res.status(200).json({
      code: "SUCCESS",
      data: updatedLeadsData,
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const cardsData = async (req, res) => {
  try {
    let query = {
      company: req.user.company._id,
      isTrashed: false,
    }
    if (req.query.filter) {
      // console.log(req.query.filter)
      const filter = req.query.filter
      let startDate = moment().startOf("day")
      let endDate = moment().endOf("day")
      // console.log(startDate, endDate)
      switch (filter) {
        case "today":
          break // Use default dates for today's filter
        case "week":
          startDate = moment().startOf("isoWeek")
          endDate = moment().endOf("isoWeek")
          break
        case "month":
          startDate = moment().startOf("month")
          endDate = moment().endOf("month")
          break
        default:
          throw new Error("Invalid filter provided")
      }
      let compareQuery = {
        $gte: startDate.format("DD-MM-YYYY"),
        $lte: endDate.format("DD-MM-YYYY"),
      }
      if (isAdmin(req)) {
        // console.log("Admin block")
        query["createdDate"] = compareQuery
      } else {
        // console.log("User block")
        query["users.assignedDate"] = compareQuery
        query["users.id"] = req.user._id
      }
    } else {
      // If filter not provided, fetch all associated data
      if (!isAdmin(req)) {
        query["users.id"] = req.user._id
      }
    }

    const leadsData = await Leads.find(query)
    const unassignedLeads = leadsData.filter((lead) => lead.users.length === 0)
    let assignedLeads
    if (isAdmin(req)) {
      assignedLeads = leadsData.filter((lead) => lead.users.length > 0)
    } else {
      assignedLeads = leadsData.filter((lead) => {
        const userAssigned = lead.users.find(
          (user) => user.id.toString() === req.user._id.toString()
        )
        if (userAssigned) {
          if (
            userAssigned.leadStatus === "REJECTED" &&
            !userAssigned.currentUser
          ) {
            return false
          }
          return true
        }
        return false
      })
    }
    const lostLeads = leadsData.filter((lead) => lead.leadType === "lost-lead")
    const warmLeads = leadsData.filter((lead) => lead.leadType === "warm-lead")
    const hotLeads = leadsData.filter((lead) => lead.leadType === "hot-lead")
    const coldLeads = leadsData.filter((lead) => lead.leadType === "cold-lead")

    const clients = leadsData.filter((lead) => lead.isCompleted === true)
    return res.send({
      unassignedLeads,
      assignedLeads,
      lostLeads,
      clients,
      warmLeads,
      hotLeads,
      coldLeads,
      totalLeads: leadsData,
    })
  } catch (error) {
    console.log(error)
    return errorResponse(res, "Something went wrong!", null)
  }
}
// const cardsData = async (req, res) => {
//   try {
//     let matchQuery = {
//       company: req.user.company._id,
//     };

//     if (req.query.filter) {
//       const filter = req.query.filter;
//       let startDate = moment().startOf("day");
//       let endDate = moment().endOf("day");

//       switch (filter) {
//         case "today":
//           break; // Use default dates for today's filter
//         case "week":
//           startDate = moment().startOf("isoWeek");
//           endDate = moment().endOf("isoWeek");
//           break;
//         case "month":
//           startDate = moment().startOf("month");
//           endDate = moment().endOf("month");
//           break;
//         default:
//           throw new Error("Invalid filter provided");
//       }

//       if (isAdmin(req)) {
//         matchQuery.createdDate = {
//           $gte: startDate.toDate(),
//           $lte: endDate.toDate(),
//         };
//       } else {
//         matchQuery["users.assignedDate"] = {
//           $gte: startDate.toDate(),
//           $lte: endDate.toDate(),
//         };
//         matchQuery["users.id"] = req.user._id;
//       }
//     } else if (!isAdmin(req)) {
//       matchQuery["users.id"] = req.user._id;
//     }

//     const leadsData = await Leads.aggregate([
//       { $match: matchQuery },
//       {
//         $facet: {
//           unassignedLeads: [
//             { $match: { "users": { $size: 0 } } },
//             { $count: "count" },
//           ],
//           assignedLeads: [
//             { $match: { "users": { $not: { $size: 0 } } } },
//             { $count: "count" },
//           ],
//           lostLeads: [
//             { $match: { "leadType": "lost-lead" } },
//             { $count: "count" },
//           ],
//           warmLeads: [
//             { $match: { "leadType": "warm-lead" } },
//             { $count: "count" },
//           ],
//           hotLeads: [
//             { $match: { "leadType": "hot-lead" } },
//             { $count: "count" },
//           ],
//           coldLeads: [
//             { $match: { "leadType": "cold-lead" } },
//             { $count: "count" },
//           ],
//           clients: [
//             { $match: { "isCompleted": true } },
//             { $count: "count" },
//           ],
//           totalLeads: [
//             { $count: "count" },
//           ],
//         },
//       },
//     ]);

//     // Formatting the output for counts
//     const formattedData = {};
//     Object.keys(leadsData[0]).forEach((key) => {
//       formattedData[key] = leadsData[0][key][0]?.count || 0;
//     });

//     return res.send(formattedData);
//   } catch (error) {
//     console.log(error);
//     return errorResponse(res, "Something went wrong!", null);
//   }
// };

const getAllUnassignedLeads = async (req, res) => {
  try {
    // console.log(req.user);
    const permissionLength = req.user.role.permission.length
    let leadsData

    if (permissionLength !== 4) {
      return errorResponse(res, "Not authorized!", "")
    }
    // Add the userAssociated field to the leadsData
    leadsData = leadsData = await Leads.find({
      "users.0": { $exists: false },
      company: req.user.company._id,
    })
    let responseObj = {}
    responseObj["lead_data"] = leadsData
    responseObj["number_of_leads"] = leadsData.length
    return fetchResponse(res, "Un-assigned Leads Fetched!", responseObj)
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const getAllAssignedLeads = async (req, res) => {
  try {
    // console.log(req.user);
    const permissionLength = req.user.role.permission.length
    let leadsData
    let matchQuery = {}
    matchQuery["company"] = req.user.company._id
    if (permissionLength === 4) {
      // When permissionLength is 4, use $exists
      matchQuery["users.0"] = { $exists: true }
    } else {
      // When permissionLength is not 4, use $elemMatch
      matchQuery["users"] = {
        $elemMatch: {
          id: req.user._id,
          leadStatus: "ACCEPTED",
        },
      }
    }
    // Add the userAssociated field to the leadsData
    leadsData = leadsData = await Leads.find(matchQuery)
      .populate("leadCreatedBy", { firstName: 1, lastName: 1, _id: 0 })
      .populate("users.id", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean()
    // console.log(leadsData);
    // Add the userAssociated field to the leadsData
    const updatedLeadsData = leadsData.map((lead) => ({
      ...lead,
      userAssociated: lead.users.find((user) => user.currentUser)?.id
        ? `${lead.users.find((user) => user.currentUser).id.firstName} ${
            lead.users.find((user) => user.currentUser).id.lastName
          }`
        : null,
    }))
    let responseObj = {}
    responseObj["lead_data"] = updatedLeadsData
    responseObj["number_of_leads"] = leadsData.length
    return fetchResponse(res, "Assigned Leads Fetched!", responseObj)
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const getClosedLeads = async (req, res) => {
  try {
    // console.log(req.user);
    const permissionLength = req.user.role.permission.length
    let leadsData

    if (permissionLength !== 4) {
      return errorResponse(res, "Not authorized!", "")
    }
    // Add the userAssociated field to the leadsData
    leadsData = leadsData = await Leads.find({
      isCompleted: true,
      company: req.user.company._id,
    })
    let responseObj = {}
    responseObj["lead_data"] = leadsData
    responseObj["number_of_leads"] = leadsData.length
    return fetchResponse(res, "Closed Leads Fetched!", responseObj)
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const getLostLeads = async (req, res) => {
  try {
    // console.log(req.user);
    const permissionLength = req.user.role.permission.length
    let query = {}
    if (permissionLength !== 4) {
      query["users.id"] = req.user._id
    }
    // Add the userAssociated field to the leadsData
    let leadsData = await Leads.find({
      leadType: "LOST",
      company: req.user.company._id,
    })
    let responseObj = {}
    responseObj["lead_data"] = leadsData
    responseObj["number_of_leads"] = leadsData.length
    return fetchResponse(res, "Closed Leads Fetched!", responseObj)
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const getTotalLeads = async (req, res) => {
  try {
    let matchQuery = {}
    matchQuery["company"] = req.user.company._id
    matchQuery["isTrashed"] = false
    if (!isAdmin(req)) {
      // matchQuery["users.upperUsers"] = { $in: [req.user._id] }
      matchQuery.$or = [
        { "users.upperUsers": { $in: [req.user._id] } },
        {
          users: {
            $elemMatch: {
              id: req.user._id,
              $or: [
                { currentUser: true },
                {
                  currentUser: false,
                  $or: [
                    { leadStatus: "REJECTED", reasonForRejection: "" },
                    { leadStatus: "SKIPPED" },
                    { leadStatus: "ACCEPTED" },
                  ],
                },
              ],
            },
          },
        },
      ]
    }

    // Add the userAssociated field to the leadsData
    console.log(matchQuery)
    leadsData = leadsData = await Leads.find(matchQuery)
      .populate("leadCreatedBy", { firstName: 1, lastName: 1, _id: 0 })
      .populate("users.id", "firstName lastName")
      .populate("company")
      .sort({ createdAt: -1 })
      .lean()
    // console.log(leadsData)
    // Add the userAssociated field to the leadsData
    const updatedLeadsData = leadsData.map((lead) => ({
      ...lead,
      userAssociated: lead.users.find((user) => user.currentUser)?.id
        ? `${lead.users.find((user) => user.currentUser).id.firstName} ${
            lead.users.find((user) => user.currentUser).id.lastName
          }`
        : null,
    }))
    let responseObj = {}
    responseObj["lead_data"] = updatedLeadsData
    responseObj["number_of_leads"] = leadsData.length
    return fetchResponse(res, "Total Leads Fetched!", responseObj)
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const getMeetings = async (req, res) => {
  try {
    let userId = req.user._id
    // console.log(req.user._id);
    const currentDate = moment().format("YYYY-MM-DD") // Get today's date in YYYY-MM-DD format
    const leads = await Leads.find({
      users: {
        $elemMatch: {
          id: userId, // Filter by user._id
          currentUser: true, // Ensure currentUser is true,
          leadStatus: "ACCEPTED",
        },
      },
      // "followUpInfo.targetDate": currentDate, // Filter by today's date
    })
    console.log("currentDate : ", currentDate)
    console.log("leads : ", leads)
    const formattedData = leads.map((lead) => {
      console.log(lead)
      const fullName = `${lead.firstName} ${lead.lastName}`
      return lead.followUpInfo
        .filter(
          (info) => info.targetDate == currentDate && info.isCompleted === false
        )
        .map((info) => ({
          relatedTo: fullName,
          subject: info.subject,
          targetTime: info.targetTime,
          targetDate: info.targetDate,
          purpose: info.purpose,
          notes: info.notes,
          location: info.location,
          isCompleted: info.isCompleted,
          completionTime: info.completionTime,
          completionDate: info.completionDate,
        }))
    })
    // console.log("formattedData : ", formattedData)
    // Flatten the array and remove any empty arrays
    const followUpData = formattedData.flat()
    return fetchResponse(res, "Meetings fetched!", followUpData)
  } catch (error) {
    console.log(error)
    return errorResponse(
      res,
      "Something went wrong while fetching meetings details!",
      ""
    )
  }
}
const getPipelineLead = async (req, res) => {
  Leads.aggregate([
    {
      $match: {
        company: req.user.company._id,
        leadType: "hot-lead",
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        leads: { $push: "$$ROOT" },
      },
    },
  ])
    .then((result) => {
      // console.log(result)
      const count = result[0]?.count
      const hotLeads = result[0]?.leads
      return fetchResponse(res, "Hot Leads : ", hotLeads)
    })
    .catch((err) => {
      console.log(err)
    })
}
const leadTypeData = async (req, res) => {
  try {
    const permissions = ["read", "create", "delete", "update"] // Define the required permissions
    const hasAllPermissions = permissions.every((requiredPermission) =>
      req.user.role.permission.some(
        (userPermission) => userPermission.value === requiredPermission
      )
    )
    const company = req.user.company._id
    // Define an array of lead sources you want to include in the response
    const leadTypeToInclude = [
      "none",
      "attempted-to-contact",
      "cold-lead",
      "warm-lead",
      "hot-lead",
      "contact-in-future", // Added "google-ads" to the array
      "Contacted",
      "Junk-lead",
      "Lost-lead",
      // "not-Contacted",
      // "Pre-Qualified",
      // "not-Qualified",
      "client",
    ]

    // Create a match query to filter based on the specified lead sources
    const matchQuery = {
      company,
      leadType: { $in: leadTypeToInclude },
    }
    if (!hasAllPermissions) {
      matchQuery["users.id"] = req.user._id
      matchQuery["users.currentUser"] = true
    }

    const data = await Leads.aggregate([
      {
        $match: matchQuery,
      },
      {
        $group: {
          _id: "$leadType",
          count: { $sum: 1 },
        },
      },
    ])

    // Create an object with zero counts for missing lead sources
    const response = leadTypeToInclude.map((leadType) => ({
      leadType,
      count: 0, // Default to zero count
    }))

    // Update counts for lead sources that exist in the aggregation result
    data.forEach((item) => {
      const index = response.findIndex((entry) => entry.leadType === item._id)
      if (index !== -1) {
        response[index].count = item.count
      }
    })

    return fetchResponse(res, "Lead source count fetched!", response)
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      code: "ERROR",
      message: "Internal Server Error",
    })
  }
}
const allLeadCount = async (req, res) => {
  try {
    const countResult = await Leads.aggregate([
      {
        $match: {
          company: req.user.company._id,
        },
      },
      // {
      //   $group: {
      //     _id: "$status",
      //     name: { $first: "Total number of leads" }, // Using $first to pick the first encountered value (which is constant here)
      //     value: { $sum: 1 },
      //     color: { $first: "#dc305b" }, // Similarly, using $first for a constant color
      //   },
      // },
    ])

    return fetchResponse(res, "Total Leads count!", countResult)
  } catch (err) {
    console.log(err)
    return errorResponse(
      res,
      "Something went wrong while fetching meetings details!",
      ""
    )
  }
}
const monthwiseLeads = async (req, res) => {
  try {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1 // Months are 0-indexed in JavaScript (0 for January)

    const countResult = await Leads.aggregate([
      {
        $match: {
          $expr: {
            $and: [
              { $eq: [{ $year: "$createdAt" }, year] },
              { $eq: [{ $month: "$createdAt" }, month] },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ])

    if (countResult.length > 0) {
      return fetchResponse(res, "Total Leads count!", countResult[0].count)
    } else {
      return fetchResponse(res, "Total Leads count!", 0)
      res.json(0) // Return 0 if there are no leads for the current month
    }
  } catch (err) {
    return errorResponse(
      err,
      "Something went wrong while fetching meetings details!",
      ""
    )
  }
}
const topHotleads = async (req, res) => {
  try {
    let query = {
      company: req.user.company._id,
    }
    if (!isAdmin(req)) {
      query["users"] = {
        $elemMatch: {
          id: req.user.id,
          leadStatus: { $in: ["PENDING", "ACCEPTED"] },
        },
      }
    }
    // console.log(query);
    const leads = await Leads.find({
      $and: [{ leadType: "hot-lead" }, query],
    }).limit(5)
    return fetchResponse(res, "Top Hot Leads fetched!", leads)
  } catch (error) {
    console.log(error)
    return errorResponse(res, "Something went wrong!", null)
  }
}
const recentLeads = async (req, res) => {
  try {
    const recentLeadsIds = await Users.findById(req.user._id, {
      recentlyViewed: 1,
    })
    // console.log(recentLeadsIds);
    const leads = await Leads.find({
      _id: { $in: recentLeadsIds.recentlyViewed },
    })
    return fetchResponse(res, "Recent leads fetched successfully!", leads)
  } catch (error) {
    console.log(error)
    return errorResponse(
      res,
      "Something went wrong while fetching recent leads!",
      null
    )
  }
}
const topUser = async (req, res) => {
  try {
    const top5Users = await Analytic.aggregate([
      {
        $match: {
          company: req.user.company._id,
        },
      },
      {
        $addFields: {
          conversionRate: {
            $multiply: [
              { $divide: ["$convertedLeads", "$assignedLeads"] },
              100,
            ],
          },
        },
      },
      {
        $sort: { conversionRate: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "users", // Replace with the actual name of the users collection
          localField: "user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: "$userInfo",
      },
      {
        $project: {
          _id: 0,
          conversionRate: 1,
          assignedLeads: 1,
          convertedLeads: 1,
          rejectedLeads: 1,
          acceptedLeads: 1,
          userId: "$userInfo._id",
          userName: {
            $concat: ["$userInfo.firstName", " ", "$userInfo.lastName"],
          },
          profilePic: "$userInfo.profile", // Update with the correct field storing profile pic path
        },
      },
    ])
    const usersWithHotLeadCount = await Promise.all(
      top5Users.map(async (user) => {
        // console.log(user);
        const hotLeadsCount = await Leads.countDocuments({
          users: {
            $elemMatch: {
              id: user.userId,
              leadStatus: "ACCEPTED",
            },
          },
          leadType: "hot-lead",
        })
        return { ...user, hotLeadsCount }
      })
    )
    return fetchResponse(res, "Top users fetched!", {
      top5Users: usersWithHotLeadCount,
    })
  } catch (error) {
    console.log(error)
    return errorResponse(
      res,
      "Something went wrong while fetching top users!",
      null
    )
  }
}
module.exports = {
  topUser,
  recentLeads,
  getLostLeads,
  cardsData,
  usersLeadData,
  todaysLead,
  penVsAccVsRej,
  leadSourceData,
  tickerAPIReminderCall,
  getAllAssignedLeads,
  getAllUnassignedLeads,
  getFacebookLeads,
  getMeetings,
  getClosedLeads,
  getTotalLeads,
  getPipelineLead,
  leadTypeData,
  allLeadCount,
  monthwiseLeads,
  topHotleads,
}
