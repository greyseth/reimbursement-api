const express = require("express");
const router = express.Router();

const connection = require("../db");
const projectOwnerVerify = require("../middlewares/projectOwnerVerify");
const userVerify = require("../middlewares/userVerify");

router.get("/columns", async (req, res) => {
  connection.query(`SELECT * FROM project_columns;`, (err, rows, fields) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
});

const projectMemberVerify = (req, res, next) => {
  if (!req.body.id_project)
    return res.status(400).json({ error: "Missing id_project parameter" });
  connection.query(
    `
        SELECT user.id_user, project.id_project FROM user_project 
        LEFT JOIN user ON user_project.id_user = user.id_user 
        LEFT JOIN project ON user_project.id_project = project.id_project 
        WHERE user.login_token = '${req.headers.account_token}' AND project.id_project = ${req.body.id_project}`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length < 1)
        return res.status(401).json({ error: "Unauthorized access" });

      res.locals.id_user = rows[0].id_user;
      next();
    }
  );
};

// Create
router.post("/create", projectMemberVerify, async (req, res) => {
  const content = req.body;
  if (!content.column_id || !content.title)
    return res
      .status(400)
      .json({ error: "Missing column_id and/or title parameters" });

  connection.query(
    `INSERT INTO project_activity(column_id, importance, title, description, id_project, creator_id) 
      VALUES(${content.column_id}, ${content.importance ?? 0}, '${
      content.title
    }', '${content.description ?? ""}', ${content.id_project}, ${
      res.locals.id_user
    })`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.post("/create/task", projectMemberVerify, async (req, res) => {
  const content = req.body;
  if (!content.item_id || !content.content)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `INSERT INTO project_activity_task(item_id, content, done) 
    VALUES(${content.item_id}, '${content.content}', ${
      content.done ? "TRUE" : "FALSE"
    });`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      return res.status(200).json({ success: true });
    }
  );
});

// Read
router.get("/get/:id_project", async (req, res) => {
  connection.query(
    `SELECT * FROM project_activity WHERE id_project = ${req.params.id_project};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows);
    }
  );
});

router.get("/get/details/:item_id", async (req, res) => {
  connection.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: err.message });

    let itemDetails = {};
    let tasks = [];
    let members = [];

    connection.query(
      `SELECT project_activity.*, user.username AS creator_username FROM project_activity 
      LEFT JOIN user ON project_activity.creator_id = user.id_user 
      WHERE item_id = ${req.params.item_id};`,
      (err, rows, fields) => {
        if (err)
          return connection.rollback(() =>
            res.status(500).json({ error: err.message })
          );
        if (rows.length < 1)
          return connection.rollback(() =>
            res.status(401).json({ error: "Invalid item_id" })
          );

        itemDetails = rows[0];

        connection.query(
          `SELECT * FROM project_activity_task WHERE item_id = ${req.params.item_id};`,
          (err, rows, fields) => {
            if (err)
              return connection.rollback(() =>
                res.status(500).json({ error: err.message })
              );
            tasks = rows;

            connection.query(
              `SELECT user.id_user, user.username FROM project_activity_member 
          LEFT JOIN user ON project_activity_member.id_user = user.id_user
          WHERE project_activity_member.item_id = ${req.params.item_id} GROUP BY user.id_user;`,
              (err, rows, fields) => {
                if (err)
                  return connection.rollback(() =>
                    res.status(500).json({ error: err.message })
                  );
                members = rows;

                connection.commit((err) => {
                  if (err)
                    return connection.rollback(() =>
                      res.status(500).json({ error: err.message })
                    );
                  res.status(200).json({
                    details: itemDetails,
                    tasks: tasks,
                    members: members,
                  });
                });
              }
            );
          }
        );
      }
    );
  });
});

// Update
router.put("/update/:item_id", projectMemberVerify, async (req, res) => {
  const content = req.body;
  if (!content.column_id || content.importance === undefined || !content.title)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  connection.query(
    `UPDATE project_activity SET column_id = ${
      content.column_id
    }, importance = ${content.importance}, 
    title = '${content.title}', description = '${content.description ?? ""}' 
    WHERE item_id = ${req.params.item_id};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.put("/tasks/:task_id", projectMemberVerify, async (req, res) => {
  console.log(
    `UPDATE project_activity_task SET done = ${
      req.body.done ? "TRUE" : "FALSE"
    } WHERE task_id = ${req.params.task_id};`
  );
  connection.query(
    `UPDATE project_activity_task SET done = ${
      req.body.done ? "TRUE" : "FALSE"
    } WHERE task_id = ${req.params.task_id};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.put("/members", projectMemberVerify, async (req, res) => {
  const content = req.body;
  if (!content.item_id || !content.members)
    return res
      .status(400)
      .json({ error: "Missing one or more required parameters" });

  if (content.members.length < 1)
    return res.status(400).json({ error: "Members parameter cannot be empty" });

  connection.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: err.message });

    connection.query(
      `DELETE FROM project_activity_member WHERE item_id = ${content.item_id};`,
      (err, rows, fields) => {
        if (err)
          return connection.rollback(() =>
            res.status(400).json({ error: err.message })
          );

        let insertQuery =
          "INSERT INTO project_activity_member(id_user, item_id) VALUES";
        content.members.forEach((m, i) => {
          insertQuery += `(${m}, ${content.item_id})${
            i === content.members.length - 1 ? ";" : ","
          }`;
        });

        connection.query(insertQuery, (err, rows, fields) => {
          if (err)
            return connection.rollback(() =>
              res.status(500).json({ error: err.message })
            );

          connection.commit((err) => {
            if (err) return res.status(400).json({ error: err.message });
            res.status(200).json({ success: true });
          });
        });
      }
    );
  });
});

// Delete
router.delete("/:item_id", projectMemberVerify, async (req, res) => {
  connection.query(
    `DELETE FROM project_activity WHERE item_id = ${req.params.item_id};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

router.delete("/task/:task_id", projectMemberVerify, async (req, res) => {
  connection.query(
    `DELETE FROM project_activity_task WHERE task_id = ${req.params.task_id};`,
    (err, rows, fields) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    }
  );
});

module.exports = router;
