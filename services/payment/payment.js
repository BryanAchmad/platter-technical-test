const express = require("express");
const { Pool } = require("pg");
const amqp = require("amqplib");

const app = express();
app.use(express.json());

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

const rabbitmqUrl = process.env.RABBITMQ_URL;

async function processPayment() {
	const conn = await amqp.connect(rabbitmqUrl);
	const channel = await conn.createChannel();

	await channel.assertQueue("M!PAYMENT");

	channel.consume("M!PAYMENT", async (msg) => {
		if (msg !== null) {
			const { productData, userData, userShoppingQty } = JSON.parse(msg.content.toString());

			const client = await pool.connect();
			try {
				await client.query("BEGIN");

				// Add record to payment table
				const paymentResult = await client.query(
					"INSERT INTO payments (userid, productid, price, qty, bill) VALUES ($1, $2, $3, $4, $5) RETURNING id",
					[userData.id, productData.id, productData.price, userShoppingQty, userShoppingQty*productData.price]
				);

				await client.query("COMMIT");

				// Send notification
				const notificationChannel = await conn.createChannel();
				await notificationChannel.assertExchange("E!SEND_SOCKET", "fanout");
				notificationChannel.publish(
					"E!SEND_SOCKET",
					"",
					Buffer.from(
						JSON.stringify({
							userId: userData.id,
                            shoppingCart: {
                                ...productData,
                                qty: userShoppingQty
                            },
							message: `Payment processed`,
						})
					)
				);

				channel.ack(msg);
			} catch (error) {
				await client.query("ROLLBACK");
				console.error("Error processing payment:", error);
			} finally {
				client.release();
			}
		}
	});
}

processPayment().catch(console.error);

app.listen(9302, () => console.log("Payment service running on port 9302"));
