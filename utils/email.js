const AWS = require("aws-sdk")
const nodemailer = require('nodemailer');
require("dotenv").config()
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
})

const ses = new AWS.SES({ apiVersion: "2010-12-01" })

class EmailService {
  static async sendEmail({ to, cc, subject, emailData }) {
    // console.log(to);
    // console.log(cc);
    const params = {
      Destination: {
        ToAddresses:to,
        CcAddresses: cc,
      },
      Message: {
        Body: {
          Text: {
            Data: emailData,
          },
        },
        Subject: {
          Data: subject,
        },
      },
      Source: process.env.SENDER_EMAIL_ADDRESS, // Replace with your verified email address in AWS SES
    }
    try {
      const result = await ses.sendEmail(params).promise()
      console.log("Email sent:", result)
      return result
    } catch (error) {
      console.error("Error sending email:", error)
      throw error
    }
  }
}
console.log(process.env.gmail_user)
  // Create a Nodemailer transporter
let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: "developers@solistechnology.in", // Your email address
    pass: "SolisTech@4321"// Your email password or app-specific password
  }
});
module.exports = {EmailService , transporter}
