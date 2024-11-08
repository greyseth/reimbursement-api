const express = require("express");
const router = express.Router();

const encryptUtil = require("../encryptUtil");
const adminVerify = require("../middlewares/adminVerify");
const connection = require("../db");

router.get("/userlist", async (req, res) => {
  connection.query(
    `SELECT id_user, username FROM user;`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.post("/login", async (req, res) => {
  const content = req.body;
  if (!content.email || !content.password)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `SELECT id_user, username, role, email, no_telp, tanggal_lahir, password, login_token FROM user WHERE email = ?;`,
    [content.email],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length > 0) {
        encryptUtil.comparePassword(
          content.password,
          rows[0].password,
          (err, isPasswordMatch) => {
            if (err) return res.status(500).json({ error: err.message });
            else {
              const returnData = !isPasswordMatch
                ? { success: false }
                : { success: true, userData: rows[0] };

              if (isPasswordMatch) delete returnData.userData.password;
              return res.status(200).json(returnData);
            }
          }
        );
      }
    }
  );
});

router.post("/adminlogin", async (req, res) => {
  const content = req.body;
  if (!content.email || !content.password)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `SELECT id_user, username, role, email, no_telp, tanggal_lahir, password, login_token FROM user WHERE email = ? AND role = 'admin';`,
    [content.email],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length > 0) {
        encryptUtil.comparePassword(
          content.password,
          rows[0].password,
          (err, isPasswordMatch) => {
            if (err) return res.status(500).json({ error: err.message });
            else {
              const returnData = !isPasswordMatch
                ? { success: false }
                : { success: true, userData: rows[0] };

              if (isPasswordMatch) delete returnData.userData.password;
              return res.status(200).json(returnData);
            }
          }
        );
      }
    }
  );
});

router.post("/cookielogin", async (req, res) => {
  const content = req.body;
  if (!content.id_user || !content.login_token)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `SELECT id_user, username, role, email, no_telp, tanggal_lahir FROM user WHERE id_user = ? AND login_token = ?;`,
    [content.id_user, content.login_token],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1) return res.status(401).json({ success: false });
      res.status(200).json({ success: true, userData: rows[0] });
    }
  );
});

router.post("/admincookielogin", async (req, res) => {
  const content = req.body;
  if (!content.id_user || !content.login_token)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `SELECT id_user, username, role, email, no_telp, tanggal_lahir FROM user WHERE id_user = ? AND login_token = ? AND role = 'admin';`,
    [content.id_user, content.login_token],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1) return res.status(401).json({ success: false });
      res.status(200).json({ success: true, userData: rows[0] });
    }
  );
});

router.post("/register", adminVerify, async (req, res) => {
  const content = req.body;
  if (
    !content.username ||
    !content.email ||
    !content.password ||
    !content.no_telp ||
    !content.tanggal_lahir ||
    !content.rekening ||
    !content.role ||
    !content.id_departemen
  )
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  encryptUtil.encryptPassword(content.password, (err, hash) => {
    if (err) return res.status(500).json({ error: "Couldnt hash password" });
    connection.query(
      `
       INSERT INTO user(username, password, email, no_telp, tanggal_lahir, role, login_token, rekening, id_departemen) 
       VALUES(?, ?, ?, ?, ?, ?, UUID(), ?, ?);
      `,
      [
        content.username,
        hash,
        content.email,
        content.no_telp,
        content.tanggal_lahir,
        content.role,
        content.rekening,
        content.id_departemen,
      ],
      (err, rows, fields) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ success: true });
      }
    );
  });
});

router.get("/:id_user", async (req, res) => {
  // Gets user details
  connection.query(
    `SELECT * FROM user WHERE id_user = ?`,
    [req.params.id_user],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });

      let userData = rows[0];
      delete userData.password;
      delete userData.login_token;

      // Gets projects included
      connection.query(
        `
          SELECT project.nama_project, project.id_supervisor 
          FROM user_project 
          LEFT JOIN project ON user_project.id_project = project.id_project 
          WHERE user_project.id_user = ?
        `,
        [req.params.id_user],
        (err, rows, fields) => {
          if (err) return res.status(500).json({ error: err.message });

          let projects = rows;
          projects = projects.map((p) => {
            return {
              nama_project: p.nama_project,
              role:
                p.id_supervisor == req.params.id_user
                  ? "Project Manager"
                  : "Member",
            };
          });

          // Gets departments being led
          connection.query(
            `
              SELECT nama_departemen FROM departemen WHERE id_leader = ?
            `,
            [req.params.id_user],
            (err, rows, fields) => {
              if (err) return res.status(500).json({ error: err.message });

              let departments = rows;

              res.status(200).json({
                userData: userData,
                projects: projects,
                departments: departments,
              });
            }
          );
        }
      );
    }
  );
});

module.exports = router;
