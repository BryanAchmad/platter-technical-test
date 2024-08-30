const express = require("express");
const { Pool } = require("pg");
const amqp = require("amqplib");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

const rabbitmqUrl = process.env.RABBITMQ_URL;

let rabbitmqChannel;

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

app.get("/user/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
		if (result.rows.length === 0) {
			res.status(404).json({ error: "User not found" });
		} else {
			res.json(result.rows[0]);
		}
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

async function listenForNotifications(userIdClient) {
	try {
		if (!rabbitmqChannel) {
			console.error("RabbitMQ channel is not available");
			return;
		}

		await rabbitmqChannel.assertExchange("E!SEND_SOCKET", "fanout");
		const q = await rabbitmqChannel.assertQueue("", { exclusive: true });

		rabbitmqChannel.bindQueue(q.queue, "E!SEND_SOCKET", "");

		rabbitmqChannel.consume(q.queue, (msg) => {
			if (msg !== null) {
				const { userId, message, shoppingCart } = JSON.parse(msg.content.toString());

				if (parseInt(userId) === parseInt(userIdClient)) {
					console.log('Sending notification to user:', userId);
					io.to(userId.toString()).emit("notification", {
                        message: message,
                        shoppingCart: shoppingCart
                    });
				}
				rabbitmqChannel.ack(msg);
			}
		});
	} catch (error) {
		console.error("Error in listenForNotifications:", error);
	}
}

io.on("connection", (socket) => {
	console.log("A user connected");

	socket.on("join", async (userId) => {
		console.log('User joined with ID:', userId);
		socket.join(userId.toString());

		listenForNotifications(userId).catch(console.error);
	});
});

async function startServer() {
	try {
		await connectToRabbitMQ();
		server.listen(9303, () => console.log("User service running on port 9303"));
	} catch (error) {
		console.error("Failed to start server:", error);
		process.exit(1);
	}
}

startServer().catch((error) => {
	console.error("Failed to start server:", error);
	process.exit(1);
});