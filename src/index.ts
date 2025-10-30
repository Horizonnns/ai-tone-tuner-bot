import express from "express";
import { router as rewriteRouter } from "./routes/rewrite";

import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use("/api", rewriteRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
