const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const userRouter = require("./routes/user");
const projectRouter = require("./routes/project");
const projectActivityRouter = require("./routes/project_activity");
const requestRouter = require("./routes/request");
const approvalRouter = require("./routes/approval");
const adminRouter = require("./routes/admin");
const miscRouter = require("./routes/misc");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
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
app.use("/projects/activities", projectActivityRouter);
app.use("/requests", requestRouter);
app.use("/approval", approvalRouter);
app.use("/admin", adminRouter);
app.use("/", miscRouter);

app.listen(3001, () => {
  console.log("server is running");
});
