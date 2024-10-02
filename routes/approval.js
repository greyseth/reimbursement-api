const express = require("express");
const multer = require("multer");
const router = express.Router();

const connection = require("../db");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_approvalimg_" + file.originalname);
  },
});

const upload = multer({ storage: storage });
const uploadArray = upload.array("images");

const roleCheck = (req, res, next) => {
  connection.query(
    `
    SELECT user.id_user, user.role, request.id_project, project.id_supervisor, departemen.id_leader 
    FROM user 
    LEFT JOIN request ON request.id_request = ? 
    LEFT JOIN project ON project.id_project = request.id_project 
    LEFT JOIN user owner ON owner.id_user = request.id_user 
    LEFT JOIN departemen ON departemen.id_departemen = owner.id_departemen
    WHERE user.login_token = ? GROUP BY user.id_user;`,
    [req.params.id_request, req.headers.account_token],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Invalid account token" });

      const check = rows[0];
      res.locals.role = check.role;
      res.locals.id_user = check.id_user;

      // Checks if user is finance or realisasi
      if (check.role === "finance" || check.role === "realisasi") return next();

      // Checks if request is project based
      if (check.id_project) {
        if (check.id_user === check.id_supervisor) {
          res.locals.role = "supervisor";
          next();
        } else return res.status(401).json({ error: "Unauthorized access" });
      } else {
        if (check.id_user === check.id_leader) {
          res.locals.role = "supervisor";
          next();
        } else return res.status(401).json({ error: "Unauthorized access" });
      }
    }
  );
};
router.post("/:id_request", roleCheck, async (req, res) => {
  const content = req.body;
  // Optional fields: catatan, diterima, images in req.files

  uploadArray(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    connection.beginTransaction((err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Request to create approval
      connection.query(
        `INSERT INTO approval(id_request, catatan, tanggal_approval, diterima, id_approver, type) VALUES (?, ?, NOW(), ?, ?, ?)`,
        [
          req.params.id_request,
          content.catatan ?? "",
          content.diterima ? 1 : 0,
          res.locals.id_user,
          res.locals.role,
        ],
        (err, rows, fields) => {
          if (err)
            return connection.rollback(() =>
              res.status(500).json({ error: err.message })
            );
          const insertId = rows.insertId;

          //Inserts images
          let images = [];
          if (req.files)
            req.files.forEach((f) => {
              images.push([insertId, f.filename]);
            });
          connection.query(
            images.length > 0
              ? "INSERT INTO approval_gambar(id_approval, nama_file) VALUES ?"
              : "SELECT NULL",
            [images],
            (err, rows, fields) => {
              if (err)
                return connection.rollback(() =>
                  res.status(500).json({ error: err.message })
                );
              connection.commit((err) => {
                if (err)
                  connection.rollback(() =>
                    res.status(500).json({ error: err.message })
                  );
                res.status(200).json({ success: true });
              });
            }
          );
        }
      );
    });
  });
});

router.get("/images/:approval_id", async (req, res) => {
  connection.query(
    `SELECT * FROM approval_gambar WHERE id_approval = ${req.params.approval_id};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

module.exports = router;
