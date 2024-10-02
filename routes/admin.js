const express = require("express");
const connection = require("../db");
const router = express.Router();

const adminVerify = (req, res, next) => {
  connection.query(
    `SELECT id_user, role FROM user WHERE login_token = ?`,
    [req.headers.account_token],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Invalid user token" });

      if (rows[0].role === "admin") next();
      else res.status(401).json({ error: "Unauthorized access" });
    }
  );
};

router.get("/userlist", adminVerify, async (req, res) => {
  connection.query(`SELECT * FROM user;`, (err, rows, fields) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
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
    !content.role
  )
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  encryptUtil.encryptPassword(content.password, (err, hash) => {
    if (err) return res.status(500).json({ error: "Couldnt hash password" });
    connection.query(
      `INSERT INTO user(username, email, password, role, no_telp, tanggal_lahir, login_token, id_instansi, rekening) 
        VALUES('${content.username}', '${content.email}', '${hash}', '${content.role}', '${content.no_telp}', '${content.tanggal_lahir}', UUID(), ${res.locals.instansi}, '${content.rekening}')`,
      (err, rows, fields) => {
        if (err) return res.status(500).json({ error: err.message });

        const insertedId = rows.insertId;
        connection.query(
          `SELECT login_token FROM user WHERE id_user = ${insertedId}`,
          (err, rows, fields) => {
            if (err) return res.status(500).json({ error: err.message });
            return res
              .status(200)
              .json({ user_id: insertedId, login_token: rows[0].login_token });
          }
        );
      }
    );
  });
});

router.put("/:user_id", adminVerify, async (req, res) => {
  const content = req.body;
  if (
    !content.username ||
    !content.email ||
    !content.no_telp ||
    !content.tanggal_lahir ||
    !content.role ||
    !content.rekening
  )
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `UPDATE user SET username = '${content.username}', email = '${content.email}', 
      no_telp = '${content.no_telp}', tanggal_lahir = '${content.tanggal_lahir}', role = '${content.role}', rekening = '${content.rekening}' 
      WHERE id_user = ${req.params.user_id};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.sendStatus(200);
    }
  );
});

router.delete("/:user_id", adminVerify, async (req, res) => {
  connection.query(
    `DELETE FROM user WHERE id_user = ${req.params.user_id};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.sendStatus(200);
    }
  );
});

module.exports = router;
