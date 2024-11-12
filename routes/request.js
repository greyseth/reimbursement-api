const express = require("express");
const router = express.Router();
const multer = require("multer");
const connection = require("../db");

const requestOwnerVerify = require("../middlewares/requestOwnerVerify");
const { createWorksheet } = require("../excelUtil");
const requestCreateVerify = require("../middlewares/requestCreateVerify");
const userVerify = require("../middlewares/userVerify");
const roleCheck = require("../middlewares/roleCheck");

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
  arrayUpload(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    const content = req.body;
    if (
      !content.metode_pembayaran ||
      !content.judul ||
      !content.deskripsi ||
      !content.pengeluaran ||
      content.pengeluaran.length < 1
    )
      return res
        .status(400)
        .json({ error: "Missing one or more required parameters" });

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

          // Inserts pengeluaran
          let pengeluaranItems = [];
          JSON.parse(content.pengeluaran).forEach((p, i) => {
            pengeluaranItems.push([
              insertId,
              p.deskripsi,
              p.harga,
              p.tanggal_pembelian,
              req.files[i].filename,
              1,
            ]);
          });
          connection.query(
            `INSERT INTO pengeluaran(id_request, deskripsi, harga, tanggal_pembelian, image, version) VALUES ?`,
            [pengeluaranItems],
            (err, rows, fields) => {
              if (err)
                return connection.rollback(() =>
                  res
                    .status(500)
                    .json({ error: "PENGELUARAN INSERT ERROR: " + err.message })
                );

              if (res.locals.isSupervisor || res.locals.isDepartmentLeader) {
                // Creates deafult approval if project manager or department leader
                connection.query(
                  `INSERT INTO approval(id_request, tanggal_approval, diterima, id_approver, type) 
              VALUES(${insertId}, NOW(), TRUE, ${res.locals.id_user}, 'supervisor');`,
                  (err, rows, fields) => {
                    if (err)
                      return connection.rollback(() =>
                        res.status(500).json({
                          error: "DEFAULT APPROVAL ERROR: " + err.message,
                        })
                      );

                    connection.commit((err) => {
                      if (err)
                        return res.status(500).json({ error: err.message });
                      res
                        .status(200)
                        .json({ success: true, id_request: insertId });
                    });
                  }
                );
              } else
                connection.commit((err) => {
                  if (err) return res.status(500).json({ error: err.message });
                  res.status(200).json({ success: true, id_request: insertId });
                });
            }
          );
        }
      );
    });
  });
});

// router.put("/:id_request", requestOwnerVerify, async (req, res) => {
//   const content = req.body;
//   if (
//     !content.judul ||
//     !content.metode_pembayaran ||
//     !content.pengeluaran ||
//     content.pengeluaran.length < 1
//   )
//     return res
//       .status(400)
//       .json({ error: "Missing one or more required parameters" });

//   if (!content.id_project && !content.id_instansi)
//     return res
//       .status(400)
//       .json({ error: "Either id_project or id_instansi has to have a value" });

//   arrayUpload(req, res, (err) => {
//     if (err) return res.status(500).json({ error: err.message });

//     connection.beginTransaction((err) => {
//       if (err) return res.status(500).json({ error: err.message });

//       // Selects original request data
//       connection.query(
//         `SELECT * FROM request WHERE id_request = ?`,
//         [req.params.id_request],
//         (err, rows, fields) => {
//           if (err)
//             return connection.rollback(() =>
//               res.status(500).json({ error: err.message })
//             );

//           const ogData = rows[0];

//           // Inserts old data to updates table
//           connection.query(
//             `
//               INSERT INTO request_update(id_original, judul, deskripsi, metode_pembayaran, id_project, id_instansi, tanggal_update, version)
//               VALUES(?, ?, ?, ?, ?, ?, NOW(), ?);
//               `,
//             [
//               ogData.id_request,
//               ogData.judul,
//               ogData.deskripsi ?? "",
//               ogData.metode_pembayaran,
//               ogData.id_project,
//               ogData.id_instansi,
//               ogData.current_version,
//             ],
//             (err, rows, fields) => {
//               if (err)
//                 return connection.rollback(() =>
//                   res.status(500).json({ error: err.message })
//                 );

