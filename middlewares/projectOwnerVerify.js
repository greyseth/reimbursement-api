const connection = require("../db");

module.exports = function (req, res, next) {
  connection.query(
    `SELECT project.* FROM user LEFT JOIN project ON user.id_user = project.id_supervisor WHERE user.login_token = '${req.headers.account_token}' AND project.id_project = ${req.body.project_id} GROUP BY project.id_project;`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length > 0) next();
      else res.status(401).json({ error: "Unauthorized access" });
    }
  );
};