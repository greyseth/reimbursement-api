const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();
const path = require("path");
const excel = require("excel4node");

const connection = require("../db");
const { createWorksheet } = require("../excelUtil");
const userVerify = require("../middlewares/userVerify");
const { sendEmail } = require("../emailUtil");
const multer = require("multer");
const requestCreateVerify = require("../middlewares/requestCreateVerify");

router.get("/instansi", async (req, res) => {
  connection.query(
    `
    SELECT instansi.*, 
    (SELECT COUNT(project.id_project) FROM project WHERE project.id_instansi = instansi.id_instansi) AS jumlah_project
    FROM instansi;
    `,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/instansi/id/:id_instansi", async (req, res) => {
  let instansiData;
  connection.query(
    `SELECT nama, alamat FROM instansi WHERE id_instansi = ?;`,
    [req.params.id_instansi],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1) return res.sendStatus(201);

      instansiData = rows[0];

      let projectData;
      connection.query(
        `SELECT project.id_project, project.nama_project, user.username AS supervisor FROM project LEFT JOIN user ON project.id_supervisor = user.id_user WHERE project.id_instansi = ?`,
        [req.params.id_instansi],
        (err, rows, fields) => {
          if (err) return res.status(500).json({ error: err.message });

          projectData = rows;

          res.status(200).json({
            instansi: instansiData,
            project: projectData,
            departments: [],
          });
        }
      );
    }
  );
});

router.get("/departments", async (req, res) => {
  connection.query(
    `
      SELECT departemen.*, user.username AS leader, COUNT(member.id_user) AS member_count
      FROM departemen 
      LEFT JOIN user ON departemen.id_leader = user.id_user 
      LEFT JOIN user member ON member.id_departemen = departemen.id_departemen
      GROUP BY departemen.id_departemen;
    `,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err });
      res.status(200).json(rows);
    }
  );
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
              OR (approval.id_request IS NOT NULL AND approval.diterima = FALSE)
            THEN request.id_request
        END) AS request_ditolak,
        
        COUNT(DISTINCT CASE 
            WHEN approval.id_request IS NOT NULL 
              AND approval.type = 'finance' AND approval.diterima = TRUE
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
    LEFT JOIN approval ON approval.id_request = request.id_request AND approval.version = request.current_version  
    LEFT JOIN barang ON barang.id_request = request.id_request AND barang.version = request.current_version 
    WHERE user.id_user = ${res.locals.id_user}
    GROUP BY user.id_user;
    `,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });

      // This is a shitty hack, I know
      // rows[0].request_pending -= rows[0].request_disetujui;
      // rows[0].request_pending -= rows[0].request_selesai;
      // rows[0].request_pending -= rows[0].request_ditolak;

      res.status(200).json(rows[0]);
    }
  );
});

router.get("/dashboard/stats", userVerify, async (req, res) => {
  // Gets data for the latest request from this user
  connection.query(
    `
    SELECT 
    request.id_request, request.judul, request.deskripsi, request.metode_pembayaran, request.tanggal_request,
    request.id_instansi, request.id_project, 
    SUM(DISTINCT pengeluaran.harga) AS harga, 
    instansi.nama AS instansi, 
    project.nama_project AS project,
    s_approval.diterima AS supervisor_approved,
    f_approval.diterima AS finance_approved,
    r_approval.diterima AS realisasi_approved,
    COUNT(reject_approval.id_approval) AS ditolak
    FROM request 
    LEFT JOIN instansi ON instansi.id_instansi = request.id_instansi 
    LEFT JOIN project ON project.id_project = project.id_project 
    LEFT JOIN pengeluaran ON pengeluaran.id_request = request.id_request AND pengeluaran.version = request.current_version
    LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.version = request.current_version AND s_approval.type = 'supervisor'
    LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.version = request.current_version AND f_approval.type = 'finance'
    LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.version = request.current_version AND r_approval.type = 'realisasi'
    LEFT JOIN approval reject_approval ON request.id_request = reject_approval.id_request AND reject_approval.version = request.current_version AND reject_approval.diterima IS NOT NULL AND reject_approval.diterima = FALSE
    WHERE request.id_user = ${res.locals.id_user}
    GROUP BY request.id_request 
    ORDER BY request.tanggal_request DESC
    LIMIT 1;
    `,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err });
      let latest =
        rows.length > 0
          ? rows.map((r) => {
              return {
                ...r,
                status:
                  r.ditolak > 0
                    ? "ditolak"
                    : r.realisasi_approved
                    ? "selesai"
                    : r.finance_approved
                    ? "diterima"
                    : "pending",
              };
            })
          : [];

      // Counts the amount of requests the user has to review
      connection.query(
        `
          SELECT COUNT(request.id_request) AS amount
          FROM request
          LEFT JOIN project ON project.id_project = request.id_project
          LEFT JOIN instansi ON instansi.id_instansi = request.id_instansi OR instansi.id_instansi = project.id_instansi
          LEFT JOIN user ON user.id_user = request.id_user
          LEFT JOIN departemen ON departemen.id_departemen = user.id_departemen
          LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.version = request.current_version
          LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.version = request.current_version
          LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.version = request.current_version
          LEFT JOIN approval reject_approval ON request.id_request = reject_approval.id_request AND reject_approval.diterima = FALSE AND reject_approval.version = request.current_version
          WHERE ((project.id_supervisor IS NOT NULL AND project.id_supervisor = ?) OR (project.id_supervisor IS NULL AND departemen.id_leader = ?)) AND request.id_user != ?
          GROUP BY request.id_request;
        `,
        [res.locals.id_user, res.locals.id_user, res.locals.id_user],
        (err, rows, fields) => {
          if (err) return res.status(500).json({ error: err });

          let amount = rows.length > 0 ? rows[0].amount : 0;

          // Lists the amount of requests based on this user's projects
          connection.query(
            `
              SELECT project.id_project, project.nama_project, project.status, COUNT(request.id_request) AS request_count
              FROM user_project
              LEFT JOIN project ON user_project.id_project = project.id_project
              LEFT JOIN request ON user_project.id_project = request.id_project
              WHERE user_project.id_user = ?
              GROUP BY project.id_project
            `,
            [res.locals.id_user],
            (err, rows, fields) => {
              if (err) return res.status(500).json({ error: err });

              let projects = rows;

              res
                .status(200)
                .json({ latest: latest, amount: amount, projects: projects });
            }
          );
        }
      );
    }
  );
});

router.get("/emailtest/:id_request", async (req, res) => {
  connection.query(
    `
    SELECT
    request.id_request, request.judul, request.deskripsi, request.metode_pembayaran,
    project.nama_project, departemen.nama_departemen, instansi.nama AS nama_instansi,
    owner.username AS owner_username, owner.rekening, owner.email AS owner_email, 
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
    LEFT JOIN approval s_app ON request.id_request = s_app.id_request AND s_app.version = request.current_version AND
    LEFT JOIN user s_app_approver ON s_app.id_approver = s_app_approver.id_user
    LEFT JOIN approval f_app ON request.id_request = f_app.id_request AND f_app.version = request.current_version 
    LEFT JOIN user f_app_approver ON f_app.id_approver = f_app_approver.id_user
    LEFT JOIN approval r_app ON request.id_request = r_app.id_request AND r_app.version = request.current_version
    LEFT JOIN user r_app_approver ON r_app.id_approver = r_app_approver.id_user
    WHERE request.id_request = ?
    GROUP BY request.id_request;
    `,
    [req.params.id_request],
    (err, rows, fields) => {
      res.status(200).json(rows);
    }
  );
});

module.exports = router;
