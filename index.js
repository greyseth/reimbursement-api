const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const userRouter = require("./routes/user");
const projectRouter = require("./routes/project");
const requestRouter = require("./routes/request");
const approvalRouter = require("./routes/approval");
const miscRouter = require("./routes/misc");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(function (req, res, next) {
  if (!req.headers.account_token)
    return res.status(400).json({ error: "Missing 'account_token' header" });
  next();
});

app.get("/", async (req, res) => {
  res.status(200).send("Server is up and good!");
});

app.use("/users", userRouter);
app.use("/projects", projectRouter);
app.use("/requests", requestRouter);
app.use("/approval", approvalRouter);
app.use("/misc", miscRouter);

app.listen(3000, () => {
  console.log("server is running");
});
