const express = require("express");
const router = express.Router();

const projectOwnerVerify = require("../middlewares/projectOwnerVerify");
const userVerify = require("../middlewares/userVerify");

const connection = require("../db");

router.post("/create", userVerify, async (req, res) => {
  const content = req.body;
  if (!content.name || !content.company_id || !content.supervisor_id)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.beginTransaction((err) => {
    if (err) {
      console.log("failed at beginning of transaction");
      return res.status(500).json({ error: err });
    }

    connection.query(
      `INSERT INTO project(nama_project, nama_client, deskripsi, id_supervisor, id_instansi, status, tanggal_pembuatan, tanggal_update, id_pembuat, tanggal_mulai, tanggal_selesai) VALUES(
      ?, ?, ?, ?, ?, 'berjalan', NOW(), NOW(), ${res.locals.id_user}, ?, ?);`,
      [
        content.name,
        content.client ?? "",
        content.deskripsi ?? "",
        content.supervisor_id,
        content.company_id,
        content.tanggal_mulai,
        content.tanggal_selesai,
      ],
      (err, rows, fields) => {
        if (err) {
          connection.rollback(() => {
            res.status(500).json({ error: err });
          });
          return;
        }

        const projectId = rows.insertId;

        if (content.members && content.members.length > 0) {
          const membersInsert = content.members.map((m) => [rows.insertId, m]);
          if (!content.members.includes(content.supervisor_id))
            membersInsert.push([rows.insertId, content.supervisor_id]);

          connection.query(
            `INSERT INTO user_project(id_project, id_user) VALUES ?`,
            [membersInsert],
            (err, rows, fields) => {
              if (err) {
                console.log("failed when inserting user_project");
                connection.rollback(() => {
                  res.status(500).json({ error: err });
                });
                return;
              }

              connection.commit((err) => {
                if (err)
                  return connection.rollback(() => {
                    res.status(500).json({ error: err });
                  });

                res.status(200).json({ project_id: projectId });
              });
            }
          );
        } else {
          connection.commit((err) => {
            if (err)
              return connection.rollback(() => {
                res.status(500).json({ error: err });
              });

            res.status(200).json({ project_id: projectId });
          });
        }
      }
    );
  });
});

const analysisRoleCheck = (req, res, next) => {
  connection.query(
    `SELECT role FROM user WHERE login_token = ?`,
    [req.headers.account_token],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Invalid account token" });
      if (rows[0].role !== "finance" && rows[0].role !== "realisasi")
        return res.status(401).json({ error: "Unauthorized access" });

      next();
    }
  );
};
router.get("/all/:search", analysisRoleCheck, (req, res) => {
  connection.query(
    `
      SELECT
      project.id_project, project.nama_project, project.deskripsi, project.tanggal_mulai, project.tanggal_selesai, 
      user.username AS supervisor, instansi.nama AS instansi, project.status
      FROM user_project 
      LEFT JOIN project ON user_project.id_project = project.id_project 
      LEFT JOIN user ON project.id_supervisor = user.id_user 
      LEFT JOIN instansi ON project.id_instansi = instansi.id_instansi 
      WHERE LOWER(project.nama_project) LIKE ? OR LOWER(project.deskripsi) LIKE ?
      GROUP BY project.id_project
    `,
    [
      "%" + req.params.search.toLowerCase() + "%",
      "%" + req.params.search.toLowerCase() + "%",
    ],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

// Gets collapsed project data from a single user
router.get("/own", userVerify, async (req, res) => {
  connection.query(
    `SELECT 
    project.id_project, project.nama_project, project.deskripsi, project.nama_client, project.tanggal_mulai, project.tanggal_selesai, 
    user.id_user AS id_supervisor, user.username AS supervisor, instansi.id_instansi, instansi.nama AS instansi, project.status
    FROM user_project 
    LEFT JOIN project ON user_project.id_project = project.id_project 
    LEFT JOIN user ON project.id_supervisor = user.id_user 
    LEFT JOIN instansi ON project.id_instansi = instansi.id_instansi 
    WHERE user_project.id_user = ${res.locals.id_user} GROUP BY project.id_project;`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err });
      res.status(200).json(rows);
    }
  );
});

// Gets full project data (without membets and activities)
router.get("/details/:id_project", async (req, res) => {
  connection.query(
    `SELECT project.*, user.username AS nama_supervisor, instansi.nama AS nama_instansi 
    FROM project 
    LEFT JOIN user ON project.id_supervisor = user.id_user 
    LEFT JOIN instansi ON project.id_instansi = instansi.id_instansi
    WHERE project.id_project = ${req.params.id_project}`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err });
      if (rows.length < 1) return res.sendStatus(201);
      res.status(200).json(rows[0]);
    }
  );
});

