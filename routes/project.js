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
      '${content.name}', '${content.client ?? ""}', '${
        content.deskripsi ?? ""
      }', ${content.supervisor_id}, ${
        content.company_id
      }, 'berjalan', NOW(), NOW(), ${res.locals.id_user}, '${
        content.tanggal_mulai ?? ""
      }', '${content.tanggal_selesai ?? ""}');`,
      (err, rows, fields) => {
        if (err) {
          connection.rollback(() => {
            res.status(500).json({ error: err });
          });
          return;
        }

        const projectId = rows.insertId;

        if (content.members && content.members.length > 0) {
          let membersQuery = "";
          content.members.forEach((m, i) => {
            membersQuery += `(${rows.insertId}, ${m})${
              i === content.members.length - 1 ? ";" : ","
            }`;
          });

          connection.query(
            `INSERT INTO user_project(id_project, id_user) VALUES ${membersQuery}`,
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

// Gets collapsed project data from a single user
router.get("/own", userVerify, async (req, res) => {
  connection.query(
    `SELECT project.id_project, project.nama_project, project.status
    FROM user_project LEFT JOIN project ON user_project.id_project = project.id_project 
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
    `SELECT user.id_user, user.username FROM user_project LEFT JOIN user ON user_project.id_user = user.id_user LEFT JOIN project ON user_project.id_project = project.id_project WHERE project.id_project = ${req.params.id_project};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err });
      res.status(200).json(rows);
    }
  );
});

router.put("/:id_project", async (req, res) => {
  const content = req.body;
  if (
    !content.nama_project ||
    !content.id_supervisor ||
    !content.id_instansi ||
    !content.status
  )
    return res.status(500).json({ error: "Missing one or more parameters" });

  connection.query(
    `UPDATE project SET nama_project = '${
      content.nama_project
    }', nama_client = '${content.nama_client ?? ""}', 
    deskripsi = '${content.deskripsi ?? ""}', status = '${
      content.status
    }', id_instansi = ${content.id_instansi}, 
    tanggal_mulai = '${content.tanggal_mulai ?? ""}', tanggal_selesai = '${
      content.tanggal_selesai ?? ""
    }' WHERE id_project = ${req.params.id_project};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.delete("/:id_project", projectOwnerVerify, async (req, res) => {
  console.log(req.params.id_project);
  connection.query(
    `DELETE FROM project WHERE id_project = ${req.params.id_project};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err });
      res.status(200).json({ success: true });
    }
  );
});

module.exports = router;
