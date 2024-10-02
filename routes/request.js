const express = require("express");
const router = express.Router();
const multer = require("multer");
const connection = require("../db");

const requestOwnerVerify = require("../middlewares/requestOwnerVerify");
const { createWorksheet } = require("../excelUtil");
const requestCreateVerify = require("../middlewares/requestCreateVerify");
const userVerify = require("../middlewares/userVerify");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_requestimg_" + file.originalname);
  },
});

const upload = multer({ storage: storage });
const arrayUpload = upload.array("images");

router.post("/add", requestCreateVerify, async (req, res) => {
  const content = req.body;
  if (
    !content.metode_pembayaran ||
    !content.judul ||
    !content.deskripsi ||
    !content.barang ||
    content.barang.length < 1
  )
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  arrayUpload(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    connection.beginTransaction((err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Inserts base request data
      connection.query(
        `
        INSERT INTO request(id_user, judul, deskripsi, metode_pembayaran, id_project, id_instansi, tanggal_request) 
        VALUES(${res.locals.id_user}, ?, ?, ?, ?, ?, NOW())
        `,
        [
          content.judul,
          content.deskripsi ?? "",
          content.metode_pembayaran,
          content.id_project,
          content.id_instansi ?? res.locals.id_instansi,
        ],
        (err, rows, fields) => {
          if (err)
            return connection.rollback(() =>
              res.status(500).json({ error: err.message })
            );

          let insertId = rows.insertId;

          // Inserts images
          let images = [];
          if (req.files)
            req.files.forEach((f) => {
              images.push([insertId, f.filename]);
            });
          connection.query(
            `INSERT INTO request_gambar(id_request, nama_file) VALUES ?`,
            [images],
            (err, rows, fields) => {
              if (err)
                return connection.rollback(() =>
                  res.status(500).json({ error: err.message })
                );

              // Query for items in request
              let barangQuery =
                "INSERT INTO barang(id_request, nama, jumlah, harga, tanggal_pembelian) VALUES ?";
              let barangItems = [];
              content.barang.forEach((b, i) => {
                barangItems.push([
                  insertId,
                  b.nama,
                  b.jumlah,
                  b.harga,
                  b.tanggal_pembelian,
                ]);
              });

              if (res.locals.isSupervisor || res.locals.isDepartmentLeader) {
                // Creates deafult approval if project manager or department leader
                let defaultApprovalQuery = "";

                if (res.locals.isSupervisor)
                  defaultApprovalQuery = `INSERT INTO approval(id_request, tanggal_approval, diterima, id_approver, type) 
              VALUES(${insertId}, NOW(), TRUE, ${res.locals.id_user}, 'supervisor');`;

                if (res.locals.isDepartmentLeader)
                  defaultApprovalQuery = `INSERT INTO approval(id_request, tanggal_approval, diterima, id_approver, type)
              VALUES(${insertId}, NOW(), TRUE, ${res.locals.id_user}, 'supervisor');`;

                connection.query(defaultApprovalQuery, (err, rows, fields) => {
                  if (err)
                    return connection.rollback(() =>
                      res.status(500).json({ error: err.message })
                    );

                  // Inserts items
                  connection.query(
                    barangQuery,
                    [barangItems],
                    (err, rows, fields) => {
                      if (err)
                        return connection.rollback(() =>
                          res.status(500).json({ error: err.message })
                        );

                      connection.commit((err) => {
                        if (err)
                          return res.status(500).json({ error: err.message });
                        res.status(200).json({ success: true });
                      });
                    }
                  );
                });
              }
              // Inserts items
              else
                connection.query(
                  barangQuery,
                  [barangItems],
                  (err, rows, fields) => {
                    if (err)
                      return connection.rollback(() =>
                        res.status(500).json({ error: err.message })
                      );

                    connection.commit((err) => {
                      if (err)
                        return res.status(500).json({ error: err.message });
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

router.put("/:id_request", requestOwnerVerify, async (req, res) => {
  const content = req.body;
  if (
    !content.judul ||
    !content.metode_pembayaran ||
    !content.barang ||
    content.barang.length < 1
  )
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  arrayUpload(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    connection.beginTransaction((err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Edit basic request data
      connection.query(
        `UPDATE request SET judul = ?, deskripsi = ?, metode_pembayaran = ? WHERE id_request = ?`,
        [
          content.judul,
          content.description ?? "",
          content.metode_pembayaran,
          req.params.id_request,
        ],
        (err, rows, fields) => {
          if (err)
            return connection.rollback(() =>
              res.status(500).json({ error: err.message })
            );
          if (rows.changedRows < 1)
            return connection.rollback(() =>
              res.status(500).json({
                error: "id_request of " + req.params.id_request + " not found",
              })
            );

          // Handles images
          let images = [];
          if (req.files)
            req.files.forEach((f) => {
              images.push([req.params.id_request, f.filename]);
            });
          //-Deletes previous images
          connection.query(
            `DELETE FROM request_gambar WHERE id_request = ?`,
            [req.params.id_request],
            async (err, rows, fields) => {
              if (err)
                return connection.rollback(() =>
                  res.status(500).json({ error: err.message })
                );

              //-Inserts new images
              connection.query(
                // (Replaces empty query. I know, I hate myself for coming up with this, too)
                images.length > 0
                  ? "INSERT INTO request_gambar(id_request, nama_file) VALUES ?"
                  : "SELECT NULL;",
                [images],
                (err, rows, fields) => {
                  if (err)
                    return connection.rollback(() =>
                      res.status(500).json({ ...err })
                    );

                  // Handles items
                  let items = [];
                  content.barang.forEach((b) => {
                    items.push([
                      req.params.id_request,
                      b.nama,
                      b.jumlah,
                      b.harga,
                      b.tanggal_pembelian,
                    ]);
                  });
                  //-Deletes previous items
                  connection.query(
                    `DELETE FROM barang WHERE id_request = ${req.params.id_request};`,
                    async (err, rows, fields) => {
                      if (err)
                        return connection.rollback(() =>
                          res
                            .status(500)
                            .json({ error: "barangdeletion " + err.message })
                        );

                      //-Inserts new items
                      connection.query(
                        `INSERT INTO barang(id_request, nama, jumlah, harga, tanggal_pembelian) VALUES ?`,
                        [items],
                        (err, rows, fields) => {
                          if (err)
                            return connection.rollback(() =>
                              res.status(500).json({ error: err.message })
                            );

                          connection.commit((err) => {
                            if (err)
                              return res
                                .status(500)
                                .json({ error: err.message });
                            res.status(200).json({ success: true });
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
});

router.get("/export/:request_id", async (req, res) => {
  try {
    const requestData = await getRequestData(req);
    const workbook = createWorksheet(requestData);
    workbook.write("Request-" + req.params.request_id + "-Export.xlsx", res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/own", userVerify, async (req, res) => {
  connection.query(
    `SELECT request.id_request, request.judul, request.tanggal_request, SUM(barang.harga) AS jumlah, 
    s_approval.diterima AS supervisor_diterima,
    f_approval.diterima AS finance_diterima, 
    r_approval.diterima AS realisasi_diterima 
    FROM request 
    LEFT JOIN barang ON request.id_request = barang.id_request 
    LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.diterima = TRUE 
    LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.diterima = TRUE 
    LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.diterima = TRUE 
    WHERE request.id_user = ${res.locals.id_user} GROUP BY request.id_request;`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/project/:id_project", userVerify, async (req, res) => {
  connection.query(
    `SELECT request.id_request, request.judul, request.tanggal_request, SUM(barang.harga) AS jumlah, 
    s_approval.diterima AS supervisor_diterima,
    f_approval.diterima AS finance_diterima, 
    r_approval.diterima AS realisasi_diterima 
    FROM request 
    LEFT JOIN barang ON request.id_request = barang.id_request 
    LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.diterima = TRUE 
    LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.diterima = TRUE 
    LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.diterima = TRUE 
    WHERE request.id_project = ${req.params.id_project} GROUP BY request.id_request;
    `,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/department/:id_department", userVerify, async (req, res) => {
  connection.query(
    `SELECT request.id_request, request.judul, request.tanggal_request, SUM(barang.harga) AS jumlah, 
    s_approval.diterima AS supervisor_diterima,
    f_approval.diterima AS finance_diterima, 
    r_approval.diterima AS realisasi_diterima 
    FROM request 
    LEFT JOIN barang ON request.id_request = barang.id_request 
    LEFT JOIN user owner ON request.id_user = owner.id_user 
    LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.diterima = TRUE 
    LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.diterima = TRUE 
    LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.diterima = TRUE 
    WHERE request.id_project IS NULL AND owner.id_departemen = ${req.params.id_department} GROUP BY request.id_request;
    `,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.delete("/:request_id", requestOwnerVerify, async (req, res) => {
  connection.query(
    `DELETE FROM request WHERE id_request = ${req.params.request_id}`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.sendStatus(200);
    }
  );
});

router.get("/:request_id", async (req, res) => {
  try {
    const data = await getRequestData(req);

    // Creates a more digestible response format
    let requestDetails = {};
    let instansi = undefined;
    let departemen = {};
    let project = undefined;
    let requestOwner = {};
    let supervisorApproval = undefined;
    let financeApproval = undefined;
    let images = data.images;
    let items = data.items;

    requestDetails.id_request = data.id_request;
    requestDetails.judul = data.judul;
    requestDetails.deskripsi = data.deskripsi;
    requestDetails.tanggal_request = data.tanggal_request;

    if (data.instansi_nama) {
      instansi = {};
      instansi.nama = data.instansi_nama;
      instansi.alamat = instansi.instansi_alamat;
    }

    departemen.nama = data.departemen_nama;
    departemen.leader = data.departemen_username;
    if (data.project_id) {
      project = {};
      project.id_project = data.project_id;
      project.nama = data.project_nama;
      project.client = data.project_client;
      project.supervisor = data.project_username;
    }

    requestOwner.id_user = data.id_user;
    requestOwner.nama = data.owner_username;
    requestOwner.rekening = data.owner_rekening;

    if (data.s_app_diterima !== null) {
      supervisorApproval = {};
      supervisorApproval.diterima = data.s_app_diterima;
      supervisorApproval.catatan = data.s_app_catatan;
      supervisorApproval.approver = data.s_app_username;
      supervisorApproval.tanggal_approval = data.s_app_tanggal_approval;
    }

    if (data.f_app_diterima !== null) {
      financeApproval = {};
      financeApproval.diterima = data.f_app_diterima;
      financeApproval.catatan = data.f_app_diterima;
      financeApproval.approver = data.f_app_username;
      financeApproval.tanggal_approval = data.f_app_tanggal_approval;
    }

    res.status(200).json({
      details: requestDetails,
      owner: requestOwner,
      instansi: instansi,
      departemen: departemen,
      project: project,
      approval: {
        supervisor: supervisorApproval,
        finance: financeApproval,
      },
      images: images,
      items: items,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function getRequestData(req) {
  const requestId = req.params.request_id;

  const generalInfoQuery = new Promise((resolve, reject) => {
    /*
        - Everything from request
        requestor   - username
                    - rekening
        instansi    - nama
                    - alamat
        supervisorA - diterima
                    - catatan
                    - supervisor username
                    - tanggal approval
        financeA    - diterima catatan
                    - catatan
                    - finance username
                    - tanggal approval
        project     - nama project
                    - nama client
                    - nama PM
        departemen  - nama departemen
                    - nama leader
    */

    connection.query(
      `
      SELECT 
      request.*,
      owner.username AS owner_username, owner.rekening AS owner_rekening,
      instansi.nama AS instansi_nama, instansi.alamat AS instansi_alamat,
      s_app.diterima AS s_app_diterima, s_app.catatan AS s_app_catatan, s_app.tanggal_approval AS s_app_tanggal_approval,
      s_app_user.username AS s_app_username,
      f_app.diterima AS f_app_diterima, f_app.catatan AS f_app_catatan, f_app.tanggal_approval AS f_app_tanggal_approval,
      f_app_user.username AS f_app_username,
      project.id_project AS project_id, project.nama_project AS project_nama, project.nama_client AS project_client,
      project_pm.username AS project_username,
      departemen.nama_departemen AS departemen_nama,
      departemen_leader.username AS departemen_username
      FROM request 
      LEFT JOIN user owner ON request.id_user = owner.id_user 
      LEFT JOIN instansi ON request.id_instansi = instansi.id_instansi 
      LEFT JOIN approval s_app ON request.id_request = s_app.id_request AND s_app.type = 'supervisor' 
      LEFT JOIN user s_app_user ON s_app.id_approver = s_app_user.id_user 
      LEFT JOIN approval f_app ON request.id_request = f_app.id_request AND f_app.type = 'finance' 
      LEFT JOIN user f_app_user ON f_app.id_approver = f_app_user.id_user 
      LEFT JOIN project ON request.id_project = project.id_project 
      LEFT JOIN user project_pm ON project.id_supervisor = project_pm.id_user 
      LEFT JOIN departemen ON departemen.id_departemen = owner.id_departemen 
      LEFT JOIN user departemen_leader ON departemen.id_leader = departemen_leader.id_user 
      WHERE request.id_request = ${requestId} 
      GROUP BY request.id_request;
      `,
      (err, rows, fields) => {
        if (err) return reject(err);
        if (rows.length < 1) return reject(new Error("Not found"));
        resolve(rows[0]);
      }
    );
  });

  const imagesQuery = new Promise((resolve, reject) => {
    connection.query(
      `SELECT * FROM request_gambar WHERE id_request = ${requestId};`,
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });

  const itemsQuery = new Promise((resolve, reject) => {
    connection.query(
      `SELECT * FROM barang WHERE id_request = ${requestId};`,
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });

  // Execute the queries asynchronously and return the aggregated result
  try {
    const requestData = await generalInfoQuery;
    requestData.images = await imagesQuery;
    requestData.items = await itemsQuery;

    return requestData;
  } catch (error) {
    throw error;
  }
}

module.exports = router;
