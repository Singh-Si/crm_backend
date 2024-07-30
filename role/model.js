const mongoose = require("mongoose")
const roleSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    permission: { type: Array},
    deletedAt: { type: Date, default: null }, // Field to mark soft deletion
    isTrashed: { type: Boolean, default: false }, // Field to mark soft deletion
  },
  { collection: "role", timestamps: true }
)

// Soft delete method
roleSchema.statics.softDelete = function (roleId) {
  return this.findByIdAndUpdate(roleId, {
    $set: { deletedAt: new Date(), isTrashed: true },
  })
}
const Role = mongoose.model("Role", roleSchema)
module.exports = { Role, roleSchema }
