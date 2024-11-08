const fs = require("fs");

var readHTMLFile = function (path, callback) {
  fs.readFile(path, { encoding: "utf-8" }, function (err, html) {
    if (err) {
      callback(err);
    } else {
      callback(null, html);
    }
  });
};

const originJSON = `
{
        "id_request": 9,
        "judul": "James' Request",
        "deskripsi": "I would like some money please",
        "metode_pembayaran": "cash",
        "nama_project": "My Project",
        "nama_departemen": "HR",
        "nama_instansi": "PT Quinsis Lintas Mitra",
        "owner_username": "James",
        "rekening": "1234567890",
        "owner_email": "james@gmail.com",
        "s_app_diterima": 1,
        "s_app_catatan": "James the supervisor approves of this",
        "s_app_tanggal": "2024-10-03T17:00:00.000Z",
        "s_app_username": "James",
        "f_app_diterima": 1,
        "f_app_catatan": "James the supervisor approves of this",
        "f_app_tanggal": "2024-10-03T17:00:00.000Z",
        "f_app_username": "James",
        "r_app_diterima": 1,
        "r_app_catatan": "James the supervisor approves of this",
        "r_app_tanggal": "2024-10-03T17:00:00.000Z",
        "r_app_username": "James"
    }
`;
const reqData = JSON.parse(originJSON);

const emailData = {};
emailData.requestAcceptance = "DITERIMA";

emailData.judul = reqData.judul;
emailData.deskripsi = reqData.deskripsi;
emailData.metode_pembayaran = reqData.metode_pembayaran;
emailData.jenis_request = reqData.id_project ? "Project Based" : "Operasional";
emailData.nama_project = reqData.nama_project ?? "-";
emailData.nama_departemen = reqData.nama_project
  ? "-"
  : reqData.nama_departemen;
emailData.nama_instansi = reqData.nama_instansi;
emailData.username = reqData.owner_username;
emailData.rekening = reqData.owner_rekening;

emailData.supervisor_hide =
  reqData.s_app_diterima === null || reqData.s_app_diterima === undefined
    ? "hidden=''"
    : "";
emailData.supervisor_catatan = reqData.s_app_catatan;
emailData.supervisor_date = reqData.s_app_tanggal;
emailData.supervisor_approval = reqData.s_app_diterima
  ? "Disetujui"
  : "Ditolak";
emailData.supervisor_name = reqData.s_app_username;

emailData.finance_hide =
  reqData.f_app_diterima === null || reqData.f_app_diterima === undefined
    ? "hidden=''"
    : "";
emailData.finance_catatan = reqData.f_app_catatan;
emailData.finance_date = reqData.f_app_tanggal;
emailData.finance_approval = reqData.f_app_diterima ? "Disetujui" : "Ditolak";
emailData.finance_name = reqData.f_app_username;

reqData.r_app_diterima = null;

emailData.realisasi_hide =
  reqData.r_app_diterima === null || reqData.r_app_diterima === undefined
    ? "hidden"
    : "";
emailData.realisasi_catatan = reqData.r_app_catatan;
emailData.realisasi_date = reqData.r_app_tanggal;
emailData.realisasi_approval = reqData.r_app_diterima ? "Disetujui" : "Ditolak";
emailData.realisasi_name = reqData.r_app_username;

console.log(emailData);

readHTMLFile(__dirname + "/EmailTemplate.html", (err, html) => {
  if (err) return console.log(err);

  let data = [];
  Object.keys(emailData).forEach((k) => {
    data.push({ key: k, value: emailData[k] });
  });

  let htmlSplit = html.split("$");
  htmlSplit = htmlSplit.map((s) => {
    const dataIndex = data.findIndex((d) => d.key === s);
    if (dataIndex !== -1) return data[dataIndex].value;
    else return s;
  });

  const formattedHTML = htmlSplit.join("");

  fs.writeFile("emailresulttest.html", formattedHTML, (err) => {
    if (err) return console.log(err);
    console.log("Created HTML file");
  });
});
