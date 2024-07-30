const mongoose = require("mongoose")
const productSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    productName: { type: String, required: true },
    slug: { type: String, required: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    files: [{
      _id:false,
      name:String,
      path:String
    }],
  },
  { collection: "products", timestamps: true }
)
const Product = mongoose.model("Product", productSchema)
module.exports = { Product }
