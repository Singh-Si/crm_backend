const { Leads } = require("./model")
const { LeadHistory } = require("../history/model")
const moment = require("moment")
const fs = require("fs").promises
// const fs = require('fs');
const xlsx = require("xlsx") // For Excel parsing
const { Transform } = require('stream');


const {
  errorResponse,
  fetchResponse,
  unauthorizedResponse,
  notFoundResponse,
  createResponse,
} = require("../utils/response")
const { saveLeadsFromResponse } = require("../utils/services")
const axios = require("axios")
const { log } = require("console")
const { Tracker } = require("../userTracker/model")
const { isAdmin } = require("../utils/checkAdmin")
const { Users } = require("../Auth/model")
const { Analytic } = require("../analytic/model")
const { transporter } = require("../utils/email")
const { findAdmin } = require("../utils/findAdmin")
const mongoose = require("mongoose")
const { getHierarchyIds } = require("../utils/findPrevUsers")
const url = require("url")
const { FB } = require("../fbDetails/model")
require("dotenv").config()
module.exports = {
  getManualLeads: async (req, res) => {
    try {
      let leadsData
      if (isAdmin(req)) {
        leadsData = await Leads.find({
          leadSource: { $ne: "facebook" },
          company: req.user.company._id,
          isTrashed: false,
        })
          .populate("leadCreatedBy", "firstName lastName")
          .populate("company")
          .populate("users.id", "firstName lastName")
          .sort({ createdAt: -1 })
          .lean()
      } else {
        // Your existing code for permission check
        leadsData = await Leads.find({
          leadSource: { $ne: "facebook" },
          company: req.user.company._id,
          $or: [
            { leadCreatedBy: req.user._id },
            {
              users: {
                $elemMatch: {
                  id: req.user._id,
                  $or: [
                    { currentUser: true },
                    { leadStatus: "ACCEPTED" },
                    { leadStatus: "REJECTED" },
                  ],
                },
              },
            },
          ],
        })
          .populate("leadCreatedBy", { firstName: 1, lastName: 1, _id: 0 })
          .populate("users.id", "firstName lastName")
          .populate("company")
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
  },
  generateLead: async (req, res) => {
    try {
      // console.log(req.user);
      // return []
      const prevUserIds = await getHierarchyIds(req.user._id)
      const isLeadExist = await Leads.findOne({
        $or: [{ phone: req.body.phone }, { email: req.body.email }],
        company: req.user.company._id,
      })
      // console.log(isLeadExist);
      if (isLeadExist) {
        return res.status(409).json({
          code: "DUPLICATE",
          data: null,
          message:
            "Duplicate email or phone number, use another email or phone!",
        })
      }
      let leadDataObj = { ...req.body }
      if (req.body.product === "") {
        delete leadDataObj.product
      }
      leadDataObj["leadCreatedBy"] = req.user._id
      leadDataObj["currentStatus"] = req.body?.currentStatus
      leadDataObj["company"] = req.user.company._id
      leadDataObj["createdDate"] = moment().format("DD-MM-YYYY")
      leadDataObj["createdTime"] = moment().format("hh:mm A")
      if (!isAdmin(req)) {
        let usersArray = []
        let firstUserObj = {}
        firstUserObj["id"] = req.user._id
        ;(firstUserObj["assignedDate"] = moment().format("DD-MM-YYYY")),
          (firstUserObj["assignedTime"] = moment().format("hh:mm A")),
          (firstUserObj["currentUser"] = true),
          (firstUserObj["reasonForRejection"] = ""),
          (firstUserObj["leadStatus"] = "ACCEPTED")
        firstUserObj["upperUsers"] = prevUserIds
        firstUserObj["prevUser"] = req.user?.admin
        usersArray.push(firstUserObj)
        leadDataObj.users = firstUserObj
      }
      const leadGenerated = await Leads.create(leadDataObj)
      // const adminEmail = await findAdmin(req.user.company._id)
      // let mailOptions = {
      //   from: process.env.gmail_from,
      //   to: adminEmail,
      //   subject: `Lead Generated in Decode Sales CRM by ${req.user.firstName} ${req.user.lastName}`,
      //   text: `We’ve sent you this mail to notify that a lead generated with for ${req.body.firstName} ${req.body.lastName}.`,
      // }

      // Sending email
      // transporter.sendMail(mailOptions, (error, info) => {
      //   if (error) {
      //     console.log("Error occurred:", error.message)
      //     return
      //   }
      // await sendEmail('rakeshkumar@solistechnology.in', "Forget Password For Decode Sales" , `Your OTP is : ${otp} `)
      // console.log("Message ID:", info.messageId)
      // return fetchResponse(res, "Your otp is sent on your email!", {
      //   email: userEmail,
      // })
      // })
      const history = await LeadHistory.create({
        leadId: leadGenerated._id,
        action: "Lead Generated",
        actionBy: `${req.user.firstName}  ${req.user.lastName}`,
        company: req.user.company._id,
        date: moment().format("DD-MM-YYYY"),
        time: moment().format("hh:mm A"),
      })
      return res.status(201).json({
        code: "SUCCESS",
        data: leadGenerated,
        history,
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        code: "ERROR",
        data: error.message,
      })
    }
  },
  reasonForRejectionStatus: async (req, res) => {
    try {
      const { leadId, reasonForRejection } = req.body
      const userId = req.user._id

      // Find the lead with the matched condition
      const leadsData = await Leads.findOneAndUpdate(
        {
          _id: leadId,
          "users.id": userId,
          "users.currentUser": true,
          "users.leadStatus": "REJECTED",
        },
        {
          $set: {
            "users.$.reasonForRejection": reasonForRejection,
          },
        }
      )

      if (!leadsData) {
        return notFoundResponse(res, "No such lead to give reason!", "")
      }

      // Find the user object that matches the condition and has the prevUser
      const userToDelete = leadsData.users.find(
        (user) => user.id.toString() === userId.toString()
      )
      const prevUserId = userToDelete.prevUser

      // Delete the matched user object from the users array
      await Leads.updateOne(
        { _id: leadId },
        {
          $pull: {
            users: { id: userId },
          },
        }
      )

      // Find the user object with the matching prevUser and update its currentUser
      await Leads.updateOne(
        { _id: leadId, "users.id": prevUserId },
        {
          $set: {
            "users.$.currentUser": true,
          },
        }
      )

      await LeadHistory.create({
        leadId: leadsData._id,
        action: "Lead rejected due to " + reasonForRejection,
        actionBy: `${req.user.firstName}  ${req.user.lastName}`,
        company: req.user.company._id,
        date: moment().format("DD-MM-YYYY"),
        time: moment().format("hh:mm A"),
      })

      await Tracker.findOneAndUpdate(
        {
          leads: leadsData._id,
          company: req.user.company._id,
          user: req.user._id,
        },
        {
          description: reasonForRejection,
        }
      )

      return res.status(200).json({
        code: "SUCCESS",
        message: leadsData,
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        code: "ERROR",
        message: "Something went wrong while updating the lead!",
      })
    }
  },
  acceptLead: async (req, res) => {
    try {
      let toEmail = []
      const ccEmails = []
      const { leadId } = req.body
      const userId = req.user._id
      let prevUserId
      // Find the lead and the user with currentUser set to true
      const leadsData = await Leads.findOneAndUpdate(
        {
          _id: leadId,
          users: {
            $elemMatch: {
              id: userId,
              currentUser: true,
              leadStatus: "PENDING",
            },
          },
        },
        {
          $set: {
            "users.$.leadStatus": "ACCEPTED",
          },
        },
        { new: true }
      ).populate("users.prevUser", "email _id")
      // console.log(leadsData)
      if (!leadsData) {
        return notFoundResponse(
          res,
          "No such lead found for you to accept!",
          ""
        )
      }
      // console.log(leadsData.users)
      // Find the user object in the users array matching req.user._id
      for (const user of leadsData.users) {
        if (user.id.toString() === req.user._id.toString()) {
          toEmail.push(user?.prevUser.email)
          prevUserId = user?.prevUser._id
          break
        }
      }
      await LeadHistory.create({
        leadId: leadsData?._id,
        action: "Lead accepted",
        actionBy: `${req.user.firstName} ${req.user.lastName}`,
        company: req.user.company._id,
        date: moment().format("DD-MM-YYYY"),
        time: moment().format("hh:mm A"),
      })
      // console.log(prevUserId)
      ccEmails.push(req.user.email)
      // console.log(toEmail, "To Emails")
      // console.log(ccEmails, "CC Emails")
      await Tracker.create({
        user: req.user._id,
        leads: leadsData?._id,
        action: "accepted",
        company: req.user.company._id,
        userActionDate: moment().format("DD-MM-YYYY"),
        userActionTime: moment().format("hh:mm A"),
        manager: prevUserId,
      })
      await Analytic.findOneAndUpdate(
        { user: req.user._id, company: req.user.company._id },
        { $inc: { acceptedLeads: 1 } }
      )
      // const subject = "Lead Accepted"
      // const emailData =
      //  `Hi, Greetings of the day!
      //   You are recieving this email to inform you that
      //   ${leadsData.firstName } ${leadsData.lastName} lead accepted by  ${req.user.firstName}  ${req.user.lastName}.`
      // // const emailData = "Hi, Greetings of the day! " +
      // //   "You are recieving this email to inform you that " +
      // //   leadsData.firstName +
      // //   " " +
      // //   leadsData.lastName +
      // //   " lead accepted by " + req.user.firstName + " " + req.user.lastName + "!"
      // console.log("Email Data : ", emailData)
      // await emailService.sendEmail({to: toEmail, cc: ccEmails, subject, emailData})
      return res.status(200).json({
        code: "SUCCESS",
        message: leadsData,
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        code: "ERROR",
        message: "Something went wrong while updating the lead!",
      })
    }
  },
  rejectLead: async (req, res) => {
    try {
      let leadId = req.body.leadId
      const rejectedLead = await Leads.findOneAndUpdate(
        {
          _id: leadId,
          company: req.user.company._id,
          users: {
            $elemMatch: {
              id: req.user._id,
              leadStatus: "PENDING",
            },
          },
        },
        {
          $set: {
            "users.$.leadStatus": "REJECTED",
          },
        }
      )
      if (!rejectedLead)
        return notFoundResponse(res, "No lead to reject there!", "")
      // Find the user object in the users array matching req.user._id
      let prevUserId
      for (const user of rejectedLead.users) {
        if (user.id.toString() === req.user._id.toString()) {
          prevUserId = user.prevUser
          break
        }
      }
      // console.log("rejectedLead : ", rejectedLead)
      await LeadHistory.create({
        leadId: leadId,
        action: "Lead rejected ",
        actionBy: `${req.user.firstName}  ${req.user.lastName}`,
        company: req.user.company._id,
        date: moment().format("DD-MM-YYYY"),
        time: moment().format("hh:mm A"),
      })
      await Tracker.create({
        user: req.user._id,
        manager: prevUserId,
        leads: leadId,
        action: "rejected",
        company: req.user.company._id,
        userActionDate: moment().format("DD-MM-YYYY"),
        userActionTime: moment().format("hh:mm A"),
      })
      await Analytic.findOneAndUpdate(
        { user: req.user._id },
        { $inc: { rejectedLeads: 1 } }
      )
      return fetchResponse(res, "Lead rejected and updated successfully", "")
    } catch (error) {
      console.error("Error rejecting lead:", error)
      return res.status(500).json({ message: "Internal server error!" })
    }
  },
  updateLeadInfo: async (req, res) => {
    const { leadId } = req.params
    const updateFields = req.body // Fields to update
    try {
      const lead = await Leads.findById(leadId)
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" })
      }
      const previousLeadData = { ...lead.toObject() }
      if (req.body.product == "") {
        delete updateFields.product
      }
      lead.set(updateFields)
      await lead.save()
      // Compare the entire updated document with the previous document to determine updated fields
      const updatedFields = []
      for (const key in previousLeadData) {
        if (
          key !== "updatedAt" && // Exclude "updatedAt"
          key !== "__v" && // Exclude "__v"
          JSON.stringify(previousLeadData[key]) !== JSON.stringify(lead[key])
        ) {
          updatedFields.push(key)
        }
      }
      // Create a LeadHistory document
      await LeadHistory.create({
        leadId,
        action: "Lead information updated",
        fieldsUpdated: updatedFields,
        actionBy: `${req.user.firstName} ${req.user.lastName}`,
        company: req.user.company._id,
        date: moment().format("DD-MM-YYYY"),
        time: moment().format("hh:mm A"),
      })
      return res.status(200).json({
        message: "Lead updated successfully",
        updatedFields,
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ error: "Internal Server Error" })
    }
  },
  getLeadByLeadId: async (req, res) => {
    try {
      const leadsData = await Leads.findById(req.params.leadId)
        .populate("users.id")
        .populate("company", { email: 1, _id: 0 })
        .populate("leadCreatedBy", { firstName: 1, lastName: 1, _id: 0 })
        .lean()

      // Check if leadsData has the 'users' array
      if (leadsData && Array.isArray(leadsData.users)) {
        // Transform the 'users' array
        const transformedUsers = leadsData.users.map((user) => {
          const { _id, firstName, lastName } = user.id
          const {
            targetTime,
            currentUser,
            reasonForRejection,
            leadStatus,
            role,
          } = user

          return {
            id: _id,
            firstName,
            lastName,
            targetTime,
            currentUser,
            reasonForRejection,
            leadStatus,
            role,
          }
        })

        // Replace the 'users' array in leadsData with the transformedUsers
        leadsData.users = transformedUsers
      }
      console.log("leadsData : ", leadsData)
      await recentlyViewed(req.user._id, req.params.leadId)
      return fetchResponse(res, "FETCHED", leadsData)
    } catch (error) {
      console.log(error)
      return errorResponse(
        res,
        "Something went wrong while fetching lead!",
        error.message
      )
    }
  },
  fetchFbPagesFromFB: async (req, res) => {
    const accessToken = process.env.FB_ACCESS_TOKEN
    let company = req.user.company._id
    try {
      const pagesData = await axios.get(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
      )
      const pagesDataArray = pagesData.data.data
      let responsePages = []
      for (const { id, name, access_token } of pagesDataArray) {
        // console.log("Checking new Page")
        responsePages.push({
          id,
          name,
          access_token,
        })
        // const isPageExist = await FB.findOne({
        //   company: req.user.company._id,
        //   id: id,
        // })
        // // console.log("isPageExist : ", isPageExist)
        // if (!isPageExist) {
        //   // console.log("New Page generating");
        //   await FB.create({ company, id, name, access_token })
        //   // console.log("New Page generated");
        // }
      }
      return fetchResponse(
        res,
        "Facebook pages fetched and added!",
        responsePages
      )
    } catch (error) {
      console.error("Error fetching or adding pages:", error)
      return errorResponse(
        res,
        "Something went wrong while fetching or adding pages",
        error
      )
    }
  },

  getFbPagesFromDB: async (req, res) => {
    try {
      if (!isAdmin(req)) {
        return unauthorizedResponse(
          res,
          "You are not authorized to access this data!",
          null
        )
      }
      // Find the FB record based on the company ID
      const fbRecord = await FB.find( {company: req.user.company._id })
      // console.log("fbRecord :", fbRecord);
      if (fbRecord) {
        // const pages = fbRecord.pages
        return fetchResponse(
          res,
          "Facebook pages fetched successfully!",
          fbRecord
        )
      } else {
        return errorResponse(
          res,
          "No Facebook pages found for this company.",
          ""
        )
      }
    } catch (error) {
      console.error("Error fetching Facebook pages:", error.message)
      return errorResponse(
        res,
        "Something went wrong while fetching Facebook pages",
        ""
      )
    }
  },
  fetchLeadsByPageNameFromFB: async (req, res) => {
    try {
      // Loop through each page data object
      const result = await FB.findOne({
        company: req.user.company._id,
        id: req.body.id,
      })
      // console.log("result :", result);
      const accessToken = result.access_token
      // console.log(accessToken);
      // console.log()
      const leadFormsResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${req.body.id}/leadgen_forms?access_token=${accessToken}`
      )
      const leadForms = leadFormsResponse.data.data
      let allLeads = []
      // console.log("leadForms : ", leadForms)
      // Loop through lead forms for each page
      for (const leadForm of leadForms) {
        const leadsResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${leadForm.id}/leads?access_token=${accessToken}`
        )
        const leads = leadsResponse.data.data
        allLeads.push(...leads)
      }
      // return res.send(allLeads)
      const savedLeads = await saveLeadsFromResponse(
        req,
        res,
        req.body.name,
        allLeads
      )
      // At this point, allLeads array contains the aggregated leads data
      // console.log("All Leads:", allLeads)
      // Return or process the leads data as needed

      return fetchResponse(res, "Leads fetched successfully!", savedLeads)
    } catch (error) {
      console.error("Error fetching leads:", error.message)
      return errorResponse(
        res,
        "Something went wrong while fetching the leads data!",
        ""
      )
    }
  },
  getLeadsByPageNameFromDB: async (req, res) => {
    try {
      if (!isAdmin(req)) {
        return unauthorizedResponse(res, "Only admin can access!", null)
      }


      let leadsData = await Leads.aggregate([
        {
          $match: {
            leadSource: "facebook",
            company: req.user.company._id,
            pageName: req.body.pageName,
            isTrashed: false,
          },
        },
        {
          $addFields: {
            createdDateAsDate: {
              $toDate: "$createdDate",
            },
          },
        },
        {
          $sort: {
            createdDateAsDate: -1,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "leadCreatedBy",
            foreignField: "_id",
            as: "leadCreatedBy",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "users.id",
            foreignField: "_id",
            as: "populatedUsers",
          },
        },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            description: 1,
            email: 1,
            leadSource: 1,
            leadType: 1,
            phone: 1,
            readytoRunBusiness: 1,
            servicesEnquired: 1,
            budget: 1,
            users: {
              $map: {
                input: "$users",
                as: "user",
                in: {
                  id: {
                    _id: "$$user.id",
                    firstName: { $arrayElemAt: ["$populatedUsers.firstName", 0] },
                    lastName: { $arrayElemAt: ["$populatedUsers.lastName", 0] },
                  },
                  upperUsers: "$$user.upperUsers",
                  prevUser: "$$user.prevUser",
                  assignedDate: "$$user.assignedDate",
                  assignedTime: "$$user.assignedTime",
                  currentUser: "$$user.currentUser",
                  reasonForRejection: "$$user.reasonForRejection",
                  leadStatus: "$$user.leadStatus",
                },
              },
            },
            leadCreatedBy: {
              $concat: [
                { $arrayElemAt: ["$leadCreatedBy.firstName", 0] },
                " ",
                { $arrayElemAt: ["$leadCreatedBy.lastName", 0] },
              ],
            },
            currentStatus: 1,
            product: 1,
            pageName: 1,
            state: 1,
            city: 1,
            country: 1,
            company: 1,
            isCompleted: 1,
            followUpInfo: 1,
            isTrashed: 1,
            createdTime: 1,
            createdDate: 1,
            advertiseName: 1,
            // advertiseId: 1,
            // utm_source: 1,
            // utm_medium: 1,
            // utm_campaign: 1,
            // utm_id: 1,
            // utm_content: 1,
            // userAssociated: 1,
          },
        },
        {
          $project: {
            "users.id._id": 0, // Exclude the original '_id' field from users.id
          },
        },
      ]);
      
      return res.status(200).json({
        code: "SUCCESS",
        data: leadsData,
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        code: "ERROR",
        message: "Internal Server Error",
      })
    }
  },

  trashLeads: async (req, res) => {
    try {
      const permissions = ["read", "create", "delete", "update"] // Define the required permissions
      const hasPermissions = permissions.every((requiredPermission) =>
        req.user.role.permission.some(
          (userPermission) => userPermission.value === requiredPermission
        )
      )

      if (!hasPermissions) {
        return unauthorizedResponse(
          res,
          "Insufficient permissions to trash the lead!",
          null
        )
      }
      const leadTrashed = await Leads.findByIdAndUpdate(req.params.leadId, {
        $set: { isTrashed: true },
      })
      // console.log(leadTrashed)
      if (leadTrashed) {
        return fetchResponse(res, "Lead moved to trash!", "")
      } else {
        return fetchResponse(res, "Lead does not exist!", "")
      }
    } catch (error) {
      console.log(error)
      return errorResponse(res, "Something went wrong while trashing lead!", "")
    }
  },
  deleteLeads: async (req, res) => {
    try {
      const ids = req.body
      // console.log(ids, "IDS")
      // Loop through each ID and update the corresponding document
      const updatePromises =
        ids &&
        ids.map(async (id) => {
          const result = await Leads.updateOne(
            { _id: id },
            { $set: { isTrashed: true } }
          )
          return result
        })

      // Wait for all updates to complete
      const updateResults = await Promise.all(updatePromises)
      // Count the number of successful updates
      const modifiedCount = updateResults.filter(
        (result) => result.nModified > 0
      ).length

      res.json({ message: `Deleted  items` })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },
  getLeadsByCampaignName: async (req, res) => {
    try {
      const campaignLeads = await Leads.find({
        campaignName: req.body.campaign_name,
      }).lean()
      return fetchResponse(res, "Campaign Leads Fetched!", campaignLeads)
    } catch (error) {
      console.log(error)
      return errorResponse(
        res,
        "Something went wrong while fetching campaign leads!",
        ""
      )
    }
  },
  assignMultipleLeads: async (req, res) => {
    try {
      const currentDate = new Date()
      // Add one hour to the current date
      const targetTime = new Date(currentDate.getTime() + 60 * 60 * 1000) // Adding 1 hour in milliseconds
      // Create the matchQuery based on permissions and user ID
      const matchQuery = {
        _id: { $in: req.body.leadIds },
      }
      if (!isAdmin(req)) {
        matchQuery["users"] = {
          $elemMatch: {
            id: req.user._id,
            leadStatus: "ACCEPTED",
            // currentUser: true,
          },
        }
      }
      const assignedUser = req.body.userId
      const leads = await Leads.find(matchQuery)
    const AssignedUserEmail = req.body.userEmail
    const AssignedUserName = req.body.userName
      if (leads.length <= 0) {
        return notFoundResponse(res, "There is no lead to assign!", "")
      }
      for (const lead of leads) {
       
        let assignedUserAlreadyExist = lead.users.some(
          (user, index, array) =>
            user.id.toString() === assignedUser.toString() &&
            array.findIndex(
              (u) => u.id.toString() === assignedUser.toString()
            ) === index
        )
        if (assignedUserAlreadyExist) {
          continue
        }
        // Update the user properties if the current user is in the lead's users array
        const matchingUserIndex = lead.users.findIndex(
          (user) => user.id.toString() === req.user._id.toString()
        )
        if (matchingUserIndex !== -1) {
          lead.users[matchingUserIndex].currentUser = false
          lead.users[matchingUserIndex].nextUser = assignedUser
        }
        const prevUserIds = await getHierarchyIds(assignedUser)
        let firstUser = {
          id: assignedUser,
          prevUser: req.user._id,
          // targetTime:targetTime,
          assignedDate: moment().format("DD-MM-YYYY"),
          assignedDate: moment().format("DD-MM-YYYY"),
          assignedTime: moment().format("hh:mm A"),
          leadStatus: "PENDING",
          currentUser: true,
          upperUsers: prevUserIds,
          prevUser: req.user?._id,
        }
        lead.users.unshift(firstUser)
        // Save the updated lead
        await lead.save()
      }
      let numberOfLeads = req.body.leadIds.length
      const analyticsCreated = await Analytic.findOneAndUpdate(
        { user: req.body.userId }, // The query to find the document
        {
          $inc: { assignedLeads: numberOfLeads }, // Increment assignedLeads by 1
          $setOnInsert: {
            user: req.body.userId,
            company: req.user.company._id,
          }, // Set user if the document is created (upsert)
        },
        {
          new: true, // To return the updated document
          upsert: true, // Create a new document if it doesn't exist
        }
      )


      leads.forEach((lead, index) => {

        let mailOptions = { from : "developer@solistechnology.in",to:AssignedUserEmail,cc:"subhash.negi@assetsgalleria.com",subject:"New Lead Assigned: ",html :`
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">
        <head>
            <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
        </head>
        <body style="background-color:#efeef1;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation"
                style="max-width:37.5em;width:580px;margin:30px auto;background-color:#ffffff">
                <tbody>
                    <tr style="width:100%">
                        <td>
                            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="display:flex;justify-content:center;align-items:center;padding:30px">
                                <tbody>
                                    <tr>
                                        <td>
                                            <h3>🖐 Hey ${AssignedUserName}</h3>
                                        </td>
                                        
                                    </tr>
                                </tbody>
                            </table>
                            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:100%;display:flex">
                               
                            </table>
                            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:5px 50px 10px 60px">
                                <tbody>
                                    <tr>
                                        <td>
                                   
                                            <p style="font-size:16px;line-height:1.5;margin:16px 0"></p>
                                            <p style="font-size:16px;line-height:1.5;margin:16px 0">
                                            <h4><p>A new lead has been assigned to you. Please find the details below:</p></h4>
                                            <h4>Lead Name:&nbsp;
                                                <span style="color:#377dff;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
                                                    ${lead && lead.firstName}  ${lead && lead.lastName}
                                                </span>
                                            </h4>
                                            <h4>Email:&nbsp;
                                                <span style="color:#377dff;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
                                                    ${lead && lead.email}
                                                </span>
                                            </h4>
                                            <h4>Phone Number:&nbsp;
                                                <span style="color:#377dff;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
                                                    ${lead && lead.phone}
                                                </span>
                                            </h4>
                                            <h4>Description:&nbsp;
                                                <span style="color:#377dff;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
                                                    ${lead && lead.description}
                                                </span>
                                            </h4>
                                            <h4>Lead Source:&nbsp;
                                                <span style="color:#377dff;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
                                                    ${lead && lead.leadSource}
                                                </span>
                                            </h4>
                                            <h4>Budget:&nbsp;
                                                <span style="color:#377dff;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
                                                    ${lead && lead.budget}
                                                </span>
                                            </h4>
                                            </p>
                                            <p style="font-size:16px;line-height:1.5;margin:16px 0">Thanks,<br />Solis Technology Team</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:580px;margin:0 auto">
                <tbody>
                    <tr>
                        <td>
                            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                                <tbody style="width:100%">
                                    <tr style="width:100%">
                                        <td align="right" data-id="__react-email-column" style="width:50%;padding-right:8px"></td>
                                        <td align="left" data-id="__react-email-column" style="width:50%;padding-left:8px"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
    </html>
        `}
        transporter.sendMail(mailOptions,(error,info)=>{
          if(error){
            console.log("Error occurred:", error.message)
            return 
          }
          console.log("Message ID :",info.messageId)
          return fetchResponse(res,"Lead mail sent successfully")
          email:userEmail
         })
      })
   
      // console.log("analyticsCreated : ", analyticsCreated)
     
     
      return fetchResponse(res, "Leads assigned successfully!", "")
    } catch (error) {
      log(error)
      return errorResponse(
        res,
        "Something went wrong while assigning leads!",
        ""
      )
    }
  },
 
  
  importLeads: async (req, res) => {
    try {
      console.log(req.file);
      if (req.file) {
        const filePath = req.file.path
        const workbook = xlsx.readFile(filePath)
        const sheet_name_list = workbook.SheetNames
        const records = xlsx.utils.sheet_to_json(
          workbook.Sheets[sheet_name_list[0]]
        )

        const savedRecords = []
        const duplicateRecords = []
        const allowDuplicate = req.body.allowDuplicate === "true" || false;
        let user=[]
        if(!isAdmin(req)){
          const prevUserIds = await getHierarchyIds(req.user.
            _id)
          let firstUser = {
            id: req.user.
            _id,
            prevUser: req.user._id,
            // targetTime:targetTime,
            assignedDate: moment().format("DD-MM-YYYY"),
            assignedDate: moment().format("DD-MM-YYYY"),
            assignedTime: moment().format("hh:mm A"),
            leadStatus: "ACCEPTED",
            currentUser: true,
            upperUsers: prevUserIds,
            prevUser: req.user?._id,
          }
          user.push(firstUser)
        }
        
        for (const record of records) {
          if (allowDuplicate) {
            record.company = req.user.company._id
            record.createdDate = moment().format("DD-MM-YYYY")
            record.createdTime = moment().format("hh:mm A")
            await Leads.create(record)
            savedRecords.push(record)
          } else {
            let existingRecord
            if (record.email && record.phone) {
              existingRecord = await Leads.findOne({
                $or: [{ email: record.email }, { phone: record.phone }],
                company: req.user.company._id,
                isTrashed:false
              })
            } else if (record.email) {
              existingRecord = await Leads.findOne({
                email: record.email,
                company: req.user.company._id,
                isTrashed:false
              })
            } else if (record.phone) {
              existingRecord = await Leads.findOne({
                phone: record.phone,
                company: req.user.company._id,
                isTrashed:false
              })
            }

            if (existingRecord) {
              duplicateRecords.push(record)
            } else {
              record.company = req.user.company._id
              record.createdDate = moment().format("DD-MM-YYYY")
              record.createdTime = moment().format("hh:mm A")
              record.users = user
             const savedUser=  await Leads.create(record)
             console.log("savedUser : ", savedUser);
              savedRecords.push(record)
            }
          }
        }

        await fs.unlink(filePath)
        return createResponse(res, "Leads imported successfully!", {
          savedRecords,
          duplicateRecords,
        })
      } else {
        return errorResponse(res, "Please upload an Excel file!")
      }
    } catch (error) {
      console.error("Error saving data from file:", error)
      return res.status(500).send("Error saving data from file.")
    }
  },
  DeleteAllLeadsFromDB: async (req, res) => {
    try {
      // Remove documents based on the condition {isTrashed: true}
      const result = await Leads.deleteMany({ isTrashed: true });
  
      console.log(`${result.deletedCount} documents removed from the Leads collection`);
    } catch (error) {
      console.error('Error removing documents:', error);
    } finally {
      // Close the connection
      // client.close();
    }
  },
  filter: async (req, res) => {
    const isThisAdmin = isAdmin(req) // Assuming you have a function to check admin status
    const query = {
      company: req.user.company._id,
    }

    // Apply additional filters if present
    if (req.body.leadType) {
      query.leadType = req.body.leadType
    }
    if (req.body.leadSource) {
      query.leadSource = req.body.leadSource
    }
    // ... Add more filters as needed

    // Common date range filter for both user and admin
    if (req.body.from && req.body.to) {
      const fromDate = req.body.from
      const toDate = req.body.to
      if (req.body.user || !isThisAdmin) {
        query["users.assignedDate"] = {
          $gte: fromDate,
          $lte: toDate,
        }
      } else {
        query.createdDate = {
          $gte: fromDate,
          $lte: toDate,
        }
      }
    }
    if (req.body.user) {
      query["users.id"] = new mongoose.Types.ObjectId(req.body.user)
    } else if (!isThisAdmin) {
      query["users.id"] = req.user._id
    }
    // console.log(query);
    try {
      const result = await Leads.find(query)
      res.json(result)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },
  getAllLeadsOfUser: async (req, res) => {
    try {
      let leadsData
      let query = {
        company: req.user.company._id,
      }
      if (isAdmin(req)) {
        leadsData = await Leads.find(query)
          .populate("leadCreatedBy", "firstName lastName")
          .populate("company")
          .populate("users.id", "firstName lastName")
          .sort({ createdDate: -1 })
          .lean()
      }
      // Your existing code for permission check

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
        .sort({ createdAt: -1 })
        .lean()
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
  },
  savePageDetailsInCompany: async (req, res) => {
    try {
      let pagesDataArray = req.body.pagesDataArray
      console.log(pagesDataArray);
      // let savedPages = []
      for (const { value, label, access_token } of pagesDataArray) {
        const isPageExist = await FB.findOne({
          $and:[
            {company: req.user.company._id},
            {id: value}, 
          ]
        })
        // console.log("isPageExist : ", isPageExist)
        if (!isPageExist) {
          // console.log("New Page generating");
         const pageAdded =  await FB.create({
            company: req.user.company._id,
            id:value,
            name:label,
            access_token,
          })
          // savedPages.push(savedData)
          // console.log("New Page generated", pageAdded);
        }
      }
      return createResponse(res, "Pages are added successfully!", "")
    } catch (error) {
      console.log(error)
      return errorResponse(
        res,
        "Something went wrong while adding pages!",
        error.message
      )
    }
  },
}
async function recentlyViewed(userId, leadId) {
  try {
    const user = await Users.findOne({ _id: userId })
    // Check if leadId already exists in the array
    if (!user.recentlyViewed.includes(leadId)) {
      // Ensure uniqueness and keep the last 5 elements
      const updatedRecentlyViewed = [
        ...new Set([leadId, ...user.recentlyViewed]),
      ].slice(-5)
      await Users.findByIdAndUpdate(userId, {
        recentlyViewed: updatedRecentlyViewed,
      })
    }
    return true
  } catch (error) {
    console.error("Error tracking recently viewed:", error)
    return false
  }
}
