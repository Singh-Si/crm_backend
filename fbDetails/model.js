const mongoose = require("mongoose")
const fbDetails = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String },
    id: { type: Number },
    access_token: { type: String },
  },
  { collection: "fb_details", timestamps: true }
)
const FB = mongoose.model("FB", fbDetails)
module.exports = { FB }
