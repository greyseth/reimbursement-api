const express = require("express");
const multer = require("multer");
const router = express.Router();

const approveVerify = require("./approveVerify");
const connection = require("../db");
const realisasiVerify = require("../middlewares/realisasiVerify");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_approvalimg_" + file.originalname);
  },
});

const upload = multer({ storage: storage });

router.post("/", approveVerify, async (req, res) => {
  const content = req.body;
  if (!content.id_request || content.diterima === null)
    return res
      .status(400)
      .json({ error: "Missing one ore more required parameters" });
  if (!content.catatan) content.catatan = "";

  const supervisorQuery = `INSERT INTO supervisor_approval(id_supervisor, catatan, tanggal_approval, diterima, id_request) 
    VALUES (${res.locals.user_id}, '${content.catatan}', NOW(), ${content.diterima}, ${content.id_request});`;

  const financeQuery = `INSERT INTO finance_approval(id_finance, catatan, tanggal_approval, diterima, id_request)
    VALUES (${res.locals.user_id}, '${content.catatan}', NOW(), ${content.diterima}, ${content.id_request});`;

  connection.query(
    res.locals.role === "supervisor" ? supervisorQuery : financeQuery,
    (err, rows, fields) => {
      if (err)
        return res
          .status(500)
          .json({ error: "Approval Query: " + err.message });
      res.sendStatus(200);
    }
  );
});

router.post(
  "/confirmpay",
  [realisasiVerify, upload.array("images")],
  async (req, res) => {
    const content = req.body;
    if (!content.id_approval)
      return res
        .status(400)
        .json({ error: "Missing one or more required parameters" });

    //Acquires request id and data
    connection.query(
      `SELECT * FROM finance_approval WHERE id_approval = ${content.id_approval};`,
      (err, rows, fields) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length < 1)
          return res.status(404).json({ error: "id_approval not found" });

        //Updates request row data
        connection.query(
          `UPDATE request SET dibayarkan = TRUE, tanggal_bayar = NOW() WHERE id_request = ${rows[0].id_request};`,
          (err, rows, fields) => {
            if (err) return res.status(500).json({ error: err.message });

            if (req.files.length > 1) {
              //Inserts all images
              let imageQuery =
                "INSERT INTO approval_gambar(id_approval, nama_file) VALUES ";
              req.files.forEach((file, index) => {
                imageQuery += `(${content.id_approval}, '${file.filename}')${
                  index === req.files.length - 1 ? ";" : ","
                }`;
              });

              connection.query(imageQuery, (err, rows, fields) => {
                if (err) return res.status(500).json({ error: err.message });
                res.sendStatus(200);
              });
            } else res.sendStatus(200);
          }
        );
      }
    );
  }
);

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
