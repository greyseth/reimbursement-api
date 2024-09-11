const connection = require("../db");

module.exports = function (req, res, next) {
  connection.query(
    `SELECT instansi.id_instansi AS instansi, user.role FROM user LEFT JOIN instansi ON user.id_instansi = instansi.id_instansi WHERE user.login_token = '${req.headers.account_token}';`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Invalid account token" });

      if (rows[0].role === "supervisor") {
        res.locals.id_instansi = rows[0].instansi;
        next();
      } else res.status(401).json({ error: "Unauthorized access" });
    }
  );
};
