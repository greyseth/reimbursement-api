const fs = require("fs");
const nodemailer = require("nodemailer");

var readHTMLFile = function (path, callback) {
  fs.readFile(path, { encoding: "utf-8" }, function (err, html) {
    if (err) {
      callback(err);
    } else {
      let formattedHTML = html;

      // Change values in HTML template with actual variable values

      callback(null, formattedHTML);
    }
  });
};

const sendEmail = function (destinationAddress, values, callback) {
  readHTMLFile(__dirname + "/EmailTemplate.html", (err, html) => {
    if (err) {
      console.log(err);
      return;
    }
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "anargya2gilland@gmail.com",
        pass: "sirb ihyw tiez avrb ",
      },
    });

    // Generates HTML based on value parameters
    let data = [];
    Object.keys(values).forEach((k) => {
      data.push({ key: k, value: values[k] });
    });

    let insertedValues = html.split("$");
    insertedValues = insertedValues.map((v) => {
      const dataIndex = data.findIndex((d) => d.key === v);
      if (dataIndex !== -1) return data[dataIndex].value;
      else return v;
    });

    const joinedHTML = insertedValues.join("");

    var mailOptions = {
      from: "anargya2gilland@gmail.com",
      // TODO: Change this value to destinationAddress
      to: "anargya2gilland@gmail.com",
      subject: "Review Request Reimbursement",
      html: joinedHTML,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) callback(error);
      else callback(null, info);
    });
  });
};

module.exports = { sendEmail };
