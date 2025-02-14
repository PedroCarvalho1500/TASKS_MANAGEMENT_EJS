import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: process.env.POSTGRESSPASSWORD,
  port: 5432,
});

db.connect();

let items = [];

async function getAllItems() {
  const result = await db.query("SELECT * FROM items ORDER BY id ASC");
  console.log(result.rows)
  let currentItems = [];
  result.rows.forEach((item) => {
    currentItems.push(item);
  });

  return currentItems;
}

async function addNewItem(item) {
  try{
    const result = await db.query("INSERT INTO items(title) VALUES($1)",[item]);
  }catch(error){
    console.log(error)
  }
  
}


async function updateItem(id,title) {
  try{
    const result = await db.query("UPDATE items SET title=$1 WHERE id=$2",[title,id]);
  }catch(error){
    console.log(error)
  }
  
}

async function deleteItem(id){
  try{
    const result = await db.query("DELETE FROM items WHERE id=$1",[id]);
  }catch(error){
    console.log(error)
  }
  
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));



app.get("/", async(req, res) => {
  items = await getAllItems();
  //console.log(`ITEMS ${items}`);
  res.render("index.ejs", {
    listTitle: "Today",
    listItems: items,
  });
});

app.post("/add", async(req, res) => {
  const item = req.body.newItem;
  await addNewItem(item);
  res.redirect("/");
});

app.post("/edit", async(req, res) => {
  const newItemTitle = req.body.updatedItemTitle;
  const idToUpdate = req.body.updatedItemId;
  await updateItem(idToUpdate,newItemTitle);
  res.redirect("/");
});

app.post("/delete", async(req, res) => {
  const idToDelete = req.body.deleteItemId;
  await deleteItem(idToDelete);
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
