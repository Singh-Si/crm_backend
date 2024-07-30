const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    profile: { type: String },
    password: { type: String, required: true, },
    email: {
      type: String,
      required: true,
      unique: true,
      // Email format validation using regex
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    // gender: {
    //   type: String,
    //   required: true,
    //   enum: ["Male", "Female", "Other"],
    // },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    OTP: [
      {
        _id: false,
        otp: String,
        generatedAt: { type: String, default: String },
      },
    ],
    resetToken: { type: String },
    isLoggedIn: { type: Boolean, default: false },
    loggedInTime: { type: String },
    lastSeenTime: { type: String },
    recentlyViewed: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Lead",
        },
      ],
      valiString: [
        {
          validator: function (array) {
            return array.length <= 5; // ValiString the array length
          },
          message: "Maximum 5 elements allowed in recentlyViewed array",
        },
      ],
    },
    teamLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    }, 
    clusterHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      // required: true,
    },
    createdAt: { type: String },
    updatedAt: { type: String},
  },
  { collection: "users", timestamps: true }
);

const Users = mongoose.model("Users", userSchema);
module.exports = { Users }; 0
