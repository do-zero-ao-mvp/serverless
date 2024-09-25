import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as cors from "cors";
// import { Pool } from "pg";
// import { Request, Response, NextFunction } from "express";
// import Stripe from "stripe";

// PostgreSQL client setup
// const pool = new Pool({
//   user: "",
//   host: "",
//   database: "",
//   password: "",
//   port: 5432,
// });

// In-memory store for rate limiting
// const rateLimitStore: { [key: string]: number } = {};

// Initialize CORS middleware
const corsHandler = cors({ origin: true });

// Rate limiter middleware
// const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
//   const clientIp = req.ip; // Use client's IP address for rate limiting
//   const now = Date.now();
//   const lastSaveTime = rateLimitStore[clientIp || Math.random().toString()];

//   if (lastSaveTime && now - lastSaveTime < 60 * 1000) {
//     res
//       .status(429)
//       .send("Rate limit exceeded. Please wait a minute before saving again.");
//     return;
//   }

//   rateLimitStore[clientIp || Math.random().toString()] = now;
//   next();
// };

export const saveData = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    logger.info(`Received data`);

    return res.status(200).send({
      message: "Data received successfully",
      timestamp: new Date(),
    });
  });
  return;
});

export const listData = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      
      // Mock Data
      const data = [
        {
          id: 1,
          name: "John Doe",
          totalEarned: "R$100",
          location: "Brazil",
        },
        {
          id: 2,
          name: "Jane Doe",
          totalEarned: "R$200",
          location: "USA",
        },
      ];

      return res.status(200).json(data);
    } catch (error) {
      logger.error("Error fetching data", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});