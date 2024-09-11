const connection = require("../db");

module.exports = function (req, res, next) {
  connection.query(
    `SELECT user.id_user, user.id_instansi, user.role, request.id_request FROM user LEFT JOIN request ON request.id_instansi = user.id_instansi WHERE user.login_token = '${req.headers.account_token}';`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Unauthorized access" });

      if (rows[0].role === "supervisor" || rows[0].role === "finance") {
        res.locals.user_id = rows[0].id_user;
        res.locals.role = rows[0].role;
        next();
      } else res.status(401).json({ error: "Unauthoried access" });
    }
  );
};
