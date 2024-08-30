const express = require("express");
const amqp = require("amqplib");
const io = require("socket.io-client");

const app = express();
app.use(express.json());

const rabbitmqUrl = process.env.RABBITMQ_URL;
const userServiceUrl = "http://user:9303";

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

async function listenForNotifications() {
	const conn = await amqp.connect(rabbitmqUrl);
	const channel = await conn.createChannel();

	await channel.assertExchange("E!SEND_SOCKET", "fanout");
	const q = await channel.assertQueue("", { exclusive: true });

	channel.bindQueue(q.queue, "E!SEND_SOCKET", "");

	const socket = io(userServiceUrl);

	channel.consume(q.queue, (msg) => {
		if (msg !== null) {
			const { userId, shoppingCart, message } = JSON.parse(msg.content.toString());
			socket.emit("notification", { userId, message, shoppingCart });
			channel.ack(msg);
		}
	});
}

async function startServer() {
	await connectToRabbitMQ();
	listenForNotifications().catch(console.error);
	app.listen(9304, () =>
		console.log("Notification service running on port 9304")
	);
}

startServer().catch((error) => {
	console.error("Failed to start server:", error);
	process.exit(1);
});
