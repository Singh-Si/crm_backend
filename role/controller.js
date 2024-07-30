const { mongoose } = require("mongoose")
const {
  notFoundResponse,
  fetchResponse,
  errorResponse,
} = require("../utils/response")
const { Role } = require("./model")
module.exports = {
  addRole: async (req, res) => {
    try {
      const userData = req.body
      const existingUser = await Role.findOne({
        slug: userData.slug,
        companyId: req.user.company._id,
      })
      if (existingUser) {
        return res.status(200).json({
          code: "DUPLICATION",
          message: "Role  already exists.",
        })
      }
      const result = await Role.create(userData)
      res.status(200).json({
        code: "SUCCESS",
        data: result,
      })
    } catch (error) {
      console.error("Error adding Role:", error)
      res.status(500).json({
        code: "ERROR",
        message: "An error occurred while adding the Role.",
      })
    }
  },

  //--------------------GET DEPARTMENT----------------------------------
  getRole: async (req, res) => {
    try {
      const hasRootPermission = req.user.role.permission.some(
        (permission) => permission.value === "root"
      )
      if (hasRootPermission) {
        await Role.find({ companyId: req.user.company._id }).then(
          (result, err) => {
            if (result) {
              return res.status(200).json({
                code: "FETCHED",
                data: result,
              })
            } else {
              return res.status(400).json({
                code: "ERROR",
                data: err,
              })
            }
          }
        )
      } else {
        await Role.find({ companyId: req.user.company._id, deletedAt: null }).then(
          (result, err) => {
            if (result) {
              return res.status(200).json({
                code: "FETCHED",
                data: result,
              })
            } else {
              return res.status(400).json({
                code: "ERROR",
                data: err,
              })
            }
          }
        )
      }
    } catch (err) {
      console.log("err")
    }
  },
  updateRole: async (req, res) => {
    try {
      // const roleId = new mongoose.Types.ObjectId(req.params.id) // Assuming the role ID is passed as a URL parameter
      const { title, slug, permission, id } = req.body
      // console.log(req.params.id);
      // Find the role by ID
      const existingRole = await Role.findById(id)
      console.log(existingRole);
      if (!existingRole) {
        return notFoundResponse(res, "Role not found!", null)
      }
      // Update the role properties
      existingRole.title = title
      existingRole.slug = slug
      existingRole.permission = permission
      // Save the updated role to the database
      const updatedRole = await existingRole.save()
      return fetchResponse(res, "Role updated successfully!", updatedRole)
    } catch (error) {
      console.error("Error updating role:", error)
      return errorResponse(res, "Internal Server Error", null)
    }
  },
  deleteRole: async (req, res) => {
    try {
      const roleId = req.params.id 

      const existingRole = await Role.findById(roleId)
      if (!existingRole) {
        return notFoundResponse(res, "Role not found!", null)
      }
      
      await Role.softDelete(roleId);
      return fetchResponse(res, "Role SoftDeleted successfully!")
    } catch (error) {
      console.error("Error updating role:", error)
      return errorResponse(res, "Internal Server Error", null)
    }
  },
}
