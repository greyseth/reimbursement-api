const connection = require("../db");

module.exports = function (req, res, next) {
  let query = "";

  if (req.body.id_project !== undefined)
    query = `SELECT user.id_user, project.id_supervisor, project.id_instansi FROM user LEFT JOIN project ON project.id_project = ${req.body.id_project} WHERE user.login_token = '${req.headers.account_token}';`;
  else
    query = `SELECT user.id_user, departemen.id_leader FROM user LEFT JOIN departemen ON departemen.id_departemen = user.id_departemen WHERE user.login_token = '${req.headers.account_token}';`;

  console.log(query);
  connection.query(query, (err, rows, fields) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length < 1)
      return res.status(401).json({ error: "Invalid token" });

    const check = rows[0];
    console.log(check);

    res.locals.isSupervisor = check.id_user === check.id_supervisor;
    res.locals.isDepartmentLeader = check.id_user === check.id_leader;

    res.locals.id_user = check.id_user;
    res.locals.id_instansi = check.id_instansi;
    next();
  });
};