//               // you shouldnt have dropped the version columns you fucking idiot
//               // now you have to redo everything because of your own stupidity
//               // i fucking hate you. you should go die

//               // Updates request record
//               connection.query(
//                 `UPDATE request SET judul = ?, deskripsi = ?, metode_pembayaran = ?, id_project = ?, id_instansi = ?,
//                     tanggal_update = NOW(), current_version = current_version + 1 WHERE id_request = ?`,
//                 [
//                   content.judul,
//                   content.deskripsi ?? "",
//                   content.metode_pembayaran,
//                   content.id_project,
//                   content.id_instansi,
//                   req.params.id_request,
//                 ],
//                 (err, rows, fields) => {
//                   if (err)
//                     return connection.rollback(() =>
//                       res.status(500).json({ error: err.message })
//                     );

//                   const currentVersion = ogData.current_version + 1;

//                   // Inserts new pengeluaran
//                   // let barangs = [];
//                   // content.barang.forEach((b) => {
//                   //   barangs.push([
//                   //     req.params.id_request,
//                   //     b.nama,
//                   //     b.jumlah,
//                   //     b.harga,
//                   //     b.tanggal_pembelian,
//                   //     currentVersion,
//                   //   ]);
//                   // });
//                   let pengeluarans = [];
//                   content.barang.forEach(p => pengeluarans.push(
//                     [
//                       req.params.id_request,
//                       p.deskripsi,
//                       p.harga,
//                       p.tanggal_pembelian,
//                       currentVersion
//                     ]
//                   ));

//                   connection.query(
//                     `INSERT INTO pengeluaran(id_request, deskripsi, harga, tanggal_pembelian, version) VALUES ?`,
//                     [pengeluarans],
//                     (err, rows, fields) => {
//                       if (err)
//                         return connection.rollback(() =>
//                           res.status(500).json({ error: err.message })
//                         );

//                         const pengeluaranId = rows.insertId;

//                       // Inserts new images
//                       let images = [];
//                       if (req.files && req.files.length > 0)
//                         req.files.forEach((f) => {
//                           images.push([
//                             req.params.id_request,
//                             f.filename,
//                             currentVersion,
//                           ]);
//                         });

//                       connection.query(
//                         images.length > 0
//                           ? "INSERT INTO request_gambar(id_request, nama_file, version) VALUES ?"
//                           : "SELECT NULL",
//                         [images],
//                         (err, rows, fields) => {
//                           if (err)
//                             return connection.rollback(() =>
//                               res.status(500).json({ error: err.message })
//                             );

//                           connection.commit((err) => {
//                             if (err)
//                               return connection.rollback(() =>
//                                 res.status(500).json({ error: err.message })
//                               );
//                             res.status(200).json({ success: true });
//                           });
//                         }
//                       );
//                     }
//                   );
//                 }
//               );
//             }
//           );
//         }
//       );
//     });
//   });
// });

