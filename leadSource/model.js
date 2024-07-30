const { trusted } = require("mongoose")
const mongoose = require("mongoose")
const LeadSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    firstName: { type: String },
    lastName: { type: String },
    description: { type: String },
    email: { type: String, trim: true, unique:false},
    leadSource: { type: String },
    leadType: { type: String },
    phone: { type: String ,unique:false},
    readytoRunBusiness: { type: String },
    servicesEnquired: { type: String },
    budget: { type: String },
    users: [
      {
        _id: false,
        id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
        upperUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
        prevUser: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
        assignedDate: { type: String },
        assignedTime: { type: String },
        currentUser: { type: Boolean },
        reasonForRejection: { type: String, default: "" },
        leadStatus: {
          type: String,
          enum: ["PENDING", "ACCEPTED", "REJECTED", "SKIPPED"],
          default: "PENDING",
        },
      },
    ],
    leadCreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    currentStatus: { type: String, default: null },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    pageName: { type: String },
    state: { type: String },
    city: { type: String },
    country: { type: String },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },
    isCompleted: { type: Boolean, default: false },
    followUpInfo: [
      {
        _id: false,
        subject: {
          type: String,
          // enum: ['Call', 'virtual_meeting', 'physical_meeting', 'Other', 'none'],
          default: "none",
        },
        targetTime: { type: String },
        targetDate: { type: String },
        purpose: { type: String },
        notes: { type: String },
        location: { type: String },
        isCompleted: { type: Boolean, default: false },
        completionTime: { type: String, default: null },
        completionDate: { type: String, default: null },
        meetingHighlight: { type: String, default: null },
      },
    ],
    isTrashed: { type: Boolean, default: false },
    createdTime: { type: String, default: null },
    createdDate: { type: String, default: null },
    advertiseName: { type: String, default: "N/A" },
    advertiseId: { type: String, default: "N/A" },
    utm_source: { type: String },
    utm_medium: { type: String },
    utm_campaign: { type: String },
    utm_id: { type: String },
    utm_content: { type: String },
  },
  { timestamps: true }
)

const Leads = mongoose.model("Leads", LeadSchema)
module.exports = { Leads }
