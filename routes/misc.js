const express = require("express");
const router = express.Router();
const path = require("path");
const excel = require("excel4node");

const connection = require("../db");
const { createWorksheet } = require("../excelutil");
const { hostname } = require("os");

router.get("/instansi", async (req, res) => {
  connection.query(`SELECT * FROM instansi;`, (err, rows, fields) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
});

router.get("/id/:id_instansi", async (req, res) => {
  connection.query(
    `SELECT * FROM instansi WHERE id_instansi = ${req.params.id_instansi};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1) return res.sendStatus(201);
      res.status(200).json(rows[0]);
    }
  );
});

router.get("/name/:name", async (req, res) => {
  connection.query(
    `SELECT * FROM instansi WHERE nama = '${req.params.name}';`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1) return res.sendStatus(201);
      res.status(200).json(rows[0]);
    }
  );
});

module.exports = router;
