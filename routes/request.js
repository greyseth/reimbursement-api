const express = require("express");
const router = express.Router();
const multer = require("multer");
const connection = require("../db");

const requestOwnerVerify = require("../middlewares/requestOwnerVerify");
const supervisorVerify = require("../middlewares/supervisorVerify");
const financeVerify = require("../middlewares/financeVerify");
const realisasiVerify = require("../middlewares/realisasiVerify");
const { createWorksheet } = require("../excelutil");
const addInstanceCheck = function (req, res, next) {
  connection.query(
    `SELECT user.id_user, user.role, instansi.id_instansi AS instansi FROM user LEFT JOIN instansi ON user.id_instansi = instansi.id_instansi WHERE user.login_token = '${req.headers.account_token}';`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Unauthorized access" });
      res.locals.id_user = rows[0].id_user;
      res.locals.role = rows[0].role;
      res.locals.instansi = rows[0].instansi;
      next();
    }
  );
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_requestimg_" + file.originalname);
  },
});

const upload = multer({ storage: storage });

router.post(
  "/uploadimages",
  [requestOwnerVerify, upload.array("images")],
  async (req, res) => {
    if (!req.files)
      return res.status(500).json({ error: "Failed to upload images" });

    const content = req.body;
    if (!content.request_id)
      return res.status(400).json({ error: "Missing request_id parameter" });

    let addQuery = "VALUES ";
    req.files.forEach((file, index) => {
      addQuery += `(${content.request_id}, ${file.filename})${
        index === req.files.length - 1 ? ";" : ","
      }`;
    });

    connection.query(
      `INSERT INTO request_gambar(id_request, nama_file) ${addQuery}`,
      (err, rows, fields) => {
        if (err) return res.status(500).json({ error: err.message });
        res.sendStatus(200);
      }
    );
  }
);

router.post("/add", addInstanceCheck, async (req, res) => {
  const content = req.body;
  if (
    !content.metode_pembayaran ||
    !content.department ||
    !content.judul ||
    !content.deskripsi ||
    !content.barang
  )
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  if (!content.nama_project) content.nama_project = "";
  if (!content.nama_client) content.nama_client = "";
  if (!content.nomor_po) content.nomor_po = "";

  connection.query(
    `INSERT INTO request(id_user, metode_pembayaran, tanggal_request, department, id_instansi, judul, deskripsi, nama_project, nama_client, nomor_po)
    VALUES ('${res.locals.id_user}', '${content.metode_pembayaran}', NOW(), '${content.department}', ${res.locals.instansi}, '${content.judul}', '${content.deskripsi}', '${content.nama_project}', '${content.nama_client}', '${content.nomor_po}')`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });

      let barangQuery =
        "INSERT INTO barang(id_request, nama, jumlah, harga, tanggal_pembelian) VALUES";
      content.barang.forEach((b, i) => {
        barangQuery += `(${rows.insertId}, '${b.nama}', ${b.jumlah}, ${
          b.harga
        }, '${b.tanggal_pembelian}')${
          i === content.barang.length - 1 ? ";" : ","
        }`;
      });

      connection.query(barangQuery, (err, rows, fields) => {
        if (err) return res.status(500).json({ error: err.message });

        if (res.locals.role === "supervisor") {
          connection.query(
            `INSERT INTO supervisor_approval(id_supervisor, catatan, tanggal_approval, diterima, id_request)
            VALUES (${res.locals.id_user}, '', NOW(), TRUE, ${rows.insertId})`,
            (err, rows, fields) => {
              if (err) return res.status(500).json({ error: err.message });
              res.sendStatus(200);
            }
          );
        } else res.sendStatus(200);
      });
    }
  );
});

