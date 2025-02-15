import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

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
  people = []
  
  currentPersonId = result.rows.length === 0 ? 1 : result.rows[0]["id"];
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

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.get("/", async(req, res) => {
  await getAllPeople();
  if (currentPersonId == undefined || people.length === 0){
    await getCurrentPersonId();
  }
  
  await getAllTaskListsFromPerson(currentPersonId);

  res.render("index_upgrade.ejs", {
    users: people,
    currentPersonId: currentPersonId,
    tasks: currentPersonTasks
  });
});


app.post("/change_user", async(req, res) => {
  const idClicked = req.body.userId;
  currentPersonId = idClicked;
  res.redirect("/");
});


app.get("/view_task/:id", async(req, res) => {
  const taskId = parseInt(req.params.id);
  const taskItems = await getItemsFromTaskList(taskId);
  let taskTitle = await getTaskById(taskId);
  taskTitle = taskTitle["list_title"];
  console.log(taskTitle);
  res.render(`view_task.ejs`,{items:taskItems,taskId: taskId, taskTitle: taskTitle,size_items:taskItems.length})

});



app.get("/add_new_task/:id", async(req, res) => {
  const userId = parseInt(req.params.id);
  res.render(`add_new_task.ejs`,{userId:userId})

});


app.post("/add", async(req, res) => {
  const item = req.body.newItem;
  let timestamp = new Date();
  timestamp = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDay()} ${timestamp.getHours()}:${timestamp.getMinutes()}:${timestamp.getSeconds()}`;
  const taskListId = parseInt(req.body.list);
  await addNewItemToTaskList(item,timestamp,taskListId);
  const taskItems = await getItemsFromTaskList(taskListId);
  res.render(`view_task.ejs`,{items:taskItems,taskId: taskListId,size_items:taskItems.length})
});

app.post(`/add_new_task_form`, async(req,res)=>{
  const newTaskTitle = req.body.taskTitle;
  const newColor = req.body.colors;
  const userId = req.body.user_id;
  let timestamp = new Date();
  timestamp = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDay()} ${timestamp.getHours()}:${timestamp.getMinutes()}:${timestamp.getSeconds()}`;
  await addNewTaskToUser(newTaskTitle,newColor,userId,timestamp)
  res.redirect(`/`);
})


app.post(`/delete_task/:id`, async(req,res)=>{
  const taskId = parseInt(req.params.id);
  console.log(taskId);
  await deleteTaskList(taskId);
  res.redirect(`/`);
})

app.post(`/remove_item`, async(req,res) => {
  const itemId = parseInt(req.body["deleteItemId"].split(' ')[0]);
  const taskId = parseInt(req.body["deleteItemId"].split(' ')[1]);
  await removeItemById(itemId);
  res.redirect(`/view_task/${taskId}`)
})

app.post(`/edit`, async(req,res) => {
  const itemId = parseInt(req.body["updatedItemId"].split(' ')[0]);
  const taskId = parseInt(req.body["updatedItemId"].split(' ')[1]);
  const newItemTitle = req.body["updatedItemTitle"];
  await updateItem(itemId,newItemTitle);
  res.redirect(`/view_task/${taskId}`)
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
