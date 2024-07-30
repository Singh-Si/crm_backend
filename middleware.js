const { verify } = require("jsonwebtoken")
const { Users } = require("./Auth/model")
const { Role } = require("./role/model")
const util = require("util")
const verifyPromise = util.promisify(verify)
const NodeCache = require("node-cache")
const myCache = new NodeCache()

module.exports = {
  checkToken: async (req, res, next) => {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]
    try {
      if (!token) {
        return res.status(401).json({ code: "UNAUTHORIZED" })
      }
      // Retrieve data from the cache
      const cachedValue = myCache.get("userData")
      if (myCache.has("userData") && cachedValue.token == token) {
        // console.log("Cached Value:", cachedValue);
        req.user = cachedValue
        next()
      } else {
        // console.log("no cached")
        const decoded = await verifyPromise(token, process.env.TOKEN_KEY)
        // console.log(decoded);
        const [user, roleData] = await Promise.all([
          Users.findById(decoded._id).populate({
            path: "company",
            populate: {
              path: "plan",
              model: "plan",
            },
          }),
          Role.findById(decoded.role).exec(),
        ])
        if (!user) {
          return res.status(404).json({ code: "USERNOTFOUND" })
        }
        // console.log(user.company)

        const currentDate = new Date();
        const expireOn = user?.company?.expireOn ? new Date(user.company.expireOn) : null;
        
        // console.log("expireOn : ", expireOn);
        // console.log("currentDate :", currentDate);
        
        // if (expireOn && expireOn <= currentDate) {
        //   console.log("Plan expired!");
        //   return res.status(403).json({
        //     code: "PLANEXPIRED",
        //     body: {
        //       token: token,
        //       verified: true,
        //     },
        //   }); 
        // }
        user.role = roleData
        user.token = token
        req.user = user
        req.roleData = roleData
        // console.log(user);
        myCache.set("userData", req.user, 7200) // Cache "message": "Internal server error"e data for 2 hour (7200 seconds)
        next()
      }
    } catch (error) {
      // console.error(error);
      return res.status(500).json({
        code: "SERVERERROR",
        error: error.message,
      })
    }
  },
}