router.get("/supervisor", supervisorVerify, async (req, res) => {
  connection.query(
    `SELECT request.*, user.username, user_gambar.nama_file, supervisor_approval.diterima AS supervisor_approval, finance_approval.diterima AS finance_approval, finance_approval.dibayarkan AS finance_dibayarkan 
    FROM request 
    LEFT JOIN user ON request.id_user = user.id_user LEFT JOIN user_gambar ON user.id_user = user_gambar.id_user 
    LEFT JOIN supervisor_approval ON request.id_request = supervisor_approval.id_request 
    LEFT JOIN finance_approval ON request.id_request = finance_approval.id_request 
    WHERE request.id_instansi = ${res.locals.id_instansi};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/finance", financeVerify, async (req, res) => {
  connection.query(
    `SELECT request.*, user.username, user_gambar.nama_file, supervisor_approval.diterima AS supervisor_approval, finance_approval.diterima AS finance_approval, finance_approval.dibayarkan AS finance_dibayarkan 
    FROM request 
    LEFT JOIN user ON request.id_user = user.id_user LEFT JOIN user_gambar ON user.id_user = user_gambar.id_user 
    LEFT JOIN supervisor_approval ON request.id_request = supervisor_approval.id_request 
    LEFT JOIN finance_approval ON request.id_request = finance_approval.id_request 
    WHERE request.id_instansi = ${res.locals.id_instansi} AND supervisor_approval.diterima <> NULL AND supervisor_approval.diterima <> FALSE;`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/realisasi", realisasiVerify, async (req, res) => {
  connection.query(
    `
    SELECT request.*, user.username, user_gambar.nama_file, supervisor_approval.diterima AS supervisor_approval, finance_approval.diterima AS finance_approval, finance_approval.dibayarkan AS finance_dibayarkan 
    FROM request 
    LEFT JOIN user ON request.id_user = user.id_user LEFT JOIN user_gambar ON user.id_user = user_gambar.id_user 
    LEFT JOIN supervisor_approval ON request.id_request = supervisor_approval.id_request 
    LEFT JOIN finance_approval ON request.id_request = finance_approval.id_request 
    WHERE finance_approval.diterima <> NULL AND finance_approval.diterima <> FALSE;`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
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
    const requestData = await getRequestData(req);
    res.status(200).json(requestData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function getRequestData(req) {
  const requestId = req.params.request_id;

  // Wrap the first query in a promise
  const generalInfoQuery = new Promise((resolve, reject) => {
    connection.query(
      `SELECT request.*, owner.username AS owner, owner_image.nama_file AS user_gambar, owner.rekening AS owner_rekening,
        instansi.nama AS nama_instansi, instansi.alamat AS alamat_instansi, 
        supervisor.username AS supervisor, supervisor_image.nama_file AS supervisor_image, 
        finance.username AS finance, finance_image.nama_file AS finance_image, 
        supervisor_approval.diterima AS supervisor_diterima, supervisor_approval.catatan AS supervisor_catatan, 
        supervisor_approval.tanggal_approval AS supervisor_tanggal, 
        finance_approval.diterima AS finance_diterima, finance_approval.dibayarkan AS finance_dibayarkan, 
        finance_approval.catatan AS finance_catatan, finance_approval.tanggal_approval AS finance_tanggal 
        FROM request 
        LEFT JOIN instansi ON request.id_instansi = instansi.id_instansi 
        LEFT JOIN supervisor_approval ON request.id_request = supervisor_approval.id_request 
        LEFT JOIN finance_approval ON request.id_request = finance_approval.id_request 
        LEFT JOIN user owner ON request.id_user = owner.id_user 
        LEFT JOIN user_gambar owner_image ON owner.id_user = owner_image.id_user 
        LEFT JOIN user supervisor ON supervisor_approval.id_supervisor = supervisor.id_user 
        LEFT JOIN user_gambar supervisor_image ON supervisor_approval.id_supervisor = supervisor_image.id_user 
        LEFT JOIN user finance ON finance_approval.id_finance = finance.id_user 
        LEFT JOIN user_gambar finance_image ON finance_approval.id_finance = finance_image.id_user 
        WHERE request.id_request = ${requestId} 
        GROUP BY request.id_request;`,
      (err, rows) => {
        if (err) return reject(err);
        if (rows.length < 1) return reject(new Error("Request not found"));
        resolve(rows[0]);
      }
    );
  });

  // Wrap the image query in a promise
  const imagesQuery = new Promise((resolve, reject) => {
    connection.query(
      `SELECT * FROM request_gambar WHERE id_request = ${requestId};`,
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });

  // Wrap the items query in a promise
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
