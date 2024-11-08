const connection = require("../db");

module.exports = function (req, res, next) {
  connection.query(
    `SELECT role FROM user WHERE login_token = ?;`,
    [req.headers.account_token],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Unauthorized access" });

      if (rows[0].role === "admin") next();
    }
  );
};
