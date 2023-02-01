import { MongoClient } from "mongodb";
import express from "express";
import dotenv from "dotenv";

async function run() {
  dotenv.config();

  const client = new MongoClient(
    process.env.DB_URI || "mongodb://127.0.0.1:27017"
  );
  await client.connect();

  const db = client.db();
  const PageView = db.collection("pageviews");

  const app = express();

  app.use(express.static("./fe/public"));

  app.get("/count", async (req, res) => {
    await PageView.insertOne({
      path: req.path,
    });

    const count = await PageView.countDocuments({});

    res.send(`Views: ${count}`);
  });

  app.listen(process.env.PORT);
}

run();
