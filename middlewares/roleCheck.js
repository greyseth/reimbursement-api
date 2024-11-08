const connection = require("../db");

module.exports = (req, res, next) => {
  connection.query(
    `
      SELECT user.id_user, user.role, request.id_project, project.id_supervisor, departemen.id_leader, s_approval.diterima AS supervisor_diterima 
      FROM user 
      LEFT JOIN request ON request.id_request = ? 
      LEFT JOIN project ON project.id_project = request.id_project 
      LEFT JOIN user owner ON owner.id_user = request.id_user 
      LEFT JOIN departemen ON departemen.id_departemen = owner.id_departemen
      LEFT JOIN approval s_approval ON s_approval.id_request = request.id_request AND s_approval.version = request.current_version AND s_approval.type = 'supervisor'
      WHERE user.login_token = ? GROUP BY user.id_user;`,
    [req.params.request_id, req.headers.account_token],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Invalid account token" });

      const check = rows[0];
      res.locals.role = check.role;
      res.locals.id_user = check.id_user;

      // Checks first if can be supervisor
      if (
        !check.supervisor_diterima &&
        check.id_user === check.id_leader &&
        !check.id_project
      ) {
        res.locals.role = "supervisor";
        return next();
      }

      // Checks if user is finance or realisasi
      if (check.role === "finance" || check.role === "realisasi") return next();

      // Checks if request is project based
      if (check.id_project) {
        if (check.id_user === check.id_supervisor)
          res.locals.role = "supervisor";
      } else {
        if (check.id_user === check.id_leader) res.locals.role = "supervisor";
      }

      next();
    }
  );
};
