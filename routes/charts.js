const express = require("express");
const router = express.Router();
const multer = require("multer");
const connection = require("../db");
const { createReport } = require("../excelUtil");

const roleCheck = (req, res, next) => {
  connection.query(
    "SELECT id_user, role FROM user WHERE login_token = ?",
    [req.headers.account_token],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Invalid account token" });

      // We might need the uaser id, idk
      res.locals.id_user = rows[0].id_user;
      res.locals.role = rows[0].role;

      if (res.locals.role !== "finance" && res.locals.role !== "realisasi")
        return res.status(401).json({ error: "Unauthorized access" });

      next();
    }
  );
};

function formatDate(dbDate) {
  const dateObj = new Date(dbDate);
  return `${dateObj.getFullYear()}-${
    dateObj.getMonth() + 1
  }-${dateObj.getDate()}`;
}

router.get("/peruser/:max", roleCheck, async (req, res) => {
  connection.query(
    `
        SELECT user.id_user, user.username, SUM(pengeluaran.harga) AS amount
        FROM user 
        LEFT JOIN request ON request.id_user = user.id_user 
        LEFT JOIN pengeluaran ON pengeluaran.id_request = request.id_request AND pengeluaran.version = request.current_version
        GROUP BY user.id_user ORDER BY amount DESC LIMIT ?;
        `,
    [parseInt(req.params.max)],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(
        rows.map((r) => {
          return { ...r, amount: r.amount ?? 0 };
        })
      );
    }
  );
});

router.get("/permonth/:max", roleCheck, async (req, res) => {
  connection.query(
    `
        SELECT DATE_FORMAT(request.tanggal_request, '%M') AS month, SUM(pengeluaran.harga) AS amount 
        FROM request 
        LEFT JOIN pengeluaran ON pengeluaran.id_request = request.id_request AND pengeluaran.version = request.current_version
        GROUP BY month
        ORDER BY request.tanggal_request DESC
        LIMIT ?;
    `,
    [parseInt(req.params.max)],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/perproject/:max", roleCheck, async (req, res) => {
  connection.query(
    `
        SELECT project.id_project, project.nama_project, COUNT(request.id_request) AS jumlah, SUM(pengeluaran.harga) AS amount
        FROM project
        LEFT JOIN request ON request.id_project = project.id_project
        LEFT JOIN pengeluaran ON pengeluaran.id_request = request.id_request AND pengeluaran.version = request.current_version
        GROUP BY project.id_project 
        ORDER BY amount DESC
        LIMIT ?
    `,
    [parseInt(req.params.max)],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(
        rows.map((r) => {
          return { ...r, amount: r.amount ?? 0 };
        })
      );
    }
  );
});

router.post("/export", roleCheck, async (req, res) => {
  const content = req.body;
  const rangeType = content.year && content.month ? "month" : "date";

  connection.query(
    `
      SELECT request.id_request, request.judul, request.tanggal_request, request.metode_pembayaran,
      owner.username,
      SUM(pengeluaran.harga) AS harga, COUNT(pengeluaran.id_pengeluaran) AS jumlah,
      project.nama_project AS project,
      s_approval.diterima AS supervisor_status,
      s_approver.username AS supervisor_status_user,
      f_approval.diterima AS finance_status, 
      f_approver.username AS finance_status_user,
      r_approval.diterima AS realisasi_status,
      r_approver.username AS realisasi_status_user
      FROM request
      LEFT JOIN user owner ON owner.id_user = request.id_user
      LEFT JOIN project ON project.id_project = request.id_project
      LEFT JOIN pengeluaran ON pengeluaran.id_request = request.id_request AND pengeluaran.version = request.current_version
      LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.version = request.current_version
      LEFT JOIN user s_approver ON s_approver.id_user = s_approval.id_approver
      LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.version = request.current_version
      LEFT JOIN user f_approver ON f_approver.id_user = f_approval.id_approver
      LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.version = request.current_version
      LEFT JOIN user r_approver ON r_approver.id_user = r_approval.id_approver
      WHERE 1=1
      ${
        rangeType === "month"
          ? `AND DATE_FORMAT(request.tanggal_request, '%Y') = ? AND DATE_FORMAT(request.tanggal_request, '%m') = ?`
          : `AND DATE(request.tanggal_request) BETWEEN ? AND ?`
      }
      GROUP BY request.id_request
      ORDER BY request.tanggal_request DESC;
    `,
    [
      rangeType === "month" ? content.year : formatDate(content.fromDate),
      rangeType === "month"
        ? content.month.toString().padStart(2, "0")
        : formatDate(content.toDate),
    ],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err });

      const newRows = rows.map((r) => {
        let rCopy = r;

        // rCopy.status = "PENDING";
        // if (rCopy.ditolak > 0) rCopy.status = "ditolak";
        // if (rCopy.finance_diterima && rCopy.finance_diterima !== false)
        //   rCopy.status = "DITERIMA";
        // if (rCopy.realisasi_diterima && rCopy.realisasi_diterima !== false)
        //   rCopy.status = "SELESAI";

        const dateObj = new Date(rCopy.tanggal_request);
        rCopy.tanggal_request = `${dateObj.getDate()}/${
          dateObj.getMonth() + 1
        }/${dateObj.getFullYear()}`;

        const setProject = rCopy.project ?? "OPERASIONAL";
        rCopy.project = setProject;

        return rCopy;
      });

      try {
        const workbook = createReport(
          newRows,
          rangeType,
          rangeType === "month" ? content.month : formatDate(content.fromDate),
          rangeType === "month" ? content.year : formatDate(content.toDate)
        );
        workbook.write(`LaporanExport`, res);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );
});

router.get("/exporttest/:year/:month", roleCheck, async (req, res) => {
  connection.query(
    `
      SELECT request.id_request, request.judul, request.tanggal_request, request.metode_pembayaran,
      user.username,
      SUM(pengeluaran.harga) AS harga, COUNT(pengeluaran.id_pengeluaran) AS jumlah,
      project.nama_project AS project,
      s_approval.diterima AS supervisor_diterima,
      f_approval.diterima AS finance_diterima, 
      r_approval.diterima AS realisasi_diterima,
      COUNT(reject_approval.diterima) AS ditolak
      FROM request
      LEFT JOIN user ON user.id_user = request.id_user
      LEFT JOIN project ON project.id_project = request.id_project
      LEFT JOIN pengeluaran ON pengeluaran.id_request = request.id_request AND pengeluaran.version = request.current_version
      LEFT JOIN approval s_approval ON request.id_request = s_approval.id_request AND s_approval.type = 'supervisor' AND s_approval.version = request.current_version
      LEFT JOIN approval f_approval ON request.id_request = f_approval.id_request AND f_approval.type = 'finance' AND f_approval.version = request.current_version
      LEFT JOIN approval r_approval ON request.id_request = r_approval.id_request AND r_approval.type = 'realisasi' AND r_approval.version = request.current_version
      LEFT JOIN approval reject_approval ON request.id_request = reject_approval.id_request AND reject_approval.diterima = FALSE AND reject_approval.version = request.current_version
      WHERE DATE_FORMAT(request.tanggal_request, '%Y') = ? AND DATE_FORMAT(request.tanggal_request, '%m') = ?
      GROUP BY request.id_request
      ORDER BY request.tanggal_request DESC;
    `,
    [req.params.year, req.params.month.toString().padStart(2, "0")],
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });

      res.status(200).json(rows);
    }
  );
});

module.exports = router;
