import express from "express";

const app = express();

app.use(express.static("./fe/public"));

app.listen(process.env.PORT);