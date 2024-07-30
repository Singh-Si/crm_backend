const { Users } = require("./model")
const { hash, compare } = require("bcryptjs")
const moment = require("moment")
const {
  fetchResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  duplicateResponse,
} = require("../utils/response")
const { sign } = require("jsonwebtoken")
var bcrypt = require("bcryptjs")
const { Role } = require("../role/model")
const { Token } = require("../token/model")
const { validationResult } = require("express-validator")
const { generateOTP } = require("../utils/otpGenerator")
const { generateRandomToken } = require("../utils/createToken")
const { sendEmail, transporter } = require("../utils/email")
const { isAdmin } = require("../utils/checkAdmin")
require("dotenv").config()

module.exports = {
  register: async (req, res) => {
    const duplicateUser = await Users.findOne({ email: req.body.email })
    if (duplicateUser)
      return duplicateResponse(res, "User aleady exist with this email!", null)
    hash(req.body.password, 8, (err, hash) => {
      if (hash) {
        const user = new Users({
          ...req.body,
          password: hash,
          company: req.user.company._id,
          admin: req.user._id,
        })
        user.save().then(async (user) => {
          return res.status(200).json({
            code: "CREATED",
            data: user,
          })
        })
      }
    })
  },
  logOut: async (req, res) => {
    try {
      const authHeader = req.headers["authorization"]
      const token = authHeader && authHeader.split(" ")[1]
      if (!token) {
        return res.status(400).json({
          code: "ERROR",
          data: "Token not found!",
        })
      }
      // console.log(expiredTokens);
      // await Token.create({ token: token, isBlackListed: true })
      return res.status(400).json({
        code: "SUCCESS",
        data: "Logged out!",
      })
    } catch (error) {
      console.log(error.message)
      return res.status(400).json({
        code: "ERROR",
        data: "Something went wrong while logging out!",
      })
    }
  },
  getAllUser: async (req, res) => {
    try {
      let userList

      const pipeline = [
        {
          $match: {
            company: req.user?.company?._id,
          },
        },
        {
          $lookup: {
            from: "company", // Replace with the actual name of your company collection
            localField: "company",
            foreignField: "_id",
            as: "company",
          },
        },
        {
          $lookup: {
            from: "role", // Replace with the actual name of your role collection
            localField: "role",
            foreignField: "_id",
            as: "role",
          },
        },
        {
          $unwind: "$company",
        },
        {
          $unwind: "$role",
        },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            role: 1, // Include additional fields from roleDetails if needed
            company: 1, // Include additional fields from companyDetails if needed
            createdAt: 1,
            updatedAt: 1,
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
      ]

      userList = await Users.aggregate(pipeline)

      return res.status(200).json({
        code: "FETCHED",
        data: userList,
      })
    } catch (error) {
      console.error(error)
      return res.status(400).json({
        code: "ERROROCCURRED",
        data: error.message,
      })
    }
  },
  login: async (req, res, next) => {
    const { email, password } = req.body
    // Check if username and password is provided
    if (!email || !password) {
      return res.status(200).json({
        code: "ERROROCCURRED",
        data: "email or Password not present",
      })
    }
    try {
      const user = await Users.findOne({ email })
      if (!user) {
        res.status(200).json({
          code: "ERROROCCURRED",
          data: "User not found",
        })
      } else {
        // console.log("password", password);
        // console.log("user.password", user);
        // comparing given password with hashed password
        bcrypt.compare(password, user.password)
          .then(async function (result, err) {
            if (result) {
              const role = await Role.find({ _id: user.role })
              if (err) {
                return res.status(200).json({
                  code: "ERROROCCURRED",
                  data: err,
                })
              } else {
                // user.OTP = []
                const token = sign(
                  {
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    company: user.company,
                    role: role,
                  },
                  process.env.TOKEN_KEY,
                  {
                    expiresIn: "1d",
                  }
                )
                if (token) {
                  const user = await Users.findOne({ email })
                  await Users.findByIdAndUpdate(user._id, {
                    $set: {
                      isLoggedIn: true,
                      loggedInTime: new Date(),
                      OTP: [],
                    },
                  })
                  return res.status(200).json({
                    code: "FETCHED",
                    token: token,
                  })
                }
              }
            } else {
              return res.status(200).json({
                code: "UNAUTHORISED",
                data: "User password is not correct",
              })
            }
          })
      }
    } catch (error) {
      res.status(200).json({
        message: "ERROROCCURRED",
        error: error.message,
      })
    }
  },
  getUserInfo: async (req, res) => {
    try {
      const id = req.user._id
      const company = req.user.company._id
      const userData = await Users.findOne(
        { _id: id, company },
        {
          _id: 0,
          firstName: 1,
          lastName: 1,
          profile: 1,
          email: 1,
          role: 1,
          gender: 1,
          company: 1,
          dob: 1,
        }
      )
        .populate("role", { title: 1, _id: 0, permission: 1 })
        .populate("company", { company: 1, _id: 0 })
        .lean()
      if (!userData) {
        return res.status(404).json({
          message: "ERROR",
          data: null,
          message: "User not found!",
        })
      }
      // Create the iconText field by taking the first letters of firstName and lastName
      const iconText = `${userData.firstName[0]}${userData.lastName[0]}`
      userData.iconText = iconText // Add iconText to the userData object
      return res.status(200).json({
        message: "SUCCESS",
        data: userData,
      })
    } catch (error) {
      return res.status(200).json({
        message: "ERROROCCURRED",
        error: error.message,
      })
    }
  },
  deleteUser: async (req, res) => {
    const userIdToDelete = req.params.id // Get the user ID to delete from request parameters
    const permissions = ["read", "create", "delete", "update"] // Define the required permissions
    const userCompanyId = req.user.company._id // Get the company ID from the logged-in user

    try {
      // Check if req.user.role.permission contains all required permissions
      const hasPermissions = permissions.every((requiredPermission) =>
        req.user.role.permission.some(
          (userPermission) => userPermission.value === requiredPermission
        )
      )
      if (!hasPermissions) {
        return notFoundResponse(
          res,
          "Insufficient permissions to delete a user",
          null
        )
      }
      // Now you can proceed with deleting the user by ID
      const deletedUser = await Users.findOneAndDelete({
        _id: userIdToDelete,
        company: userCompanyId,
      })
      if (!deletedUser) {
        return notFoundResponse(res, "User not found!", null)
      }
      return fetchResponse(res, "User deleted successfully!", deletedUser)
    } catch (error) {
      console.error(error)
      return errorResponse(res, "Internal Server Error", null)
    }
  },
  editUser: async (req, res) => {
    const userIdToEdit = req.params.id // Get the user ID to edit from request parameters
    const userCompanyId = req.user.company._id // Get the company ID from the logged-in user

    try {
      // if (!isAdmin(req)) {
      //   return fetchResponse(
      //     res,
      //     "Insufficient permissions to edit a user",
      //     null
      //   )
      // }
      const updatedUser = await Users.findOneAndUpdate(
        {
          _id: userIdToEdit,
          company: userCompanyId,
        },
        { ...req.body, updatedAt: moment().format("DD-MM-YYYY") }, // Update the user's data with the request body data
        { new: true, projection: { password: 0 } } // Return the updated user document
      )
      if (!updatedUser) {
        return notFoundResponse(res, "User not found!", null)
      }
      return fetchResponse(res, "User updated successfully", updatedUser)
    } catch (error) {
      console.error(error)
      return errorResponse(res, "Internal Server Error", null)
    }
  },
  forgetPassword: async (req, res) => {
    try {
      const userEmail = req.body.email
      const isUserExist = await Users.findOne({ email: userEmail })
      if (!isUserExist) return notFoundResponse(res, "User not found!", "")
      const otp = generateOTP()
      if (otp) {
        isUserExist.OTP.unshift({
          otp,
          generatedAt: moment().format("hh:mm A"),
        })
        isUserExist.save()
        let mailOptions = {
          from: process.env.gmail_from,
          to: userEmail,
          subject: "Forget Password For Decode Sales",
          text: `We’ve sent you this mail in response to your request to reset your password on Decode Sales. Please enter the OTP to start the password reset process.
        OTP: ${otp}`,
        }
        // Sending email
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log("Error occurred:", error.message)
            return
          }
          // await sendEmail('rakeshkumar@solistechnology.in', "Forget Password For Decode Sales" , `Your OTP is : ${otp} `)
          console.log("Message ID:", info.messageId)
          return fetchResponse(res, "Your otp is sent on your email!", {
            email: userEmail,
          })
        })
      }
    } catch (error) {
      console.log("Error in forget password api: ", error)
      return errorResponse(res, "Something went wrong!", "")
    }
  },
  verifyOtp: async (req, res) => {
    try {
      const { email, otp } = req.body

      const user = await Users.findOne({
        email,
        "OTP.otp": otp,
      })
      // console.log(user);
      if (!user) return notFoundResponse(res, "Invalid OTP!", "")
      const currentTime = moment()
      const generatedAtTime = moment(user.OTP[0].generatedAt, "h:mm A")
      const minuteDifference = currentTime.diff(generatedAtTime, "minutes")

      if (minuteDifference <= 10) {
        user.OTP = []
        const token = await generateRandomToken()
        user.resetToken = token
        await user.save()
        return fetchResponse(res, "OTP is verified!", { resetToken: token })
      } else {
        return unauthorizedResponse(res, "Generated OTP has expired !", "")
      }
    } catch (error) {
      console.error("Error while verifying OTP:", error)
      return errorResponse(res, "Something went wrong", "")
    }
  },
  resetPassword: async (req, res) => {
    const { resetToken, confirmPassword, newPassword } = req.body
    try {
      // Find the user by email
      const user = await Users.findOne({ resetToken })
      if (!user) return notFoundResponse(res, "User not found", "")
      // Check if the current password matches the stored password
      if (confirmPassword !== newPassword)
        return notFoundResponse(res, "Password does not match!", "")
      const updatedPassword = await bcrypt.hash(newPassword, 8)
      user.resetToken = ""
      // Update the password with the new one
      user.password = updatedPassword
      await user.save()
      return res.json({ message: "Password updated successfully" })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Internal server error" })
    }
  },
  resendOTP: async (req, res) => {
    try {
      const userEmail = req.body.email
      console.log("userEmail:", userEmail)
      let query = {
        email: req.body.email,
      }
      console.log("query:", query)

      const isUserExist = await Users.findOne(query)
      console.log("isUserExist:", isUserExist)
      // if (!isUserExist) return notFoundResponse(res, "User not found!", "")
      const otp = generateOTP()
      if (otp) {
        isUserExist.OTP.unshift({
          otp,
          generatedAt: moment().format("hh:mm A"),
        })
        isUserExist.save()
        let mailOptions = {
          from: process.env.gmail_from,
          to: userEmail,
          subject: "Forget Password For Decode Sales",
          text: `We’ve sent you this mail in response to your request to reset your password on Decode Sales. Please enter the OTP to start the password reset process.
        OTP: ${otp}`,
        }
        // Sending email
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log("Error occurred:", error.message)
            return
          }
          // await sendEmail('rakeshkumar@solistechnology.in', "Forget Password For Decode Sales" , `Your OTP is : ${otp} `)
          console.log("Message ID:", info.messageId)
          return fetchResponse(res, "Your otp is sent on your email!", {
            email: userEmail,
          })
        })
      }
    } catch (error) {
      console.log("Error in resend OTP API: ", error)
      return errorResponse(res, "Something went wrong!", "")
    }
  },
}
