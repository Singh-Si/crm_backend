const { Users } = require('../Auth/model'); // Replace with the correct path

async function getHierarchyIds(userId) {
  try {
    const user = await Users.findById(userId)
      .select('admin teamLead manager clusterHead')

    const hierarchyIds = [
      user.admin ? user.admin : null,
      user.teamLead ? user.teamLead : null,
      user.manager ? user.manager : null,
      user.clusterHead ? user.clusterHead : null,
    ];
    return hierarchyIds.filter(Boolean); // Removing any null values
  } catch (error) {
    // Handle errors, e.g., return a default value or throw an error
    console.error("Error:", error);
    return [];
  }
}

module.exports = {
    getHierarchyIds
}
