import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from 'passport-google-oauth2'
import session from "express-session";
import env from "dotenv";
//const env = require('dotenv').config()

const app = express();
const port = 3000;
const saltRounds = 10;




app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "todolist",
  password: process.env.POSTGRESSPASSWORD,
  port: 5432,
});

db.connect();

let currentPersonId = undefined;
let people = [];
let currentPersonTasks = [];
let taskItems = [];

async function getAllPeople() {
  const result = await db.query("SELECT * FROM people ORDER BY id ASC");
  //console.log(result.rows)
  people = []
  result.rows.forEach((person) => {
    people.push(person);
  });

  //console.log(people)

}



async function getCurrentPersonId() {
  const result = await db.query("SELECT * FROM people ORDER BY id ASC");
  //console.log(result.rows)
  
  currentPersonId = result.rows.length === 0 ? 1 : result.rows[0]["id"];
  //console.log(currentPersonId);
}

async function getAllTaskListsFromPerson(personId) {
  const result = await db.query("SELECT * FROM task_list WHERE person_id=$1 ORDER BY creation_timestamp ASC",[personId]);
  currentPersonTasks = result.rows;
  
}


async function getTaskById(taskId){
  const task = await db.query("SELECT * FROM task_list WHERE id=$1",[taskId]);
  return task.rows[0];
}

async function getItemsFromTaskList(taskId){
  const result = await db.query(
    "SELECT C.id AS task_list_id,B.id AS item_id,B.creation_timestamp,C.list_title,B.title FROM items_task as A INNER JOIN items as B ON A.item_id = B.id"+
    " INNER JOIN task_list as C on A.task_id = C.id"+
    " WHERE C.id=$1"+
    " ORDER BY B.creation_timestamp",[taskId]
  );


  return result.rows;
}

async function addNewItemToTaskList(item,timestamp,taskListId){
  const result = await db.query(
    "INSERT INTO items(title,creation_timestamp) VALUES($1,$2)",[item,timestamp]
  );

  let lastItemId = await db.query("SELECT * FROM items WHERE id=(SELECT max(id) FROM items);")
  lastItemId = lastItemId.rows[0]["id"];

  const result2 = await db.query(
     "INSERT INTO items_task(task_id,item_id) VALUES($1,$2)",[taskListId,lastItemId]
  )
}

async function addNewTaskToUser(newTaskTitle,newColor,userId,timestamp){
  const result = await db.query("INSERT INTO task_list(list_title,person_id,creation_timestamp,color) VALUES($1,$2,$3,$4)",[newTaskTitle,userId,timestamp,newColor]);
}

async function deleteTaskList(taskListId){
  const result = await db.query("DELETE FROM items_task WHERE task_id=$1",[taskListId]);
  const result2 = await db.query("DELETE FROM task_list WHERE id=$1",[taskListId])
}



async function removeItemById(id){
  const result = await db.query("DELETE FROM items_task WHERE item_id=$1",[id]);
  const result2 =await db.query("DELETE FROM items WHERE id=$1",[id]);
}


async function updateItem(id,newItemTitle){
  const result = await db.query("UPDATE items SET title=$1 WHERE id=$2",[newItemTitle,id]);
}



app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});


app.get("/main", async(req, res) => {
  //console.log(req.user["id"]);
  // console.log(req.user)
  if(currentPersonId === undefined){
    currentPersonId = 1;
  }
  else{
    currentPersonId = req.user["id"];
  }
  // console.log(currentPersonId);
  // console.log(req.user["name"]);

  //console.log(req.isAuthenticated())

  if (req.isAuthenticated()) {
    
    await getAllTaskListsFromPerson(currentPersonId);
  
    res.render("index_upgrade.ejs", {
      user: req.user,
      currentPersonId: currentPersonId,
      tasks: currentPersonTasks
    });
  } else {
    res.redirect("/login");
  }

});


app.post("/change_user", async(req, res) => {
  const idClicked = req.body.userId;
  currentPersonId = idClicked;
  res.redirect("/main");
});


app.get("/view_task/:id", async(req, res) => {
  if (req.isAuthenticated()) {
    const taskId = parseInt(req.params.id);
    const taskItems = await getItemsFromTaskList(taskId);
    let taskTitle = await getTaskById(taskId);
    taskTitle = taskTitle["list_title"];
    console.log(taskTitle);
    res.render(`view_task.ejs`,{items:taskItems,taskId: taskId, taskTitle: taskTitle,size_items:taskItems.length})
  }else{
    res.redirect("/login");
  }


});



app.get("/add_new_task/:id", async(req, res) => {
  if (req.isAuthenticated()) {
    const userId = parseInt(req.params.id);
    res.render(`add_new_task.ejs`,{userId:userId})
  }else{
    res.redirect("/login");
  }


});


app.post("/add", async(req, res) => {
  if (req.isAuthenticated()) {
    const item = req.body.newItem;
    let timestamp = new Date();
    timestamp = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDay()} ${timestamp.getHours()}:${timestamp.getMinutes()}:${timestamp.getSeconds()}`;
    const taskListId = parseInt(req.body.list);
    await addNewItemToTaskList(item,timestamp,taskListId);
    const taskItems = await getItemsFromTaskList(taskListId);
    res.render(`view_task.ejs`,{items:taskItems,taskId: taskListId,size_items:taskItems.length})
  }else{
    res.redirect("/login");
  }

});

app.post(`/add_new_task_form`, async(req,res)=>{
  if (req.isAuthenticated()) {
    const newTaskTitle = req.body.taskTitle;
    const newColor = req.body.colors;
    const userId = req.body.user_id;
    let timestamp = new Date();
    timestamp = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDay()} ${timestamp.getHours()}:${timestamp.getMinutes()}:${timestamp.getSeconds()}`;
    await addNewTaskToUser(newTaskTitle,newColor,userId,timestamp)
    res.redirect(`/main`);
  }else{
    res.redirect("/login");
  }

})


app.post(`/delete_task/:id`, async(req,res)=>{
  if (req.isAuthenticated()) {
    const taskId = parseInt(req.params.id);
    console.log(taskId);
    await deleteTaskList(taskId);
    res.redirect(`/main`);
  }else{
    res.redirect("/login");
  }

})

app.post(`/remove_item`, async(req,res) => {
  if (req.isAuthenticated()) {
    const itemId = parseInt(req.body["deleteItemId"].split(' ')[0]);
    const taskId = parseInt(req.body["deleteItemId"].split(' ')[1]);
    await removeItemById(itemId);
    res.redirect(`/view_task/${taskId}`)
  }else{
    res.redirect("/login");
  }

})

app.post(`/edit`, async(req,res) => {
  if (req.isAuthenticated()) {
    const itemId = parseInt(req.body["updatedItemId"].split(' ')[0]);
    const taskId = parseInt(req.body["updatedItemId"].split(' ')[1]);
    const newItemTitle = req.body["updatedItemTitle"];
    await updateItem(itemId,newItemTitle);
    res.redirect(`/view_task/${taskId}`)
  }else{
    res.redirect("/login");
  }

});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/main",
    failureRedirect: "/login",
  })
);


app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  const newColor = req.body.colors;

  try {
    const checkResult = await db.query("SELECT * FROM people WHERE name = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO people (name,color, password) VALUES ($1, $2, $3) RETURNING *",
            [email,newColor, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/main");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});



passport.use("local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM people WHERE name = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            //Error with password check
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              //Passed password check
              return cb(null, user);
            } else {
              //Did not pass password check
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);


passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
