const express = require("express");
const router = express.Router();

const encryptUtil = require("../encryptUtil");
const adminVerify = require("../middlewares/adminVerify");
const connection = require("../db");

router.get("/all", adminVerify, async (req, res) => {
  connection.query(
    `SELECT user.id_user, user.username, user.role FROM user LEFT JOIN instansi ON user.id_instansi = instansi.id_instansi GROUP BY user.id_user;`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      else return res.status(200).json(rows);
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
    `SELECT * FROM user WHERE email = '${content.email}';`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length > 0) {
        encryptUtil.comparePassword(
          content.password,
          rows[0].password,
          (err, isPasswordMatch) => {
            if (err) return res.status(500).json({ error: err });
            else {
              const returnData = !isPasswordMatch
                ? { success: false }
                : { success: true, userData: rows[0] };

              return res.status(200).json(returnData);
            }
          }
        );
      }
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

router.get("/:user_id", async (req, res) => {
  connection.query(
    `SELECT user.username, user.email, user.no_telp, user.tanggal_lahir, user.role, user.rekening, user_gambar.nama_file AS picture FROM user LEFT JOIN user_gambar ON user.id_user = user_gambar.id_user WHERE user.id_user = ${req.params.user_id}`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1) return res.sendStatus(201);
      res.status(200).json(rows[0]);
    }
  );
});

// Admin user management routes
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
