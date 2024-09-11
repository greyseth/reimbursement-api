const mysql = require("mysql");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "projectpkl2",
});

connection.connect();

module.exports = connection;
