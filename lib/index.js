"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveMessages = exports.processStripeCheckout = exports.getAverageRatingsAndNotesGroupedByLocation = exports.getAverageRatingsAndNotes = exports.getPlacesByLocation = exports.getAllPlaces = exports.savePlace = exports.deleteHighEarnings = exports.listLocationData = exports.handleLocationData = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const cors = require("cors");
const axios_1 = require("axios");
const pg_1 = require("pg");
// Initialize CORS middleware
const corsHandler = cors({ origin: true });
// PostgreSQL client setup
const pool = new pg_1.Pool({
    user: "postgres",
    host: "35.224.74.217",
    database: "postgres",
    password: "Cocozinho1!",
    port: 5432,
});
// In-memory store for rate limiting
const rateLimitStore = {};
const stripe_1 = require("stripe");
const rateLimiter = (req, res, next) => {
    const clientIp = req.ip; // Use client's IP address for rate limiting
    const now = Date.now();
    const lastSaveTime = rateLimitStore[clientIp || Math.random().toString()];
    if (lastSaveTime && now - lastSaveTime < 60 * 1000) {
        res
            .status(429)
            .send("Rate limit exceeded. Please wait a minute before saving again.");
        return;
    }
    rateLimitStore[clientIp || Math.random().toString()] = now;
    next();
};
exports.handleLocationData = (0, https_1.onRequest)((req, res) => {
    corsHandler(req, res, async () => {
        const { latitude, longitude } = req.body;
        if (latitude === undefined || longitude === undefined) {
            return res.status(400).send("Latitude and longitude are required");
        }
        rateLimiter(req, res, async () => {
            try {
                const { latitude, longitude, totalearned, timestarted, timeended, day, } = req.body;
                if (typeof latitude !== "number" ||
                    typeof longitude !== "number" ||
                    typeof totalearned !== "string" ||
                    typeof timestarted !== "string" ||
                    typeof timeended !== "string" ||
                    typeof day !== "string") {
                    return res.status(400).send("Invalid input data");
                }
                logger.info(`Received data - Latitude: ${latitude}, Longitude: ${longitude}, Total Earned: ${totalearned}`);
                // Fetch city name from geocoding API
                const apiKey = "66e41148d02fc284382092xize8c636";
                const geocodeUrl = `https://geocode.maps.co/reverse?lat=${latitude}&lon=${longitude}&api_key=${apiKey}`;
                const response = await axios_1.default.get(geocodeUrl);
                const city = response.data.address.city ||
                    response.data.address.state ||
                    response.data.address.county ||
                    response.data.address.country ||
                    "Unknown";
                // Save data to PostgreSQL
                const query = `
          INSERT INTO locationData (latitude, longitude, totalEarned, timeStarted, timeEnded, city, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
                const values = [
                    latitude,
                    longitude,
                    totalearned,
                    timestarted,
                    timeended,
                    city,
                    new Date(),
                ];
                await pool.query(query, values);
                return res.status(200).send({
                    latitude,
                    longitude,
                    totalearned,
                    timestarted,
                    timeended,
                    city,
                    timestamp: new Date(),
                });
            }
            catch (error) {
                logger.error("Error processing request", error);
                return res.status(500).send("Internal Server Error");
            }
        });
        return;
    });
});
exports.listLocationData = (0, https_1.onRequest)((req, res) => {
    corsHandler(req, res, async () => {
        try {
            // const now = Date.now();
            // // Check if cache is valid
            // if (cache.data && cache.data.length > 0) {
            //   logger.info(
            //     `Returning cached data. Cache size: ${
            //       cache.data.length
            //     }, last updated at: ${new Date(cache.timestamp).toLocaleString()}`
            //   );
            //   res.status(200).json(cache.data);
            //   return;
            // }
            // Fetch data from PostgreSQL
            const result = await pool.query("SELECT * FROM locationData");
            const data = result.rows;
            logger.info(`Returning ${data.length} records.`);
            // // Update cache
            // cache.data = data;
            // cache.timestamp = now;
            return res.status(200).json(data);
        }
        catch (error) {
            logger.error("Error fetching data", error);
            return res.status(500).send("Internal Server Error");
        }
    });
});
exports.deleteHighEarnings = (0, https_1.onRequest)((req, res) => {
    corsHandler(req, res, async () => {
        try {
            const threshold = 100; // R$100
            // Delete documents with totalEarned greater than 100
            const query = `
        DELETE FROM locationData
        WHERE CAST(REGEXP_REPLACE(totalEarned, '[^0-9]', '', 'g') AS INTEGER) > $1
      `;
            await pool.query(query, [threshold]);
            res
                .status(200)
                .send("Documents with totalEarned greater than R$100 have been deleted");
        }
        catch (error) {
            logger.error("Error deleting documents", error);
            res.status(500).send("Internal Server Error");
        }
    });
});
exports.savePlace = (0, https_1.onRequest)((req, res) => {
    corsHandler(req, res, async () => {
        rateLimiter(req, res, async () => {
            try {
                const place = req.body;
                // Validate the Place object
                if (typeof place.latitude !== "number" ||
                    typeof place.longitude !== "number") {
                    res.status(400).send("Invalid input data");
                    return;
                }
                // Save Place to PostgreSQL
                const query = `
          INSERT INTO placeRating (latitude, longitude, name, cleanrating, facilitiesrating, privacyrating, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `;
                const values = [
                    place.latitude,
                    place.longitude,
                    place.name,
                    place.cleanRating,
                    place.facilitiesRating,
                    place.privacyRating,
                    place.notes,
                ];
                const result = await pool.query(query, values);
                // Invalidate cache
                // ratingsCache.data = null;
                res
                    .status(200)
                    .send({ message: "Place saved successfully", id: result.rows[0].id });
            }
            catch (error) {
                logger.error("Error saving place", error);
                res.status(500).send("Internal Server Error");
            }
        });
    });
});
exports.getAllPlaces = (0, https_1.onRequest)((req, res) => {
    corsHandler(req, res, async () => {
        try {
            const result = await pool.query("SELECT * FROM placeRating");
            const places = result.rows;
            res.status(200).json(places);
        }
        catch (error) {
            logger.error("Error fetching places", error);
            res.status(500).send("Internal Server Error");
        }
    });
});
exports.getPlacesByLocation = (0, https_1.onRequest)((req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { latitude, longitude } = req.body;
            if (typeof latitude !== "number" || typeof longitude !== "number") {
                res.status(400).send("Invalid input data");
                return;
            }
            const query = `
        SELECT * FROM placeRating
        WHERE latitude = $1 AND longitude = $2
      `;
            const values = [latitude, longitude];
            const result = await pool.query(query, values);
            const places = result.rows;
            res.status(200).json(places);
        }
        catch (error) {
            logger.error("Error fetching places by location", error);
            res.status(500).send("Internal Server Error");
        }
    });
});
exports.getAverageRatingsAndNotes = (0, https_1.onRequest)((req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { latitude, longitude } = req.body;
            if (latitude === undefined || longitude === undefined) {
                return res.status(400).send("Latitude and longitude are required");
            }
            const query = `
        SELECT 
          AVG(cleanrating) as averageCleanRating,
          AVG(privacyrating) as averagePrivacyRating,
          AVG(facilitiesrating) as averageFacilitiesRating,
          ARRAY_AGG(notes) as notes
        FROM placeRating
        WHERE latitude = $1 AND longitude = $2
      `;
            const values = [latitude, longitude];
            const result = await pool.query(query, values);
            const { averageCleanRating, averagePrivacyRating, averageFacilitiesRating, notes, } = result.rows[0];
            return res.status(200).json({
                latitude,
                longitude,
                averageCleanRating,
                averagePrivacyRating,
                averageFacilitiesRating,
                notes,
            });
        }
        catch (error) {
            logger.error("Error fetching average ratings and notes", error);
            return res.status(500).send("Internal Server Error");
        }
    });
});
exports.getAverageRatingsAndNotesGroupedByLocation = (0, https_1.onRequest)((req, res) => {
    corsHandler(req, res, async () => {
        try {
            // const now = Date.now();
            // const cacheDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
            // // Check if cache is valid
            // if (
            //   ratingsCache.data &&
            //   now - ratingsCache.lastUpdated < cacheDuration
            // ) {
            //   logger.info(
            //     "Returning cached data, minutes to cache expiration:",
            //     (cacheDuration - (now - ratingsCache.lastUpdated)) / 60000
            //   );
            //   return res.status(200).json(ratingsCache.data);
            // }
            const query = `
          SELECT 
            latitude,
            longitude,
            name,
            AVG(cleanrating) as averagecleanrating,
            AVG(privacyrating) as averageprivacyrating,
            AVG(facilitiesrating) as averagefacilitiesrating,
            ARRAY_AGG(notes) as notes
          FROM placerating
          GROUP BY latitude, longitude, name
        `;
            const result = await pool.query(query);
            const results = result.rows.reduce((acc, row) => {
                const key = `${row.latitude},${row.longitude}`;
                acc[key] = {
                    name: row.name,
                    latitude: row.latitude,
                    longitude: row.longitude,
                    cleanRating: row.averagecleanrating,
                    privacyRating: row.averageprivacyrating,
                    facilitiesRating: row.averagefacilitiesrating,
                    notes: row.notes,
                };
                return acc;
            }, {});
            // // Update cache
            // ratingsCache.data = results;
            // ratingsCache.lastUpdated = now;
            return res.status(200).json(results);
        }
        catch (error) {
            logger.error("Error fetching average ratings and notes grouped by location", error);
            return res.status(500).send("Internal Server Error");
        }
    });
});
exports.processStripeCheckout = (0, https_1.onRequest)((req, res) => {
    corsHandler(req, res, async () => {
        logger.info("Received Stripe checkout session", req.body);
        logger.info("Headers", req.headers);
        const sig = req.headers["stripe-signature"];
        const endpointSecret = "whsec_w4WjQNR0ZF1RfUQ53NzdYMkOrnTjGjPc";
        let event;
        try {
            event = stripe_1.default.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
        }
        catch (err) {
            res.status(400).send(`Webhook Error: ${err.message}`);
            return;
        }
        // Handle the event
        switch (event.type) {
            case "checkout.session.completed":
                const checkoutSessionCompleted = event.data.object;
                const query = `
        INSERT INTO DoorMessage (message, date)
        VALUES ($1, $2)
        RETURNING id
      `;
                const values = [
                    checkoutSessionCompleted["custom_fields"][0]["text"]["value"],
                    new Date(),
                ];
                const result = await pool.query(query, values);
                res
                    .status(200)
                    .send({ message: "Place saved successfully", id: result.rows[0].id });
                break;
            // ... handle other event types
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
        // Return a 200 response to acknowledge receipt of the event
        res.send();
    });
});
exports.retrieveMessages = (0, https_1.onRequest)((req, res) => {
    corsHandler(req, res, async () => {
        try {
            const result = await pool.query("SELECT * FROM DoorMessage");
            const messages = result.rows;
            res.status(200).json(messages);
        }
        catch (error) {
            logger.error("Error fetching messages", error);
            res.status(500).send("Internal Server Error");
        }
    });
});
//# sourceMappingURL=index.js.map