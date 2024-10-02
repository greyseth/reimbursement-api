const connection = require("../db");

module.exports = (req, res, next) => {
  connection.query(
    `SELECT id_user, role FROM user WHERE login_token = '${req.headers.account_token}';`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Invalid account token" });

      res.locals.id_user = rows[0].id_user;
      res.locals.role = rows[0].role;
      next();
    }
  );
};
