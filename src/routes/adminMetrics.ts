// src/routes/adminMetrics.ts
import express from "express";
import { getMetrics } from "../services/metricsService";

const router = express.Router();

/**
 * GET /api/admin/metrics?key=SECRET
 * - возвращает подробный JSON метрик
 */
router.get("/metrics", async (req, res) => {
  const key = req.query.key as string;
  const secret = process.env.ADMIN_METRICS_KEY;

  if (!secret || key !== secret) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const data = await getMetrics();
    res.json(data);
  } catch (err: any) {
    console.error("adminMetrics error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
