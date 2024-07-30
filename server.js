const express = require("express")
const cors = require("cors")
const connect = require("./config/connect")
var bodyParser = require("body-parser")
const path = require("path")
const helmet = require("helmet")
require("dotenv").config()
const exchangeTokenTime = 15 * 60 * 1000 // 15 minutes
const { processAllLeads } = require("./utils/processLeads.js")
const app = express()
const http = require("http")
const server = http.createServer(app) // Replace 'app' with your Express app
const socketService = require("./utils/socketService")

const PORT = process.env.PORT
app.use(express.json({ urlencoded: true }))
app.use(
  cors({
    origin: "*",
  })
)
app.use(helmet())
socketService.initialize(server)
app.use(express.static(path.join(__dirname, "/public")))
app.use(bodyParser.urlencoded({ extended: true }))
const authRouter = require("./Auth/router.js")
const planRouter = require("./plan/router.js")
const companyRouter = require("./company/router")
const roleRouter = require("./role/router")
const verifyRouter = require("./verify/router")
const leadRouter = require("./leadSource/router")
const leadHistoryRouter = require("./history/router")
const dashboardRouter = require("./Dashboard/router")
const notesRouter = require("./notes/router")
const invoiceRouter = require("./invoices/route")
const productRouter = require("./product/router")
const trackerRouter = require("./userTracker/router")
const analytic = require("./analytic/router")
const googleAds = require("./googleAds/router.js")
const iFrame = require("./iFrame/router.js")
const FilesRouter = require("./documents/router.js")
const { exchangeToken } = require("./utils/exchangeFbToken")
app.use("/auth", authRouter)
app.use("/files", FilesRouter)
app.use("/analytic", analytic)
app.use("/tracker", trackerRouter)
app.use("/product", productRouter)
app.use("/company", companyRouter)
app.use("/notes", notesRouter)
app.use("/dashboard", dashboardRouter)
app.use("/history", leadHistoryRouter)
app.use("/plan", planRouter)
app.use("/role", roleRouter)
app.use("/verify", verifyRouter)
app.use("/leadSource", leadRouter)
app.use("/invoice", invoiceRouter)
app.use("/googleAds", googleAds)
app.use("/iframe", iFrame)

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
  process.exit(1)
})

// for export xlsx file
app.get("/download", (req, res) => {
  const filePath = path.join(
    __dirname,
    "public",
    "uploads",
    "LeadSampleData.xlsx"
  )
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=LeadSampleData.xlsx"
  )
  res.download(filePath, "LeadSampleData.xlsx")
})

process.env.TZ = 'Asia/Kolkata'; // Set to the desired timezone
// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Promise Rejection:", reason)
})
setInterval(exchangeToken, exchangeTokenTime)
async function startServer() {
  try {
    
    // Connect to the database
    await connect()
    // Database connected successfully, now start the server
    server.listen(PORT, () => {
      console.log("Server is running on port :", PORT)
    })
  } catch (error) {
    console.error("Failed to connect to the database:", error)
    process.exit(1)
  }
}

setInterval(processAllLeads, 1000 * 60 * 10)
// console.log(moment().format("hh:mm A"));
startServer()
