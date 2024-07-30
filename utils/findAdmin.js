const { Users } = require("../Auth/model");
const { Role } = require("../role/model");
const { errorResponse } = require("./response");

async function findAdmin(companyId){
    try {
        const roles = await Role.find({ companyId });

        // Find the role with permission length equal to 4
        const adminRole = roles.find(role => role.permission.length === 4);

        if (adminRole) {
            const adminRoleId = adminRole._id;
            const adminUser =  await Users.findOne({company:companyId, role:adminRoleId}, {email:1, _id:0})
            return adminUser
        } else {
            console.log("No role found with permission length equal to 4");
            // Handle the case where no role meets the condition
        }
        
    } catch (error) {
        console.log("Error while finding the admin email:", error);
        // return errorResponse(res, "Error while finding the admin email:", null)
    }
}

module.exports = {
    findAdmin
}