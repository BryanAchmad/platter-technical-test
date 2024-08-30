const express = require("express");
const { Pool } = require("pg");
const amqp = require("amqplib");
const axios = require("axios");

const app = express();
app.use(express.json());

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

const rabbitmqUrl = process.env.RABBITMQ_URL;

let rabbitmqChannel = null;

async function connectToRabbitMQ(retries = 5, interval = 5000) {
	while (retries) {
		try {
			const conn = await amqp.connect(rabbitmqUrl);
			rabbitmqChannel = await conn.createChannel();
			await rabbitmqChannel.assertQueue("M!PAYMENT");
			console.log("Connected to RabbitMQ");
			return;
		} catch (error) {
			console.error("Failed to connect to RabbitMQ. Retrying...");
			retries -= 1;
			await new Promise((res) => setTimeout(res, interval));
		}
	}
	console.error("Failed to connect to RabbitMQ after multiple attempts");
	process.exit(1);
}

app.get("/products", async (req, res) => {
	try {
		const result = await pool.query("SELECT * FROM products");
		res.json(result.rows);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.post("/product/check-out", async (req, res) => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		const { productId, quantity } = req.body;
		const updateResult = await client.query(
			"UPDATE products SET qty = qty - $1 WHERE id = $2 RETURNING *",
			[quantity, productId]
		);

		if (updateResult.rows.length === 0) {
			throw new Error("Product not found or insufficient quantity");
		}

		const userResponse = await axios.get(
			`http://user:9303/user/${req.body.userId}`
		);
		const userData = userResponse.data;

		if (!rabbitmqChannel) {
			throw new Error("RabbitMQ connection not established");
		}
		rabbitmqChannel.sendToQueue(
			"M!PAYMENT",
			Buffer.from(
				JSON.stringify({
					productData: updateResult.rows[0],
					userData: userData,
                    userShoppingQty: quantity,
				})
			)
		);

		await client.query("COMMIT");
		res.json({ message: "Check-out process initiated" });
	} catch (error) {
		await client.query("ROLLBACK");
		res.status(500).json({ error: error.message });
	} finally {
		client.release();
	}
});

async function startServer() {
	await connectToRabbitMQ();
	app.listen(9301, () => console.log("Product service running on port 9301"));
}

startServer().catch((error) => {
	console.error("Failed to start server:", error);
	process.exit(1);
});
