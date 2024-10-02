const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();
const path = require("path");
const excel = require("excel4node");

const connection = require("../db");
const { createWorksheet } = require("../excelUtil");
const userVerify = require("../middlewares/userVerify");

router.get("/instansi", async (req, res) => {
  connection.query(`SELECT * FROM instansi;`, (err, rows, fields) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
});

router.get("/instansi/id/:id_instansi", async (req, res) => {
  connection.query(
    `SELECT * FROM instansi WHERE id_instansi = ${req.params.id_instansi};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1) return res.sendStatus(201);
      res.status(200).json(rows[0]);
    }
  );
});

router.get("/instansi/name/:name", async (req, res) => {
  connection.query(
    `SELECT * FROM instansi WHERE nama = '${req.params.name}';`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1) return res.sendStatus(201);
      res.status(200).json(rows[0]);
    }
  );
});

router.get("/department", async (req, res) => {
  connection.query(`SELECT * FROM deparment;`, (err, rows, fields) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows[0]);
  });
});

router.get("/dashboard", userVerify, async (req, res) => {
  connection.query(
    `
    SELECT 
        user.id_user, 
        
        COUNT(DISTINCT CASE 
            WHEN approval.id_request IS NULL 
              OR (approval.id_request IS NOT NULL AND approval.type = 'supervisor') 
            THEN request.id_request 
        END) AS request_pending,
        
        COUNT(DISTINCT CASE 
            WHEN approval.id_request IS NOT NULL 
              AND approval.type = 'finance' 
            THEN request.id_request 
        END) AS request_disetujui,
        
        COUNT(DISTINCT CASE 
            WHEN approval.id_approval IS NOT NULL 
              AND approval.type = 'realisasi' 
            THEN request.id_request 
        END) AS request_selesai,
        
        COUNT(DISTINCT user_project.id_user_project) AS jumlah_project,
        
        SUM(DISTINCT barang.harga) AS total_permintaan
        
    FROM user
    LEFT JOIN user_project ON user_project.id_user = user.id_user
    LEFT JOIN request ON request.id_user = user.id_user
    LEFT JOIN approval ON approval.id_request = request.id_request
    LEFT JOIN barang ON barang.id_request = request.id_request
    WHERE user.id_user = ${res.locals.id_user}
    GROUP BY user.id_user;
    `,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });

      // This is a shitty hack, I know
      rows[0].request_pending -= rows[0].request_disetujui;
      rows[0].request_pending -= rows[0].request_selesai;

      res.status(200).json(rows[0]);
    }
  );
});

router.get("/dashboard/latest", userVerify, async (req, res) => {
  connection.query(
    `
    SELECT 
    request.id_request, request.judul, request.deskripsi, request.metode_pembayaran, request.id_instansi, request.id_project, 
    SUM(DISTINCT barang.harga) AS total_harga, 
    instansi.nama AS nama_instansi, 
    project.nama_project 
    FROM request 
    LEFT JOIN instansi ON instansi.id_instansi = request.id_instansi 
    LEFT JOIN project ON project.id_project = project.id_project 
    LEFT JOIN barang ON barang.id_request = request.id_request 
    WHERE request.id_user = ${res.locals.id_user}
    GROUP BY request.id_request ORDER BY request.tanggal_request DESC;
    `,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows[0]);
    }
  );
});

router.get("/emailtest", async (req, res) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "anargya2gilland@gmail.com",
      pass: "sirb ihyw tiez avrb ",
    },
  });

  var mailOptions = {
    from: "anargya2gilland@gmail.com",
    to: "anargya2gilland@gmail.com",
    subject: "Sending Email using Node.js",
    text: "That was easy!",
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
    } else {
      console.log("Email sent: " + info.response);
      res.sendStatus(200);
    }
  });
});

module.exports = router;
