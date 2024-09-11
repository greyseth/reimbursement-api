const connection = require("../db");

module.exports = function (req, res, next) {
  if (!req.body.request_id && !req.params.request_id)
    return res.status(400).json({ error: "Missing request_id parameter" });
  connection.query(
    `SELECT request.id_request FROM user LEFT JOIN request ON user.id_user = request.id_user WHERE user.login_token = '${req.headers.account_token}'`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Unauthorized access" });
      next();
    }
  );
};