// Oh boy, this is a bloody long one...
router.put("/:id_request", requestOwnerVerify, async (req, res) => {
  arrayUpload(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    const content = req.body;
    if (!content.judul || !content.deskripsi || !content.metode)
      return res
        .status(400)
        .json({ error: "Missing one or more requires parameters" });
    // Optional params - id_instansi: 0, id_project: 0, pengeluaran_add: [...{}], pengeluaran_remove: [...0]

    if (content.id_instansi && content.id_project)
      return res
        .status(400)
        .json({ error: "Either id_instansi or id_project has to be empty" });

    connection.beginTransaction((err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Selects original request data
      connection.query(
        `SELECT * FROM request WHERE id_request = ?`,
        [req.params.id_request],
        (err, rows, fields) => {
          if (err)
            return connection.rollback(() =>
              res.status(500).json({ error: err.message })
            );
          if (rows.length < 1)
            return connection.rollback(() =>
              res.status(400).json({
                error:
                  "Could not find request with id " + req.params.id_request,
              })
            );

          let ogData = rows[0];

          // Inserts old data to updates table
          // (I don't remember why I didn't just make this a trigger in the DB)
          connection.query(
            `
          INSERT INTO request_update(id_original, judul, deskripsi, metode_pembayaran, id_project, id_instansi, tanggal_update, version)
          VALUES(?, ?, ?, ?, ?, ?, NOW(), ?)
          `,
            [
              ogData.id_request,
              ogData.judul,
              ogData.deskripsi ?? "",
              ogData.metode_pembayaran,
              ogData.id_project,
              ogData.id_instansi,
              ogData.current_version,
            ],
            (err, rows, fields) => {
              if (err)
                connection.rollback(() =>
                  res.status(500).json({ error: err.message })
                );

              // Updates record in request table
              connection.query(
                `
                UPDATE request SET
                  judul = ?,
                  deskripsi = ?,
                  metode_pembayaran = ?,
                  current_version = current_version + 1${
                    content.id_instansi || content.id_project ? "," : ""
                  }
                  ${
                    content.id_instansi
                      ? `id_instansi = ${content.id_instansi}${
                          content.id_project ? "," : ""
                        }`
                      : ""
                  }
                  ${
                    content.id_project
                      ? `id_project = ${content.id_project}`
                      : ""
                  }
                WHERE id_request = ?
                `,
                [
                  content.judul,
                  content.deskripsi,
                  content.metode,
                  req.params.id_request,
                ],
                (err, rows, fields) => {
                  if (err)
                    return connection.rollback(() =>
                      res.status(500).json({ error: err.message })
                    );

                  const currentVersion = ogData.current_version + 1;

                  // Creates duplicate of existing pengeluaran (except the ones removed)
                  const pengeluaranRemoveArray = JSON.parse(
                    content.pengeluaran_remove
                  );
                  const placeholders = pengeluaranRemoveArray
                    .map(() => "?")
                    .join(",");

                  connection.query(
                    `
                    INSERT INTO pengeluaran
                    SELECT NULL id_pengeluaran, id_request, deskripsi, harga, tanggal_pembelian, version+1, image
                    FROM pengeluaran
                    WHERE id_request = ? ${
                      pengeluaranRemoveArray.length > 0
                        ? `AND id_pengeluaran NOT IN (${placeholders})`
                        : ""
                    }
                    `,
                    [req.params.id_request, ...pengeluaranRemoveArray],
                    (err, rows, fields) => {
                      if (err)
                        return connection.rollback(() =>
                          res.status(500).json({
                            error: "DUPLICATION ERROR: " + err.message,
                          })
                        );

                      // Inserts new pengeluaran
                      let newPengeluaran = [];
                      JSON.parse(content.pengeluaran_add).forEach((p, i) => {
                        newPengeluaran.push([
                          req.params.id_request,
                          p.deskripsi ?? "",
                          p.harga,
                          p.tanggal_pembelian,
                          currentVersion,
                          req.files[i].filename,
                        ]);
                      });
                      connection.query(
                        newPengeluaran.length > 0
                          ? `
                          INSERT INTO pengeluaran(id_request, deskripsi, harga, tanggal_pembelian, version, image)
                          VALUES ?
                          `
                          : "SELECT NULL",
                        [newPengeluaran],
                        (err, rows, fields) => {
                          if (err)
                            return res.status(500).json({
                              error: "INSERTION ERROR: " + err.message,
                            });

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
    `SELECT request.id_request, request.judul, request.deskripsi, request.tanggal_request, SUM(pengeluaran.harga) AS jumlah, 
    project.id_project, project.nama_project AS project,
    instansi.id_instansi, instansi.nama AS instansi,
    s_approval.diterima AS supervisor_diterima,
    f_approval.diterima AS finance_diterima, 
    r_approval.diterima AS realisasi_diterima,
    COUNT(reject_approval.diterima) AS ditolak
    FROM request 
    LEFT JOIN pengeluaran ON request.id_request = pengeluaran.id_request AND pengeluaran.version = request.current_version
    LEFT JOIN project ON request.id_project = project.id_project 
    LEFT JOIN instansi ON instansi.id_instansi = request.id_instansi OR instansi.id_instansi = project.id_instansi 
    LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.version = request.current_version
    LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.version = request.current_version
    LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.version = request.current_version
    LEFT JOIN approval reject_approval ON request.id_request = reject_approval.id_request AND reject_approval.diterima = FALSE AND reject_approval.version = request.current_version
    WHERE request.id_user = ? GROUP BY request.id_request;`,
    [res.locals.id_user],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/toapprove", userVerify, async (req, res) => {
  connection.query(
    `
    SELECT 
    request.id_request, request.judul, request.deskripsi, request.tanggal_request, SUM(pengeluaran.harga) AS jumlah, 
    project.id_project, project.nama_project AS project,
    instansi.id_instansi, instansi.nama AS instansi,
    s_approval.diterima AS supervisor_diterima,
    f_approval.diterima AS finance_diterima, 
    r_approval.diterima AS realisasi_diterima,
    COUNT(reject_approval.diterima) AS ditolak,
    project.id_supervisor, leader.id_user AS id_leader 
    FROM request 
    LEFT JOIN pengeluaran ON request.id_request = pengeluaran.id_request AND pengeluaran.version = request.current_version
    LEFT JOIN project ON request.id_project = project.id_project 
    LEFT JOIN user ON user.id_user = request.id_user 
    LEFT JOIN departemen ON departemen.id_departemen = user.id_departemen 
    LEFT JOIN user leader ON leader.id_user = departemen.id_leader 
    LEFT JOIN instansi ON instansi.id_instansi = request.id_instansi OR instansi.id_instansi = project.id_instansi 
    LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.version = request.current_version
    LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.version = request.current_version
    LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.version = request.current_version
    LEFT JOIN approval reject_approval ON request.id_request = reject_approval.id_request AND reject_approval.diterima = FALSE AND reject_approval.version = request.current_version
    WHERE ((project.id_supervisor IS NOT NULL AND project.id_supervisor = ?) OR (project.id_supervisor IS NULL AND departemen.id_leader = ?)) AND request.id_user != ?
    GROUP BY request.id_request;
    `,
    [res.locals.id_user, res.locals.id_user, res.locals.id_user],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/toapprove/:role", userVerify, async (req, res) => {
  if (req.params.role !== "finance" && req.params.role !== "realisasi")
    return res.status(400).json({ error: "Invalid role" });
  if (res.locals.role !== req.params.role)
    return res.status(401).json({ error: "Unauthorized access" });

  const financeWhere = `WHERE s_approval.diterima IS NOT NULL AND s_approval.diterima = TRUE AND f_approval.diterima IS NULL AND r_approval.diterima IS NULL`;
  const realisasiWhere = `WHERE s_approval.diterima IS NOT NULL AND s_approval.diterima = TRUE AND f_approval.diterima IS NOT NULL AND f_approval.diterima = TRUE AND r_approval.diterima IS NULL`;

  connection.query(
    `
    SELECT 
    request.id_request, request.judul, request.deskripsi, request.tanggal_request, SUM(pengeluaran.harga) AS jumlah, 
    project.id_project, project.nama_project AS project,
    instansi.id_instansi, instansi.nama AS instansi,
    s_approval.diterima AS supervisor_diterima,
    f_approval.diterima AS finance_diterima, 
    r_approval.diterima AS realisasi_diterima,
    COUNT(reject_approval.diterima) AS ditolak,
    project.id_supervisor, leader.id_user AS id_leader 
    FROM request 
    LEFT JOIN pengeluaran ON request.id_request = pengeluaran.id_request AND pengeluaran.version = request.current_version
    LEFT JOIN project ON request.id_project = project.id_project 
    LEFT JOIN user ON user.id_user = request.id_user 
    LEFT JOIN departemen ON departemen.id_departemen = user.id_departemen 
    LEFT JOIN user leader ON leader.id_user = departemen.id_leader 
    LEFT JOIN instansi ON instansi.id_instansi = request.id_instansi OR instansi.id_instansi = project.id_instansi 
    LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.version = request.current_version
    LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.version = request.current_version
    LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.version = request.current_version
    LEFT JOIN approval reject_approval ON request.id_request = reject_approval.id_request AND reject_approval.diterima = FALSE AND reject_approval.version = request.current_version
    ${req.params.role === "finance" ? financeWhere : realisasiWhere}
    OR ((project.id_supervisor IS NOT NULL AND project.id_supervisor = ?) OR (project.id_supervisor IS NULL AND departemen.id_leader = ?)) AND request.id_user != ?
    GROUP BY request.id_request;
    `,
    [res.locals.id_user, res.locals.id_user, res.locals.id_user],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/project/:id_project", userVerify, async (req, res) => {
  connection.query(
    `
    SELECT request.id_request, request.judul, request.tanggal_request, SUM(barang.harga) AS jumlah, 
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
    `
    SELECT request.id_request, request.judul, request.tanggal_request, SUM(barang.harga) AS jumlah, 
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

router.get("/versionhistory/:id_request", async (req, res) => {
  // Add: username, no rekening, nama instansi, nama departemen
  connection.query(
    `
    SELECT
    request.id_request,
    request.current_version AS version, request.judul, request.deskripsi, request.tanggal_request, request.metode_pembayaran, 
    user.username, user.rekening,
    project.nama_project AS project, departemen.nama_departemen AS departemen, instansi.nama AS instansi
    FROM request
    LEFT JOIN project ON request.id_project = request.id_project
    LEFT JOIN instansi ON request.id_instansi = instansi.id_instansi 
    LEFT JOIN user ON request.id_user = user.id_user 
    LEFT JOIN departemen ON user.id_departemen = departemen.id_departemen 
    WHERE request.id_request = ?
    GROUP BY request.id_request
    UNION
    SELECT
    request_update.id_original AS id_request,
    request_update.version, request_update.judul, request_update.deskripsi, request_update.tanggal_update, request_update.metode_pembayaran, 
    user.username, user.rekening,
    project.nama_project AS project, departemen.nama_departemen AS departemen, instansi.nama AS instansi 
    FROM request_update
    LEFT JOIN request ON request_update.id_original = request.id_request
    LEFT JOIN project ON request_update.id_project = request.id_project
    LEFT JOIN instansi ON request_update.id_instansi = instansi.id_instansi 
    LEFT JOIN user ON request.id_user = user.id_user 
    LEFT JOIN departemen ON user.id_departemen = departemen.id_departemen 
    WHERE id_request = ?
    GROUP BY request_update.version
    ORDER BY version DESC
    `,
    [req.params.id_request, req.params.id_request],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/versionhistory/:id_request/:version/barang", async (req, res) => {
  connection.query(
    `SELECT * FROM pengeluaran WHERE pengeluaran.id_request = ? AND pengeluaran.version = ?`,
    [req.params.id_request, req.params.version],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get(
  "/versionhistory/:id_request/:version/approval",
  async (req, res) => {
    connection.query(
      `SELECT approval.*, user.username AS approver FROM approval LEFT JOIN user ON user.id_user = approval.id_approver WHERE id_request = ? AND version = ?`,
      [req.params.id_request, req.params.version],
      (err, rows, fields) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.status(200).json({});

        res.status(200).json({
          supervisor: rows.find((r) => r.type === "supervisor"),
          finance: rows.find((r) => r.type === "finance"),
          realisasi: rows.find((r) => r.type === "realisasi"),
        });
      }
    );
  }
);

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
router.post("/all/:amount/:page", analysisRoleCheck, async (req, res) => {
  const content = req.body;
  // Optional parameters = search filter, days filter, project filter, instansi filter, status filter

  connection.query(
    // WHERE 1=1 is such a shitty hack lmfao
    `
      SELECT request.id_request, request.judul, request.tanggal_request, SUM(pengeluaran.harga) AS jumlah,
      project.id_project, project.nama_project AS project, 
      instansi.id_instansi, instansi.nama AS instansi,
      s_approval.diterima AS supervisor_diterima,
      f_approval.diterima AS finance_diterima, 
      r_approval.diterima AS realisasi_diterima,
      COUNT(reject_approval.diterima) AS ditolak
      FROM request
      LEFT JOIN project ON project.id_project = request.id_project
      LEFT JOIN instansi ON instansi.id_instansi = request.id_instansi OR instansi.id_instansi = project.id_instansi
      LEFT JOIN pengeluaran ON pengeluaran.id_request = request.id_request AND pengeluaran.version = request.current_version
      LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.version = request.current_version
      LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.version = request.current_version
      LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.version = request.current_version
      LEFT JOIN approval reject_approval ON request.id_request = reject_approval.id_request AND reject_approval.diterima = FALSE AND reject_approval.version = request.current_version
      WHERE 1=1
      ${
        content.days
          ? ` AND request.tanggal_request >= DATE_SUB(NOW(), INTERVAL ${content.days} DAY)`
          : ""
      }
      ${
        content.project_filter
          ? ` AND project.id_project = ${content.project_filter}`
          : ""
      }
      ${
        content.instansi_filter
          ? ` AND instansi.id_instansi = ${content.instansi_filter}`
          : ""
      }
      ${
        content.search
          ? ` AND (LOWER(request.judul) LIKE '%${content.search.toLowerCase()}%' OR LOWER(request.judul) LIKE '%${content.search.toLowerCase()}%')`
          : ""
      }
      ${
        content.status === "pending"
          ? ` AND s_approval.diterima IS NULL`
          : content.status === "diterima"
          ? ` AND f_approval.diterima IS NOT NULL AND f_approval.diterima = TRUE`
          : content.status === "ditolak"
          ? ` AND reject_approval.diterima IS NOT NULL`
          : content.status === "selesai"
          ? ` AND r_approval.diterima IS NOT NULL AND r_approval.diterima = TRUE`
          : ""
      }
      GROUP BY request.id_request
      ORDER BY tanggal_request DESC
      LIMIT ? 
      OFFSET ?
    `,
    [
      parseInt(req.params.amount),
      (parseInt(req.params.page) - 1) * parseInt(req.params.amount),
    ],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/:request_id", roleCheck, async (req, res) => {
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
    let realisasiApproval = undefined;
    let items = data.items;

    requestDetails.id_request = data.id_request;
    requestDetails.judul = data.judul;
    requestDetails.deskripsi = data.deskripsi;
    requestDetails.metode_pembayaran = data.metode_pembayaran;
    requestDetails.tanggal_request = data.tanggal_request;
    requestDetails.tanggal_update = data.tanggal_update;
    requestDetails.version = data.current_version;

    if (data.instansi_nama) {
      instansi = {};
      instansi.nama = data.instansi_nama;
      instansi.alamat = data.instansi_alamat;
    }

    departemen.nama = data.departemen_nama;
    departemen.leader = data.departemen_username;
    departemen.leader_id = data.departemen_id_user;
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
      supervisorApproval.id_approval = data.s_app_id;
      supervisorApproval.diterima = data.s_app_diterima;
      supervisorApproval.catatan = data.s_app_catatan;
      supervisorApproval.approver = data.s_app_username;
      supervisorApproval.tanggal_approval = data.s_app_tanggal_approval;
    }

    if (data.f_app_diterima !== null) {
      financeApproval = {};
      financeApproval.id_approval = data.f_app_id;
      financeApproval.diterima = data.f_app_diterima;
      financeApproval.catatan = data.f_app_catatan;
      financeApproval.approver = data.f_app_username;
      financeApproval.tanggal_approval = data.f_app_tanggal_approval;
    }

    if (data.r_app_diterima !== null) {
      realisasiApproval = {};
      realisasiApproval.id_approval = data.r_app_id;
      realisasiApproval.diterima = data.r_app_diterima;
      realisasiApproval.catatan = data.r_app_catatan;
      realisasiApproval.approver = data.r_app_username;
      realisasiApproval.tanggal_approval = data.r_app_tanggal_approval;
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
        realisasi: realisasiApproval,
      },
      items: items,
      viewer_role: res.locals.role,
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

    // TODO-done: Change this request to get values based on most recent updates asdjsaoidnas;dusajdasjdoasdj;
    connection.query(
      `
      SELECT 
        request.*, 
        owner.username AS owner_username, owner.rekening AS owner_rekening, 
        instansi.nama AS instansi_nama, instansi.alamat AS instansi_alamat, 
        s_app.id_approval AS s_app_id, s_app.diterima AS s_app_diterima, s_app.catatan AS s_app_catatan, s_app.tanggal_approval AS s_app_tanggal_approval, 
        s_app_user.username AS s_app_username, 
        f_app.id_approval AS f_app_id, f_app.diterima AS f_app_diterima, f_app.catatan AS f_app_catatan, f_app.tanggal_approval AS f_app_tanggal_approval, 
        f_app_user.username AS f_app_username, 
        r_app.id_approval AS r_app_id, r_app.diterima AS r_app_diterima, r_app.catatan AS r_app_catatan, r_app.tanggal_approval AS r_app_tanggal_approval,
        r_app_user.username AS r_app_username,
        project.id_project AS project_id, project.nama_project AS project_nama, project.nama_client AS project_client, 
        project_pm.username AS project_username, 
        departemen.nama_departemen AS departemen_nama,
        departemen_leader.id_user AS departemen_id_user, departemen_leader.username AS departemen_username 
      FROM request 
        LEFT JOIN user owner ON request.id_user = owner.id_user       
        LEFT JOIN approval s_app ON request.id_request = s_app.id_request AND s_app.type = 'supervisor' AND s_app.version = request.current_version 
        LEFT JOIN user s_app_user ON s_app.id_approver = s_app_user.id_user 
        LEFT JOIN approval f_app ON request.id_request = f_app.id_request AND f_app.type = 'finance' AND f_app.version = request.current_version 
        LEFT JOIN user f_app_user ON f_app.id_approver = f_app_user.id_user 
        LEFT JOIN approval r_app ON request.id_request = r_app.id_request AND r_app.type = 'realisasi' AND r_app.version = request.current_version
        LEFT JOIN user r_app_user ON r_app.id_approver = r_app_user.id_user 
        LEFT JOIN project ON request.id_project = project.id_project 
        LEFT JOIN instansi ON request.id_instansi = instansi.id_instansi OR project.id_instansi = instansi.id_instansi
        LEFT JOIN user project_pm ON project.id_supervisor = project_pm.id_user 
        LEFT JOIN departemen ON departemen.id_departemen = owner.id_departemen 
        LEFT JOIN user departemen_leader ON departemen.id_leader = departemen_leader.id_user 
      WHERE request.id_request = ?
      GROUP BY request.id_request;
      `,
      [requestId],
      (err, rows, fields) => {
        if (err) return reject(err);
        if (rows.length < 1) return reject(new Error("Not found"));
        resolve(rows[0]);
      }
    );
  });

  const itemsQuery = new Promise((resolve, reject) => {
    connection.query(
      `
      SELECT pengeluaran.*
      FROM pengeluaran 
      LEFT JOIN request ON request.id_request = pengeluaran.id_request
      WHERE pengeluaran.id_request = ? AND pengeluaran.version = request.current_version;
      `,
      [requestId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });

  // Execute the queries asynchronously and return the aggregated result
  try {
    const requestData = await generalInfoQuery;
    requestData.items = await itemsQuery;

    return requestData;
  } catch (error) {
    throw error;
  }
}

module.exports = router;
