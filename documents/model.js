const mongoose = require("mongoose")
const documentSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Leads",
      required: true,
    },
    files:[
      {
        _id:false,
        fileName:String,
        size:String,
        path:String,
        uploadedAt:String,
        uploadedBy:{
          type: mongoose.Schema.Types.ObjectId,
          ref: "Users",
        },
      }
    ]
  },
  { collection: "leads_documents" }
)
const Document = mongoose.model("Document", documentSchema)
module.exports = { Document }
