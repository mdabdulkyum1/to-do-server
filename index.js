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

    // Emit updated tasks list
    async function emitUpdatedTasks() {
      const tasks = await tasksCollection.find().sort({ order: 1 }).toArray();
      io.emit("taskUpdated", tasks);
    }

    // Create a new user
    app.post("/users", async (req, res) => {
      try {
        const userInfo = req.body;
        const email = userInfo?.email;
        const query = { email };

        const isExist = await usersCollection.findOne(query);
        if (isExist) {
          return res.status(400).send("User already has an account");
        }

        const userWithRole = { ...userInfo };
        const result = await usersCollection.insertOne(userWithRole);
        io.emit("userAdded", result);
        res.send(result);
      } catch (error) {
        res.status(500).send("Error adding user");
      }
    });

    // Get users
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });

    // Create task
    app.post("/tasks", async (req, res) => {
      try {
        const task = req.body;

        const lastTask = await tasksCollection.find().sort({ order: -1 }).limit(1).toArray();
        const newOrder = lastTask.length === 0 ? 0 : lastTask[0].order + 1;

        const newTask = { ...task, order: newOrder };

        const result = await tasksCollection.insertOne(newTask);
        await emitUpdatedTasks();
        res.send(result);
      } catch (error) {
        res.status(500).send("Error creating task");
      }
    });

    // Get tasks
    app.get("/tasks", async (req, res) => {
      const tasks = await tasksCollection.find().sort({ order: 1 }).toArray();
      res.send(tasks);
    });

    // Get task by id
    app.get("/tasks/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const task = await tasksCollection.findOne(query);
      res.send(task);
    });

    // Delete task
    app.delete("/tasks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await tasksCollection.deleteOne(query);

        await emitUpdatedTasks();
        res.send(result);
      } catch (error) {
        res.status(500).send("Error deleting task");
      }
    });

    // Update task
    app.patch("/tasks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedTask = req.body;
        const query = { _id: new ObjectId(id) };
        const newValues = { $set: updatedTask };
        const result = await tasksCollection.updateOne(query, newValues);

        await emitUpdatedTasks();
        res.send(result);
      } catch (error) {
        res.status(500).send("Error updating task");
      }
    });

    // Update task order
    app.patch("/tasks/reorder", async (req, res) => {
      try {
        const { reorderedTasks } = req.body; // Array of reordered tasks with updated order values

        const bulkOperations = reorderedTasks.map((task) => ({
          updateOne: {
            filter: { _id: new ObjectId(task._id) },
            update: { $set: { order: task.order } },
          },
        }));

        await tasksCollection.bulkWrite(bulkOperations);
        await emitUpdatedTasks();

        res.send({ message: "Task order updated successfully" });
      } catch (error) {
        console.error("Error updating task order:", error);
        res.status(500).send("Error updating task order");
      }
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
