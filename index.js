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

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.kzmhu.mongodb.net/taskAppDB?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
  

    const db = client.db("taskAppDB");
    const usersCollection = db.collection("users");
    const tasksCollection = db.collection("tasks");

    io.on("connection", (socket) => {
      console.log("Client connected");
      socket.on("disconnect", () => console.log("Client disconnected"));
    });

    const emitUpdatedTasks = async () => {
      try {
        const tasks = await tasksCollection.find().sort({ order: 1 }).toArray();
        io.emit("taskUpdated", tasks);
      } catch (error) {
        console.error("Error emitting updated tasks:", error);
      }
    };


    app.patch("/tasks/reorder", async (req, res) => {
      try {
        const { tasks } = req.body;
    
        if (!Array.isArray(tasks) || tasks.length === 0) {
          return res.status(400).json({ error: "Invalid or empty tasks array" });
        }
    
    
        // Update tasks in database (MongoDB example)
        const bulkOperations = tasks.map((task) => ({
          updateOne: {
            filter: { _id: new ObjectId(task._id) }, // Match by task ID
            update: { $set: { category: task.category, order: task.order } },
          },
        }));
    
        const result = await tasksCollection.bulkWrite(bulkOperations); // Efficient batch update
    
        res.json({ message: "Tasks reordered successfully", result });
      } catch (error) {
        console.error("Error reordering tasks:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    




    

   // Get task by id
   app.get("/tasks/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const task = await tasksCollection.findOne(query);
    res.send(task);
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



    app.post("/users", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const isExist = await usersCollection.findOne({ email });
        if (isExist) return res.status(400).json({ error: "User already exists" });

        const result = await usersCollection.insertOne(req.body);
        io.emit("userAdded", result);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Error adding user" });
      }
    });

    app.get("/users", async (_, res) => {
      try {
        const users = await usersCollection.find({}).toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: "Error fetching users" });
      }
    });

    app.post("/tasks", async (req, res) => {
      try {
        const { title, category } = req.body;
        if (!title || !category) return res.status(400).json({ error: "Title and category are required" });

        const lastTask = await tasksCollection.find().sort({ order: -1 }).limit(1).toArray();
        const newOrder = lastTask.length ? lastTask[0].order + 1 : 0;

        const newTask = { ...req.body, order: newOrder };
        const result = await tasksCollection.insertOne(newTask);

        await emitUpdatedTasks();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Error creating task" });
      }
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


    app.get("/tasks", async (_, res) => {
      try {
        const tasks = await tasksCollection.find().sort({ order: 1 }).toArray();
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: "Error fetching tasks" });
      }
    });

    app.delete("/tasks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await tasksCollection.deleteOne({ _id: new ObjectId(id) });
        if (!result.deletedCount) return res.status(404).json({ error: "Task not found" });

        await emitUpdatedTasks();
        res.json({ message: "Task deleted successfully" });
      } catch (error) {
        res.status(500).json({ error: "Error deleting task" });
      }
    });

   
    
    
    
  

  } catch (error) {
    console.error("Server error:", error);
  }
}
run().catch(console.dir);

app.get("/", (_, res) => res.send("Assignment Job Task server is running..."));
server.listen(port, () => console.log(`Server running on PORT: ${port}`));



