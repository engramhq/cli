import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("Hello Express Updated");
})

app.listen(process.env.PORT || 3000, () => {
  console.log(`Running on port ${process.env.PORT}`)
});