const moment = require("moment");
const { Leads } = require("../leadSource/model");

async function processAllLeads() {
  try {
    const allDocuments = await Leads.find({
      users: {
        $elemMatch: {
          currentUser: true,
          leadStatus: "PENDING"
        }
      }
    });

    for (const document of allDocuments) {
      const usersToUpdate = [];
      for (const user of document.users) {
        const { assignedDate, assignedTime, currentUser, leadStatus, prevUser } = user;
        const assignedDateTime = moment(`${assignedDate} ${assignedTime}`, "DD-MM-YYYY hh:mm A");
        if (assignedDateTime.isBefore(moment().subtract(2, "hours")) && currentUser) {
          console.log("Time Checked");
          if (currentUser && leadStatus === "PENDING") {
            console.log("inner if block");
            user.currentUser = false;
            user.leadStatus = "SKIPPED";
            const prevUserIndex = document.users.findIndex(u => u.id.toString() === prevUser.toString());
            if (prevUserIndex !== -1) {
              document.users[prevUserIndex].currentUser = true;
              usersToUpdate.push(document);
            } else {
              usersToUpdate.push(document);
            }
          } else {
            continue;
          }
        }
      }
      for (const docToUpdate of usersToUpdate) {
        await docToUpdate.save();
      }
    }
  } catch (error) {
    console.error("Error occurred while processing leads:", error);
  }
}

module.exports = {
  processAllLeads,
};