router.get("/members/:id_project", async (req, res) => {
  connection.query(
    `
    SELECT user.id_user, user.username
    FROM user_project 
    LEFT JOIN user ON user_project.id_user = user.id_user 
    LEFT JOIN project ON user_project.id_project = project.id_project 
    WHERE project.id_project = ?`,
    [req.params.id_project],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err });
      res.status(200).json(rows);
    }
  );
});

const supervisorCheck = (req, res, next) => {
  connection.query(
    `
    SELECT project.id_project FROM project LEFT JOIN user ON user.id_user = project.id_supervisor WHERE project.id_project = ? AND user.login_token = ?
    `,
    [req.params.id_project, req.headers.account_token],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length > 0) next();
      else res.status(401).json({ error: "Unauthorized access" });
    }
  );
};

router.put("/:id_project", supervisorCheck, async (req, res) => {
  const content = req.body;
  if (
    !content.nama_project ||
    !content.id_supervisor ||
    !content.id_instansi ||
    !content.status
  )
    return res.status(500).json({ error: "Missing one or more parameters" });

  connection.query(
    `UPDATE project SET 
    nama_project = ?, 
    nama_client = ?, 
    deskripsi = ?, 
    status = ?, 
    id_instansi = ?, 
    tanggal_mulai = ?, 
    tanggal_selesai = ? 
    WHERE id_project = ?;`,
    [
      content.nama_project,
      content.nama_client ?? "",
      content.deskripsi ?? "",
      content.status,
      content.id_instansi,
      content.tanggal_mulai,
      content.tanggal_selesai,
      req.params.id_project,
    ],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.put("/members/:id_project", supervisorCheck, async (req, res) => {
  if (!req.body.members)
    return res.status(400).json({ error: "Missing members parameter" });

  connection.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: err });

    // Removes all members from project
    connection.query(
      `DELETE FROM user_project WHERE id_project = ?`,
      [req.params.id_project],
      (err, rows, fields) => {
        if (err)
          return connection.rollback(() =>
            res.status(500).json({ error: err })
          );

        // Inserts new members for project
        let memberInsert = req.body.members.map((m) => [
          req.params.id_project,
          m,
        ]);
        connection.query(
          `INSERT INTO user_project(id_project, id_user) VALUES ?`,
          [memberInsert],
          (err, rows, fields) => {
            if (err)
              return connection.rollback(() =>
                res.status(500).json({ error: err })
              );

            connection.commit((err) => {
              if (err) return res.status(500).json({ error: err });
              res.status(200).json({ success: true });
            });
          }
        );
      }
    );
  });
});

router.delete("/:id_project", projectOwnerVerify, async (req, res) => {
  connection.query(
    `DELETE FROM project WHERE id_project = ${req.params.id_project};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err });
      res.status(200).json({ success: true });
    }
  );
});

// Project roles functions
router.get("/roles/:id_project", async (req, res) => {
  connection.query(
    `
    SELECT * FROM project_role WHERE id_project = ? AND active = TRUE
    `,
    [req.params.id_project],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.post("/roles/:id_project", async (req, res) => {
  if (!req.body.nama_role)
    return res.status(400).json({ error: "Missing nama_role parameter" });
  connection.query(
    `INSERT INTO project_role(nama_role, id_project) VALUES(?, ?);`,
    [req.params.id_project, req.body.nama_role],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.delete("/roles/:id_project_role", async (req, res) => {
  // Performs check to ensure no more users have that role
  connection.query(
    `
    SELECT COUNT(project_user_role.id_user) AS user_count FROM project_role 
    LEFT JOIN project_user_role ON project_user_role.id_project_role = ? WHERE project_role.id_project_role = ?
    `,
    [req.params.id_project_role, req.params.id_project_role],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows[0].user_count > 0)
        return res
          .status(400)
          .json({ error: "Cannot delete role with users assigned" });

      // Deletes the role
      connection.query(
        `DELETE FROM project_role WHERE id_project_role = ?`,
        [req.params.id_project_role],
        (err, rows, fields) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(200).json({ success: true });
        }
      );
    }
  );
});

router.put("/roles/assign/:id_project_role", async (req, res) => {
  const content = req.body;
  if (!content.members || content.members.length === 0)
    return res.status(400).json({ error: "Members parameter cannot be empty" });

  connection.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: err.message });

    // Removes all previous members with this role
    connection.query(
      `
      DELETE FROM project_user_role WHERE id_project = ?
      `,
      [req.params.id_project_role],
      (err, rows, fields) => {
        if (err) return res.status(500).json({ error: err.message });

        // Inserts new members
        let newMembers = [];
        content.members.forEach((m) => {
          newMembers.add([req.params.id_project_role, m]);
        });
        connection.query(
          `INSERT INTO project_user_role(id_project_role, id_user) VALUES ?`,
          [newMembers],
          (err, rows, fields) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(200).json({ success: true });
          }
        );
      }
    );
  });
});

module.exports = router;
