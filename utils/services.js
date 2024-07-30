const { Leads } = require("../leadSource/model")
const moment = require("moment")
module.exports = {
  // Function to save leads from the response
  // saveLeadsFromResponse: async (req, campaign_name, responseData) => {
  //   console.log("responseData : ", responseData)
  //   const leadsToSave = []
  //   // Iterate through the response data
  //   for (const responseItem of responseData) {
  //     const leadData = {
  //       // Map response data to your schema fields
  //       firstName: "", // Initialize empty values for fields you don't have in the response
  //       lastName: "",
  //       date: responseItem?.created_time,
  //       time: responseItem?.created_time,
  //       description: "",
  //       email: "",
  //       leadSource: "facebook", // Assuming Facebook as the lead source
  //       leadType: "",
  //       phone: "",
  //       readytoRunBusiness: "",
  //       servicesEnquired: "",
  //       budget: "",
  //       campaignName: campaign_name, // You may need to populate this based on your data
  //       state: "",
  //       city: "",
  //       country: "", // Assuming a default country
  //       company: req.user.company._id, // Replace with your company's ObjectId
  //     }

  //     for (const fields of responseItem) {
  //       // Iterate through the field data
  //       for (const field of fields?.field_data) {
  //         const fieldName = field?.name
  //         const fieldValue = field?.values[0] // Take the first value from the array

  //         // Map field data to the appropriate fields in your schema
  //         switch (fieldName) {
  //           case "email":
  //             leadData.email = fieldValue
  //             break
  //           case "full_name":
  //             const [firstName, lastName] = fieldValue.split(" ")
  //             leadData.firstName = firstName
  //             leadData.lastName = lastName
  //             break
  //           case "city":
  //             leadData.city = fieldValue
  //             break
  //           case "what_is_your_budget?":
  //             leadData.budget = fieldValue
  //             break
  //           case "phone_number":
  //             leadData.phone = fieldValue
  //             break
  //           case "are_you_already_running_a_business?":
  //             leadData.readytoRunBusiness = fieldValue
  //             break
  //           // Add more cases for other fields if necessary
  //         }
  //       }
  //     }

  //     const existingLead = await Leads.findOne({
  //       $or: [{ email: leadData.email }, { phone: leadData.phone }],
  //     })

  //     if (existingLead) {
  //       // Handle duplicates, you can update the existing lead or skip it
  //       console.log(
  //         `Duplicate lead found for email: ${leadData.email} or phone: ${leadData.phone}`
  //       )
  //       continue
  //     }
  //     leadsToSave.push(leadData)
  //   }
  //   // console.log("leadsToSave : ", leadsToSave)
  //   // Save the leads to the database
  //   try {
  //     await Leads.create(leadsToSave)
  //     let campaignLeads = await Leads.find({ campaignName: campaign_name })
  //       .populate("leadCreatedBy", "firstName lastName")
  //       .populate("users.id", "firstName lastName")
  //       .sort({ createdAt: -1 })
  //       .lean()
  //     const updatedLeadsData = campaignLeads.map((lead) => ({
  //       ...lead,
  //       userAssociated: lead.users.find((user) => user.currentUser)?.id
  //         ? `${lead.users.find((user) => user.currentUser).id.firstName} ${
  //             lead.users.find((user) => user.currentUser).id.lastName
  //           }`
  //         : null,
  //     }))
  //     return updatedLeadsData
  //   } catch (error) {
  //     console.log(error)
  //     return this.errorResponse(
  //       res,
  //       "somethinf went wrong while fetrching FB leads of campaign!",
  //       ""
  //     )
  //   }
  // },
  saveLeadsFromResponse: async (req, res, pageName, responseData) => {
    const leadsToSave = []
    for (const responseItem of responseData) {
      const leadData = {
        // Initialize fields with default values
        firstName: "",
        lastName: "",
        description: "",
        email: "",
        leadSource: "facebook", // Assuming Facebook as the lead source
        leadType: "",
        phone: "",
        readytoRunBusiness: "",
        servicesEnquired: "",
        budget: "",
        pageName: pageName, // You may need to populate this based on your data
        state: "",
        city: "",
        country: "", // Assuming a default country
        company: req.user.company._id, // Replace with your company's ObjectId
        createdDate: moment(responseItem.created_time).format("DD-MM-YYYY"),
        createdTime: moment(responseItem.created_time).format("hh:mm A"),
      }
      // Iterate through the field data
      for (const field of responseItem?.field_data) {
        const fieldName = field?.name
        const fieldValue = field?.values[0] // Take the first value from the array

        // Map field data to the appropriate fields in your schema
        switch (fieldName) {
          case "email":
            leadData.email = fieldValue
            break
          case "full_name":
            const [firstName, lastName] = fieldValue.split(" ")
            leadData.firstName = firstName
            leadData.lastName = lastName
            break
          case "city":
            leadData.city = fieldValue
            break
          case "what_budget_do_you_have_in_mind?":
          case "do_you_have_any_budget_in_mind?_if_yes,_please_mention_budget.":
          case "what is your budget?":
            leadData.budget = fieldValue
            break
          case "phone_number":
            leadData.phone = fieldValue
            break
          case "are_you_running_a_business?":
            leadData.readytoRunBusiness = fieldValue
            break
          case "what_type_of_service_do_you_require?":
          case "for_what_type_of_business_do_you_need_the_website?":
            leadData.servicesEnquired = fieldValue
            break
          // Add more cases for other fields if necessary
        }
      }
      // Check for duplicates based on email or phone
      const existingLead = await Leads.findOne({
        $and: [
          { $or: [{ email: leadData.email }, { phone: leadData.phone }] },
          { company: req.user.company._id },
        ],
      })
      if (existingLead) {
        // Handle duplicates - you can update the existing lead or skip it
        console.log(
          `Duplicate lead found for email: ${leadData.email} or phone: ${leadData.phone}`
        )
        continue
      }
      leadsToSave.push(leadData)
    }
    // console.log("Leads to save :", leadsToSave)
    // Save the leads to the database
    try {
      const updatedLeadsData = await Leads.create(leadsToSave)
      // console.log(updatedLeadsData)
      return updatedLeadsData
    } catch (error) {
      console.error(error)
      return this.errorResponse(
        res,
        "Something went wrong while fetching FB leads of the campaign!",
        ""
      )
    }
  },
}
