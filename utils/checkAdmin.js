const isAdmin = function (req) {
  const permissions = ["read", "create", "delete", "update"] // Define the required permissions
  return permissions.every((requiredPermission) =>
    req.user.role.permission.some(
      (userPermission) => userPermission.value === requiredPermission
    )
  )
}
module.exports ={
    isAdmin
}
