const { addRole, getRole, updateRole, deleteRole } = require("./controller");
const { checkToken} = require('../middleware');
const RoleRouter = require("express").Router();
RoleRouter.post("/add",checkToken, addRole);
RoleRouter.get("/get",checkToken, getRole);
RoleRouter.put("/update",checkToken, updateRole)
RoleRouter.delete("/delete/:id",checkToken, deleteRole)
module.exports = RoleRouter; 