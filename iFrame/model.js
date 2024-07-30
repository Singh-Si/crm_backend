const mongoose = require("mongoose");
const iFrameSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    adName:{type: String, required: true},
    adId: { type: String, required: true },
    company: {type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true},
  },
  { collection: "iframes", timestamps: true }
);
const IFrames = mongoose.model("IFrames", iFrameSchema);
module.exports = { IFrames };  