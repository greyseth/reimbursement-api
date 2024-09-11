const express = require("express");
const router = express.Router();

const projectOwnerVerify = require("../middlewares/projectOwnerVerify");
const supervisorVerify = require("../middlewares/supervisorVerify");

const connection = require("../db");

router.post("/assignmember", projectOwnerVerify, async (req, res) => {
  const content = req.body;
  if (!content.project_id || !content.members)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });
  if (content.members.length <= 0)
    return res.status(400).json({ error: "Members cannot be an empty array" });

  let query = "INSERT INTO user_project (id_user, id_project) VALUES ";
  content.members.forEach((memberID, index) => {
    query += `(${memberID}, ${content.project_id})`;
    if (index === content.members.length - 1) query += ";";
    else query += ",";
  });

  connection.query(query, (err, rows, fields) => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(200);
  });
});

router.post("/removemember", projectOwnerVerify, async (req, res) => {
  const content = req.body;
  if (!content.project_id || !content.user_id)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `DELETE FROM user_project WHERE id_project = ${content.project_id} AND id_user = ${content.user_id};`,
    (err, rows, fields) => {
      if (err) return res.status(400).json({ error: err.message });
      res.sendStatus(200);
    }
  );
});

router.post("/create", supervisorVerify, async (req, res) => {
  const content = req.body;
  if (
    !content.nama_project ||
    !content.nama_client ||
    !content.departemen ||
    !content.nomor_po ||
    !content.deskripsi ||
    !content.id_supervisor
  )
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });
  connection.query(
    `INSERT INTO project(nama_project, nama_client, departemen, nomor_po, deskripsi, id_supervisor) VALUES ('${content.nama_project}', '${content.nama_client}', '${content.departemen}', ${content.nomor_po}, '${content.deskripsi}', ${content.id_supervisor})`,
    (err, rows, fields) => {
      if (err) return res.status(400).json({ error: err.message });
      res.status(200).json({ id_project: rows.insertId });
    }
  );
});

router.get("/:user_id", async (req, res) => {
  connection.query(
    `SELECT project.* FROM user_project LEFT JOIN project ON user_project.id_project = project.id_project LEFT JOIN user ON user_project.id_user = user.id_user WHERE user.id_user = ${req.params.user_id} GROUP BY project.id_project;`,
    (err, rows, fields) => {
      if (err) res.status(500).json({ error: err.message });
      return res.status(200).json(rows);
    }
  );
});

module.exports = router;
