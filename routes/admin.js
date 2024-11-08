const express = require("express");
const connection = require("../db");
const { encryptPassword } = require("../encryptUtil");
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

router.post("/login", async (req, res) => {
  const content = req.body;
  if (!content.email || !content.password)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `SELECT id_user, username, email, no_telp, tanggal_lahir, password, login_token FROM user WHERE email = ? AND role = 'admin';`,
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

  setTimeout(() => {
    connection.query(
      `SELECT id_user, username, email, no_telp, tanggal_lahir FROM user WHERE id_user = ? AND login_token = ? AND role = 'admin';`,
      [content.id_user, content.login_token],
      (err, rows, fields) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length < 1) return res.status(401).json({ success: false });
        res.status(200).json({ success: true, userData: rows[0] });
      }
    );
  }, 2000);
});

router.get("/dash", async (req, res) => {
  connection.query(
    `
      SELECT
      (SELECT COUNT(id_user) FROM user) AS jumlah_karyawan,
      (SELECT COUNT(id_project) FROM project) AS jumlah_project,
      (SELECT COUNT(id_request) FROM request) AS jumlah_request,
      (SELECT COUNT(id_instansi) FROM instansi) AS jumlah_instansi
      FROM dual;
    `,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows[0]);
    }
  );
});

// User management actions
router.get("/userlist", adminVerify, async (req, res) => {
  connection.query(
    `SELECT user.*, departemen.nama_departemen FROM user LEFT JOIN departemen ON user.id_departemen = departemen.id_departemen;`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      let filteredRows = rows.map((r) => {
        let rCopy = r;
        delete r.password;
        delete r.login_token;
        return rCopy;
      });
      res.status(200).json(filteredRows);
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

// TODO: (Maybe) check user who is being modified is an admin?
router.put("/user/:id_user", adminVerify, async (req, res) => {
  const content = req.body;
  if (
    !content.username ||
    !content.email ||
    !content.no_telp ||
    !content.tanggal_lahir ||
    !content.role ||
    !content.id_departemen ||
    !content.rekening
  )
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  //Transaction for if I want to keep logs of every update
  // connection.beginTransaction((err) => {
  //   if (err) return res.status(500).json({error: err.message});

  //   // Updates data
  //   connection.query(
  //     `
  //       UPDATE user SET username = ?, email = ?, no_telp = ?, tanggal_lahir = ?, role = ?, id_departemen = ?, rekening = ?
  //       WHERE id_user = ?
  //     `,
  //     [content.username, content.email, content.no_telp, content.tanggal_lahir, content.role, content.id_departemen, content.rekening, req.params.id_user],
  //     (err, rows, fields) => {
  //       if (err) return connection.rollback(() => res.status(500).json({error: err.message}));

  //       // Creates row in logs
  //       connection.query(
  //         `
  //         `,
  //         [],
  //         (err, rows, fields) => {

  //         }
  //       )
  //     }
  //   )
  // })

  connection.query(
    `
        UPDATE user SET username = ?, email = ?, no_telp = ?, tanggal_lahir = ?, role = ?, id_departemen = ?, rekening = ?
        WHERE id_user = ?
      `,
    [
      content.username,
      content.email,
      content.no_telp,
      content.tanggal_lahir,
      content.role,
      content.id_departemen,
      content.rekening,
      req.params.id_user,
    ],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.put("/user/active/:id_user", adminVerify, async (req, res) => {
  connection.query(
    `UPDATE user SET active = !active WHERE id_user = ?`,
    [req.params.id_user],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.put("/user/password/:id_user", adminVerify, async (req, res) => {
  if (!req.body.newPassword)
    return res
      .status(400)
      .json({ error: "Missing required newPassword parameter" });

  encryptPassword(req.body.newPassword, (err, hash) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.query(
      `UPDATE user SET password = ? WHERE id_user = ?`,
      [hash, req.params.id_user],
      (err, rows, fields) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ success: true });
      }
    );
  });
});

// router.delete("/:user_id", adminVerify, async (req, res) => {
//   connection.query(
//     `DELETE FROM user WHERE id_user = ${req.params.user_id};`,
//     (err, rows, fields) => {
//       if (err) return res.status(500).json({ error: err.message });
//       res.sendStatus(200);
//     }
//   );
// });

// Instansi actions
router.post("/instansi", adminVerify, async (req, res) => {
  const content = req.body;
  if (!content.nama || !content.alamat)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `INSERT INTO instansi(nama, alamat) VALUES(?, ?)`,
    [content.nama, content.alamat],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.put("/instansi/:id_instansi", adminVerify, async (req, res) => {
  const content = req.body;
  if (!content.nama || !content.alamat)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `UPDATE instansi SET nama = ?, alamat = ? WHERE id_instansi = ?`,
    [content.nama, content.alamat, req.params.id_instansi],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.delete("/instansi/:id_instansi", adminVerify, async (req, res) => {
  connection.query(
    `DELETE FROM instansi WHERE id_instansi = ?`,
    [req.params.id_instansi],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

// Department actions
router.post("/departemen", adminVerify, async (req, res) => {
  const content = req.body;
  if (!content.nama_departemen || !content.id_leader)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `INSERT INTO departemen(nama_departemen, id_leader) VALUES(?, ?, ?)`,
    [content.nama_departemen, content.id_leader, content.id_instansi],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ id_instansi: rows.insertId });
    }
  );
});

router.put("/departemen/:id_departemen", adminVerify, async (req, res) => {
  const content = req.body;
  if (!content.nama_departemen || !content.id_leader)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `UPDATE departemen SET nama_departemen = ?, id_leader = ? WHERE id_departemen = ?`,
    [content.nama_departemen, content.id_leader, req.params.id_departemen],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.delete("/departemen/:id_departemen", adminVerify, async (req, res) => {
  connection.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: err.message });

    connection.query(
      `SELECT COUNT(id_user) AS user_count FROM user WHERE id_departemen = ?`,
      [req.params.id_departemen],
      (err, rows, fields) => {
        if (err)
          return connection.rollback(() =>
            res.status(500).json({ error: err.message })
          );
        if (rows.length < 1)
          return connection.rollback(() =>
            res.status(500).json({ error: "Invalid departemen id" })
          );
        if (rows[0] > 0)
          return connection.rollback(() =>
            res.status(400).json({
              error:
                "Department must not have any users left before being deleted",
            })
          );

        connection.query(
          `DELETE FROM departemen WHERE id_departemen = ?`,
          [req.params.id_departemen],
          (err, rows, fields) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(200).json({ success: true });
          }
        );
      }
    );
  });
});

router.get(
  "/departemen/userlist/:id_departemen/:position",
  adminVerify,
  async (req, res) => {
    if (
      req.params.position.toLowerCase() !== "in" &&
      req.params.position.toLowerCase() !== "out"
    )
      return res
        .status(400)
        .json({ error: "Parameter must be either 'in' or 'out'" });
    connection.query(
      `SELECT user.id_user, user.username, departemen.nama_departemen 
      FROM user
      LEFT JOIN departemen ON user.id_departemen = departemen.id_departemen
      WHERE departemen.id_departemen ${
        req.params.position === "in" ? "=" : "!="
      } ?`,
      [req.params.id_departemen],
      (err, rows, fields) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json(rows);
      }
    );
  }
);

router.put(
  "/departemen/addmembers/:id_departemen",
  adminVerify,
  async (req, res) => {
    if (!req.body.members || req.body.members.length <= 0)
      return res.status(400).json({ error: "Members not defined" });
    connection.query(
      `UPDATE user SET id_departemen = ? WHERE id_user IN (?)`,
      [req.params.id_departemen, req.body.members],
      (err, rows, fields) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ success: true });
      }
    );
  }
);

module.exports = router;
