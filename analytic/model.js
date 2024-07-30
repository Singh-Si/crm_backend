const mongoose = require("mongoose")
const analytics = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    assignedLeads: { type: Number },
    acceptedLeads: { type: Number },
    rejectedLeads: { type: Number },
    forwardedLeads: { type: Number },
    convertedLeads: { type: Number },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
  },
  { collection: "analytics", timestamps: true }
)

const Analytic = mongoose.model("Analytic", analytics)
module.exports = { Analytic }
