const excel = require("excel4node");

const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const months = [
  "Januari", // 0: January
  "Februari", // 1: February
  "Maret", // 2: March
  "April", // 3: April
  "Mei", // 4: May
  "Juni", // 5: June
  "Juli", // 6: July
  "Agustus", // 7: August
  "September", // 8: September
  "Oktober", // 9: October
  "November", // 10: November
  "Desember", // 11: December
];

function createWorksheet(request) {
  let workbook = new excel.Workbook();
  let ws = workbook.addWorksheet("Sheet 1");

  // Column Sizing
  //(this is such a shitty method and i hate myself for it asidasoidjasoudjsa;dnasod)
  ws.column(2).setWidth(6 / 10);
  ws.column(3).setWidth(6 / 10);
  ws.column(4).setWidth(82 / 10);
  ws.column(5).setWidth(40 / 10);
  ws.column(6).setWidth(81 / 10);
  ws.column(7).setWidth(144 / 10);
  ws.column(8).setWidth(95 / 10);
  ws.column(9).setWidth(13 / 10);
  ws.column(10).setWidth(10 / 10);
  ws.column(11).setWidth(81 / 10);
  ws.column(12).setWidth(72 / 10);
  ws.column(13).setWidth(10 / 10);
  ws.column(14).setWidth(78 / 10);
  ws.column(15).setWidth(10 / 10);
  ws.column(16).setWidth(105 / 10);
  ws.column(17).setWidth(9 / 10);
  ws.column(18).setWidth(208 / 10);
  ws.column(19).setWidth(5 / 10);
  ws.column(20).setWidth(10 / 10);
  ws.column(21).setWidth(9 / 10);
  ws.column(22).setWidth(109 / 10);
  ws.column(23).setWidth(10 / 10);
  ws.column(24).setWidth(96 / 10);
  ws.column(25).setWidth(58 / 10);
  ws.column(26).setWidth(9 / 10);
  ws.column(27).setWidth(31 / 10);

  // --Content--
  // -Header-
  // Left Padding
  ws.cell(3, 2, 7, 3, true).style({
    border: {
      top: {
        color: "black",
        style: "medium",
      },
      left: {
        color: "black",
        style: "medium",
      },
      bottom: {
        color: "black",
        style: "medium",
      },
    },
  });
  // Header Content
  ws.cell(3, 4, 3, 27, true)
    .string(request.nama_instansi)
    .style({
      border: {
        top: {
          color: "black",
          style: "medium",
        },
        right: {
          color: "black",
          style: "medium",
        },
      },
    });
  ws.cell(4, 4, 7, 27, true)
    .string(request.alamat_instansi)
    .style({
      border: {
        right: { color: "black", style: "medium" },
        bottom: { color: "black", style: "medium" },
      },
      alignment: {
        vertical: "top",
        wrapText: true,
      },
    });
  // -Payment Details-
  // Top Padding
  ws.cell(8, 2, 8, 8, true).style({
    border: {
      left: {
        color: "black",
        style: "medium",
      },
      right: {
        color: "black",
        style: "medium",
      },
    },
  });
  // Left Padding
  ws.cell(9, 2, 15, 3, true).style({
    border: {
      left: {
        color: "black",
        style: "medium",
      },
    },
  });
  // Right Padding
  ws.cell(9, 8, 15, 8).style({
    border: { right: { color: "black", style: "medium" } },
  });
  // Bottom Padding
  ws.cell(16, 2, 16, 8, true).style({
    border: {
      left: { color: "black", style: "medium" },
      bottom: { color: "black", style: "medium" },
      right: { color: "black", style: "medium" },
    },
  });
  // Labels
  ws.cell(9, 4, 9, 5, true).string("Number :");
  ws.cell(11, 4).string("Bank");
  ws.cell(13, 4).string("Cash");
  ws.cell(15, 4).string("Petty Cash");
  //Values
  ws.cell(9, 6, 9, 7, true).string(`${request.id_request}`);
  const checkboxStyle = {
    border: {
      top: { color: "black", style: "thin" },
      bottom: { color: "black", style: "thin" },
      left: { color: "black", style: "thin" },
      right: { color: "black", style: "thin" },
    },
    alignment: {
      horizontal: "center",
    },
  };
  ws.cell(11, 6)
    .string(request.metode_pembayaran === "bank" ? "✓" : "")
    .style(checkboxStyle); // -> Bank
  ws.cell(13, 6)
    .string(request.metode_pembayaran === "cash" ? "✓" : "")
    .style(checkboxStyle); // -> Cash
  ws.cell(15, 6)
    .string(request.metode_pembayaran === "petty cash" ? "✓" : "")
    .style(checkboxStyle); // -> Petty Cash
  // -Credentials-
  // Section Title
  ws.cell(8, 10, 8, 20, true)
    .string("PAYMENT REQUEST")
    .style({
      alignment: { horizontal: "center" },
      font: { bold: true },
      border: {
        left: { color: "black", style: "medium" },
        right: { color: "black", style: "medium" },
      },
      fill: { type: "gradient", bgColor: "#397fbf" },
    });
  // Section Title Margin Bottom
  ws.cell(9, 10, 9, 20, true).style({
    border: {
      left: { color: "black", style: "medium" },
      right: { color: "black", style: "medium" },
    },
  });
  // Padding Left
  ws.cell(10, 10, 16, 10, true).style({
    border: {
      left: { color: "black", style: "medium" },
      bottom: { color: "black", style: "medium" },
    },
  });
  // Padding Right
  ws.cell(10, 20, 16, 20, true).style({
    border: {
      right: { color: "black", style: "medium" },
      bottom: { color: "black", style: "medium" },
    },
  });
  // Section Labels
  ws.cell(10, 11, 10, 12, true).string("Paid to");
  ws.cell(10, 13).string(":");
  ws.cell(12, 11, 12, 12, true).string("Unit Group");
  ws.cell(12, 13).string(":");
  ws.cell(14, 11, 14, 12, true).string("Department");
  ws.cell(14, 13).string(":");
  ws.cell(16, 11, 16, 12, true)
    .string("Project")
    .style({ border: { bottom: { color: "black", style: "medium" } } });
  ws.cell(16, 13)
    .string(":")
    .style({ border: { bottom: { color: "black", style: "medium" } } });
  // Section Content
  const rightBorder = {
    border: { right: { color: "black", style: "medium" } },
  };
  ws.cell(10, 14, 10, 19, true).string(
    `${request.owner} (${request.owner_rekening})`
  );
  ws.cell(12, 14, 12, 19, true).string(request.nama_instansi);
  ws.cell(14, 14, 14, 19, true).string(request.department);
  ws.cell(16, 14, 16, 19, true)
    .string(request.nama_project ?? "-")
    .style({
      border: {
        bottom: { color: "black", style: "medium" },
      },
    });
  // -Date-
  // Left Padding
  ws.cell(8, 21, 16, 21, true).style({
    border: { bottom: { color: "black", style: "medium" } },
  });
  // Bottom Padding
  ws.cell(16, 22, 16, 27, true).style({
    border: {
      bottom: { color: "black", style: "medium" },
      right: { color: "black", style: "medium" },
    },
  });
  // Right Padding
  ws.cell(8, 27, 15, 27, true).style({
    border: { right: { color: "black", style: "medium" } },
  });
  // Date Content
  ws.cell(15, 22).string("Date");
  ws.cell(15, 23).string(":");
  const date = new Date(Date.parse(request.tanggal_request));
  ws.cell(15, 24).string(
    `${days[date.getDay()]} ${date.getDate()} ${
      months[date.getMonth()]
    } ${date.getFullYear()}`
  );
  // Margin Bottom
  ws.cell(17, 2, 17, 27, true).style({
    border: {
      right: { color: "black", style: "medium" },
      left: { color: "black", style: "medium" },
      bottom: { color: "black", style: "medium" },
    },
  });
  ws.cell(18, 2, 18, 27, true).style({
    border: {
      left: { color: "black", style: "medium" },
      right: { color: "black", style: "medium" },
    },
  });
  // -Items List-
  const items = request.items;

  // List Header
  const fullBorderLight = {
    border: {
      top: { color: "black", style: "thin" },
      bottom: { color: "black", style: "thin" },
      right: { color: "black", style: "thin" },
      left: { color: "black", style: "thin" },
    },
  };
  const fullBorderEdge = {
    border: {
      ...fullBorderLight.border,
      right: { color: "black", style: "medium" },
    },
  };
  ws.cell(19, 5, 19, 19, true)
    .style({
      ...fullBorderLight,
      font: { bold: true },
      alignment: { horizontal: "center" },
    })
    .string("DESCRIPTION");
  ws.cell(19, 21, 19, 22, true)
    .style({
      ...fullBorderLight,
      font: { bold: true },
      alignment: { horizontal: "center" },
    })
    .string("AMOUNT");
  ws.cell(20, 21, 20, 22, true).style(fullBorderLight);
  ws.cell(19, 24, 19, 27, true)
    .style({
      ...fullBorderEdge,
      font: { bold: true },
      alignment: { horizontal: "center" },
    })
    .string("PRICE");
  ws.cell(20, 24, 20, 27, true).style(fullBorderEdge);
  // Item Content
  let totalAmount = 0;
  let totalPrice = 0;
  items.forEach((item, i) => {
    const date = new Date(Date.parse(item.tanggal_pembelian));

    ws.cell(21 + i, 5, 21 + i, 19, true)
      .string(
        `${days[date.getDay()]} ${date.getDate()} ${
          months[date.getMonth()]
        } ${date.getFullYear()}` +
          " - " +
          item.nama
      )
      .style(fullBorderLight);
    ws.cell(21 + i, 21, 21 + i, 22, true)
      .number(item.jumlah)
      .style({ ...fullBorderLight, alignment: { horizontal: "center" } });
    ws.cell(21 + i, 24, 21 + i, 27, true)
      .string(
        new Intl.NumberFormat("in-ID", {
          style: "currency",
          currency: "IDR",
        }).format(item.harga)
      )
      .style(fullBorderEdge);

    totalAmount += item.jumlah;
    totalPrice += item.harga;
  });

  listBottom = 21 + items.length;
  ws.cell(listBottom, 5, listBottom, 19, true)
    .string("Jumlah")
    .style({
      ...fullBorderLight,
      font: { bold: true },
      alignment: { horizontal: "center" },
    });
  ws.cell(listBottom, 21, listBottom, 22, true)
    .number(totalAmount)
    .style({ ...fullBorderLight, alignment: { horizontal: "center" } });
  ws.cell(listBottom, 24, listBottom, 27, true)
    .string(
      new Intl.NumberFormat("in-ID", {
        style: "currency",
        currency: "IDR",
      }).format(totalPrice)
    )
    .style(fullBorderEdge);
  // Margin Bottom
  ws.cell(listBottom + 1, 5, listBottom + 2, 27, true).style({
    border: { right: { color: "black", style: "medium" } },
  });

  // -Signatures-
  // Headers
  ws.cell(listBottom + 3, 5, listBottom + 3, 13, true)
    .string("USER")
    .style({
      ...fullBorderLight,
      font: { bold: true },
      alignment: { horizontal: "center" },
    });
  ws.cell(listBottom + 4, 5, listBottom + 4, 7, true)
    .string("REQUEST")
    .style({
      border: {
        left: { color: "black", style: "thin" },
        right: { color: "black", style: "thin" },
      },
      alignment: { horizontal: "center" },
      font: { bold: true },
    });
  ws.cell(listBottom + 4, 8, listBottom + 4, 13, true)
    .string("APPROVE")
    .style({
      border: {
        left: { color: "black", style: "thin" },
        right: { color: "black", style: "thin" },
      },
      alignment: { horizontal: "center" },
      font: { bold: true },
    });
  ws.cell(listBottom + 3, 14, listBottom + 4, 17, true)
    .string("BUDGET CONTROL")
    .style({
      border: {
        top: { color: "black", style: "thin" },
        right: { color: "black", style: "thin" },
      },
      font: { bold: true },
      alignment: { horizontal: "center", vertical: "center" },
    });
  ws.cell(listBottom + 3, 18, listBottom + 4, 19, true)
    .string("APPROVE")
    .style({
      border: {
        top: { color: "black", style: "thin" },
        right: { color: "black", style: "thin" },
      },
      font: { bold: true },
      alignment: { horizontal: "center", vertical: "center" },
    });
  ws.cell(listBottom + 3, 20, listBottom + 3, 27, true)
    .string("NOTE")
    .style({
      ...fullBorderEdge,
      alignment: { horizontal: "center" },
      font: { bold: true },
    });
  // Fields
  const halfBorderBottom = {
    border: {
      right: { color: "black", style: "thin" },
      left: { color: "black", style: "thin" },
      bottom: { color: "black", style: "medium" },
    },
  };
  ws.cell(listBottom + 5, 5, listBottom + 8, 7, true).style({
    border: {
      right: { color: "black", style: "thin" },
      left: { color: "black", style: "thin" },
    },
  });
  ws.cell(listBottom + 9, 5, listBottom + 10, 7, true)
    .string("Tanggal :")
    .style({ ...halfBorderBottom, alignment: { vertical: "top" } });
  ws.cell(listBottom + 5, 8, listBottom + 8, 13, true).style({
    border: {
      right: { color: "black", style: "thin" },
      left: { color: "black", style: "thin" },
    },
  });
  ws.cell(listBottom + 9, 8, listBottom + 10, 13, true)
    .string("Tanggal :")
    .style({ ...halfBorderBottom, alignment: { vertical: "top" } });
  ws.cell(listBottom + 5, 14, listBottom + 8, 17, true).style({
    border: {
      right: { color: "black", style: "thin" },
      left: { color: "black", style: "thin" },
    },
  });
  ws.cell(listBottom + 9, 14, listBottom + 10, 17, true)
    .string("Tanggal :")
    .style({ ...halfBorderBottom, alignment: { vertical: "top" } });
  ws.cell(listBottom + 5, 18, listBottom + 8, 19, true).style({
    border: {
      right: { color: "black", style: "thin" },
      left: { color: "black", style: "thin" },
    },
  });
  ws.cell(listBottom + 9, 18, listBottom + 10, 19, true)
    .string("Tanggal :")
    .style({ ...halfBorderBottom, alignment: { vertical: "top" } });
  ws.cell(listBottom + 4, 20, listBottom + 10, 27, true)
    .string("Request notes go here")
    .style({
      border: {
        right: { color: "black", style: "medium" },
        bottom: { color: "black", style: "medium" },
      },
      alignment: { horizontal: "center", vertical: "center" },
    });
  // Padding Left
  ws.cell(19, 2, 19 + 12 + items.length, 4, true).style({
    border: {
      left: { color: "black", style: "medium" },
      bottom: { color: "black", style: "medium" },
    },
  });

  return workbook;
}

module.exports = { createWorksheet };
