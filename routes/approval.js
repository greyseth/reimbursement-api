const express = require("express");
const multer = require("multer");
const { check } = require("express-validator");
const router = express.Router();

const connection = require("../db");
const userVerify = require("../middlewares/userVerify");
const { sendEmail } = require("../emailUtil");
const roleCheck = require("../middlewares/roleCheck");

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

router.post("/:request_id", roleCheck, async (req, res) => {
  if (res.locals.role === "staff" || res.locals.role === "admin")
    return res.status(401).json({ error: "Unauthorized access" });

  uploadArray(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    const content = req.body;
    // Optional fields: catatan, diterima, images in req.files

    connection.beginTransaction((err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Request to create approval
      connection.query(
        `
        INSERT INTO approval(id_request, catatan, tanggal_approval, diterima, id_approver, type, version) 
        VALUES (?, ?, NOW(), ?, ?, ?, (SELECT current_version FROM request WHERE request.id_request = ?));
        `,
        [
          req.params.request_id,
          content.catatan ?? "",
          content.diterima === "true" ? true : false,
          res.locals.id_user,
          res.locals.role,
          req.params.request_id,
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

              // Selects newly inserted data for sending email
              connection.query(
                `
                SELECT
                request.id_request, request.judul, request.deskripsi, request.metode_pembayaran,
                project.nama_project, departemen.nama_departemen, instansi.nama AS nama_instansi,
                owner.username AS owner_username, owner.rekening AS owner_rekening, owner.email AS owner_email, 
                s_app.diterima AS s_app_diterima, s_app.catatan AS s_app_catatan, s_app.tanggal_approval AS s_app_tanggal,
                s_app_approver.username AS s_app_username,
                f_app.diterima AS f_app_diterima, f_app.catatan AS f_app_catatan, f_app.tanggal_approval AS f_app_tanggal,
                f_app_approver.username AS f_app_username,
                r_app.diterima AS r_app_diterima, r_app.catatan AS r_app_catatan, r_app.tanggal_approval AS r_app_tanggal,
                r_app_approver.username AS r_app_username
                FROM request
                LEFT JOIN user owner ON request.id_user = owner.id_user
                LEFT JOIN project ON project.id_project = request.id_project
                LEFT JOIN departemen ON owner.id_departemen = departemen.id_departemen
                LEFT JOIN instansi ON instansi.id_instansi = request.id_instansi OR instansi.id_instansi = project.id_instansi 
                LEFT JOIN approval s_app ON request.id_request = s_app.id_request AND s_app.version = request.current_version AND s_app.type = 'supervisor'
                LEFT JOIN user s_app_approver ON s_app.id_approver = s_app_approver.id_user
                LEFT JOIN approval f_app ON request.id_request = f_app.id_request AND f_app.version = request.current_version AND f_app.type = 'finance'
                LEFT JOIN user f_app_approver ON f_app.id_approver = f_app_approver.id_user
                LEFT JOIN approval r_app ON request.id_request = r_app.id_request AND r_app.version = request.current_version AND r_app.type = 'realisasi'
                LEFT JOIN user r_app_approver ON r_app.id_approver = r_app_approver.id_user
                WHERE request.id_request = ?
                GROUP BY request.id_request;
                `,
                [req.params.request_id],
                (err, rows, fields) => {
                  if (err)
                    return connection.rollback(() =>
                      res.status(500).json({ error: err.message })
                    );

                  if (rows.length < 1)
                    return connection.rollback(() =>
                      res.status(500).json({
                        error:
                          "Failed to find request with id " +
                          req.params.request_id,
                      })
                    );

                  const reqData = rows[0];
                  let emailData = {};

                  emailData.requestAcceptance =
                    content.diterima === "true" ? "DITERIMA" : "DITOLAK";

                  emailData.judul = reqData.judul;
                  emailData.deskripsi = reqData.deskripsi;
                  emailData.metode_pembayaran = reqData.metode_pembayaran;
                  emailData.jenis_request = reqData.nama_project
                    ? "Project Based"
                    : "Operasional";
                  emailData.nama_project = reqData.nama_project ?? "-";
                  emailData.nama_departemen = reqData.nama_project
                    ? "-"
                    : reqData.nama_departemen;
                  emailData.nama_instansi = reqData.nama_instansi;
                  emailData.username = reqData.owner_username;
                  emailData.rekening = reqData.owner_rekening;

                  emailData.supervisor_hide =
                    reqData.s_app_diterima === null ||
                    reqData.s_app_diterima === undefined
                      ? "class='hidden'"
                      : "";
                  emailData.supervisor_catatan = reqData.s_app_catatan;
                  emailData.supervisor_date = reqData.s_app_tanggal;
                  emailData.supervisor_approval = reqData.s_app_diterima
                    ? "Disetujui"
                    : "Ditolak";
                  emailData.supervisor_name = reqData.s_app_username;

                  emailData.finance_hide =
                    reqData.f_app_diterima === null ||
                    reqData.f_app_diterima === undefined
                      ? "class='hidden'"
                      : "";
                  emailData.finance_catatan = reqData.f_app_catatan;
                  emailData.finance_date = reqData.f_app_tanggal;
                  emailData.finance_approval = reqData.f_app_diterima
                    ? "Disetujui"
                    : "Ditolak";
                  emailData.finance_name = reqData.f_app_username;

                  emailData.realisasi_hide =
                    reqData.r_app_diterima === null ||
                    reqData.r_app_diterima === undefined
                      ? "class='hidden'"
                      : "";
                  emailData.realisasi_catatan = reqData.r_app_catatan;
                  emailData.realisasi_date = reqData.r_app_tanggal;
                  emailData.realisasi_approval = reqData.r_app_diterima
                    ? "Disetujui"
                    : "Ditolak";
                  emailData.realisasi_name = reqData.r_app_username;

                  // TODO: Uncomment to send emails again after every approval
                  // sendEmail(reqData.owner_email, emailData, (err, info) => {
                  //   if (err)
                  //     return connection.rollback(() =>
                  //       res.status(500).json({ error: err })
                  //     );
                  //   connection.commit((err) => {
                  //     if (err)
                  //       return connection.rollback(() =>
                  //         res.status(500).json({ error: err.message })
                  //       );
                  //     res.status(200).json({ success: true });
                  //   });
                  // });
                  connection.commit((err) => {
                    if (err)
                      return connection.rollback(() =>
                        res.status(500).json({ error: err.message })
                      );
                    res.status(200).json({ success: true });
                  });
                }
              );
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

const listCheck = (req, res, next) => {
  connection.query(
    `SELECT id_user, role FROM user WHERE login_token = ?`,
    [req.headers.account_token],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Invalid account token" });

      res.locals.id_user = rows[0].id_user;
      res.locals.role = rows[0].role;
      next();
    }
  );
};
router.get(
  "/list",
  [
    listCheck,
    check("search").trim().escape(),
    check("id_project").isNumeric().trim().escape(),
    check("id_instansi").isNumeric().trim().escape(),
    check("afterDays").isNumeric().trim().escape(),
  ],
  async (req, res) => {
    const content = req.query;
    //Optional params = search, id_project, id_instansi, id_departemen, afterDays

    // Should return either {projectManager: [], departmentLeader: []}, {finance: []}, or {realisasi: {}}

    const listFilters = `${
      content.search
        ? " AND LOWER(request.judul) LIKE LOWER('%" + content.search + "%')"
        : ""
    } ${
      content.id_project
        ? " AND request.id_project = " + content.id_project
        : ""
    } ${
      content.id_departemen
        ? " AND user.id_departemen = " + content.id_departemen
        : ""
    } ${
      content.id_instansi
        ? " AND request.id_instansi = " + content.id_instansi
        : ""
    }
    ${
      content.afterDays
        ? " AND request.tanggal_request > DATE_SUB(CURDATE(), INTERVAL " +
          content.afterDays +
          " DAY)"
        : ""
    }`;

    if (res.locals.role === "staff") {
      // Gets requests from all projects and departments
      connection.query(
        `
      SELECT 
      request.id_request, request.judul, request.tanggal_request, SUM(barang.harga) AS total_harga, 
      project.nama_project, departemen.nama_departemen, instansi.nama AS nama_instansi,
      s_approval.diterima AS supervisor_diterima,
      f_approval.diterima AS finance_diterima, 
      r_approval.diterima AS realisasi_diterima 
      FROM request 
      LEFT JOIN barang ON request.id_request = barang.id_request AND barang.version = request.current_version
      LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.diterima IS NOT NULL AND s_approval.version = request.current_version
      LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.diterima IS NOT NULL AND f_approval.version = request.current_version
      LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.diterima IS NOT NULL AND r_approval.version = request.current_version
      LEFT JOIN project ON request.id_project = project.id_project 
      LEFT JOIN user ON request.id_user = user.id_user 
      LEFT JOIN departemen ON user.id_departemen = departemen.id_departemen
      LEFT JOIN instansi ON request.id_instansi = instansi.id_instansi 
      WHERE (project.id_supervisor = ? OR departemen.id_leader = ?) AND f_approval.diterima IS NULL AND r_approval.diterima IS NULL 
      ${listFilters}
      GROUP BY request.id_request;
      `,
        [res.locals.id_user, res.locals.id_user],
        (err, rows, fields) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(200).json(rows);
        }
      );
    } else if (res.locals.role === "finance") {
      // Get all requests that have been approved by a supervisor
      connection.query(
        `
      SELECT 
      request.id_request, request.judul, request.tanggal_request, SUM(barang.harga) AS jumlah, 
      s_approval.diterima AS supervisor_diterima,
      f_approval.diterima AS finance_diterima, 
      r_approval.diterima AS realisasi_diterima 
      FROM request 
      LEFT JOIN barang ON request.id_request = barang.id_request AND barang.version = request.current_version
      LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.diterima IS NOT NULL AND s_approval.version = request.current_version
      LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.diterima IS NOT NULL AND f_approval.version = request.current_version
      LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.diterima IS NOT NULL AND r_approval.version = request.current_version
      LEFT JOIN project ON request.id_project = project.id_project 
      LEFT JOIN user ON request.id_user = user.id_user 
      LEFT JOIN departemen ON user.id_departemen = departemen.id_departemen
      WHERE s_approval.diterima = TRUE AND r_approval.diterima IS NULL
      ${listFilters}
      GROUP BY request.id_request;
      `,
        // [],
        (err, rows, fields) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(200).json(rows);
        }
      );
    } else if (res.locals.role === "realisasi") {
      // Get all requests that have been approved by a finance manager
      connection.query(
        `
      SELECT 
      request.id_request, request.judul, request.tanggal_request, SUM(barang.harga) AS jumlah, 
      s_approval.diterima AS supervisor_diterima,
      f_approval.diterima AS finance_diterima, 
      r_approval.diterima AS realisasi_diterima 
      FROM request 
      LEFT JOIN barang ON request.id_request = barang.id_request AND barang.version = request.current_version
      LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.diterima IS NOT NULL AND s_approval.version = request.current_version
      LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.diterima IS NOT NULL AND f_approval.version = request.current_version
      LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.diterima IS NOT NULL AND r_approval.version = request.current_version
      LEFT JOIN project ON request.id_project = project.id_project 
      LEFT JOIN user ON request.id_user = user.id_user 
      LEFT JOIN departemen ON user.id_departemen = departemen.id_departemen
      WHERE s_approval.diterima = TRUE AND s_approval.diterima = TRUE AND f_approval.diterima = TRUE 
      ${listFilters}
      GROUP BY request.id_request;
      `,
        // [],
        (err, rows, fields) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(200).json(rows);
        }
      );
    }
  }
);

module.exports = router;
