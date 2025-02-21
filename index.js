const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const http = require("http");
const socketIo = require("socket.io");
require("dotenv").config();

const port = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.kzmhu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const usersCollection = client.db("taskAppDB").collection("users");
    const tasksCollection = client.db("taskAppDB").collection("tasks");

    // Socket.io connection
    io.on("connection", (socket) => {
      console.log("A client connected");

      socket.on("disconnect", () => {
        console.log("Client disconnected");
      });
    });

    // Create a new user
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const email = userInfo?.email;
      const query = { email };

      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        return res.send("User already has an account");
      }
      const userWithRole = { ...userInfo, role: "student" };
      const result = await usersCollection.insertOne(userWithRole);

      // Emit event to notify clients about new user
      io.emit("userAdded", result);
      res.send(result);
    });

    // Get users
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });

    // Task related apis
    app.post("/tasks", async (req, res) => {
      const task = req.body;
      const result = await tasksCollection.insertOne(task);

      // Emit event to notify clients about new task
      io.emit("taskUpdated", result);
      res.send(result);
    });

    // get tasks
    app.get("/tasks", async (req, res) => {
      const tasks = await tasksCollection.find({}).toArray();
      res.send(tasks);
    });

    // get task by id
    app.get("/tasks/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const task = await tasksCollection.findOne(query);
      res.send(task);
    });

    // delete task
    app.delete("/tasks/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await tasksCollection.deleteOne(query);

      // Emit event to notify clients about task deletion
      io.emit("taskUpdated", result);
      res.send(result);
    });

    // update task
    app.patch("/tasks/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedTask = req.body;
      const newValues = { $set: updatedTask };
      const result = await tasksCollection.updateOne(query, newValues);

      // Emit event to notify clients about task update
      io.emit("taskUpdated", result);
      res.send(result);
    });







  } catch (error) {
    console.error("Error in server:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Assignment Job Task server is running...");
});

server.listen(port, () => {
  console.log(`Server running on PORT: ${port}`);
});
