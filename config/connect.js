const mongoose = require("mongoose")
require("dotenv").config()
module.exports = async function connectToDatabase() {
  try {

    await mongoose.connect(`mongodb+srv://ayushsharma:p1dna2CbLNLa2LkU@cluster0.eifv0gq.mongodb.net/crm`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      family: 4, 
    })
    console.log(`Connected to database: ${mongoose.connection.name}`)
  } catch (error) {
    console.error("Error connecting to the database:", error)
  }
}
