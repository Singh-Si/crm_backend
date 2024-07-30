const swaggerAutogen = require("swagger-autogen")();

const docs = {
    info: {
        title: "API Documentation",
        description: "Solis CRM Backend Documentation"
    },
    host: "localhost:5000"
};

const outputFile = "./swagger.json";
const routes = ["server.js"];

swaggerAutogen(outputFile, routes, docs);