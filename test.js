// const url = "https://i.redd.it/yp6faqyadarc1.jpeg";
// const fileName = "myFile.jpg";

const { createReport } = require("./excelUtil");

// fetch(url).then(async (response) => {
//   const contentType = response.headers.get("content-type");
//   const blob = await response.blob();
//   const file = new File([blob], fileName, { contentType });
//   console.log(file);
// });

const workbook = createReport(
  [
    {
      id_request: 0,
      judul: "This is a request name",
      username: "James",
      tanggal_request: "2024-11-06",
      harga: 100000,
      jumlah: 3,
      project: "Create an application",
      metode_pembayaran: "cash",
      status: "DITERIMA",
    },
  ],
  "November",
  2024
);
workbook.write("Excel.xlsx");
