## Getting Started

## Prerequisites

Ensure you have the following installed on your machine:

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/) (for local development)
- [Git](https://git-scm.com/)

### 1. Clone the Repository

Clone the repository to your local machine:

```bash
git clone https://github.com/your-github-username/platter-technical-test.git
cd platter-technical-test
```

### 2. Build and Run the Services
Use Docker Compose to build and run all the services:
```bash
docker-compose up --build
```

This command will:

- Build Docker images for each service using the respective Dockerfiles.
- Start all services including RabbitMQ and PostgreSQL in detached mode.

### 3. Insert data for product and user manually
### 4. Payload to start test
- endpoint `{base_url}/product/check-out`
- header `Content-Type: Application/json`
- body

```bash
{
    "productId": <productId>,
    "quantity": 123,
    "userId": <userId>
}
```

### 5. Create simple service to listen from socket.io, for example:
```bash
const io = require("socket.io-client");

const socket = io("http://localhost:9303");

const userId = "1"; // Replace with the specific user ID you want to test

socket.on("connect", () => {
    console.log("Connected to server");
    socket.emit("join", userId);

    socket.on("notification", (message) => {
        console.log("Received notification:", message);
    });
});

socket.on("disconnect", () => {
    console.log("Disconnected from server");
});
```



## Services Overview

### 1. **Product Service**

The **Product Service** handles product-related operations such as checking out a product. It interacts with the database to manage product inventory and communicates with the `Payment` service to process transactions.

- **Port**: `9301`
- **API Endpoint Example**: `POST /product/check-out`

### 2. **Payment Service**

The **Payment Service** is responsible for processing payments. It records payment transactions and interacts with the `Notification` service to notify users of successful transactions via a message broker.

- **Port**: `9302`
- **Message Broker Pattern**: `M!PAYMENT`

### 3. **User Service**

The **User Service** manages user data, including user profiles and addresses. It provides user information to other services, such as retrieving user details during a checkout process in the `Product` service.

- **Port**: `9303`
- **WebSocket Endpoint**: Listens for notifications via WebSocket.

### 4. **Notification Service**

The **Notification Service** is responsible for sending real-time notifications to users. It consumes messages from the message broker and emits WebSocket events to the `User` service, notifying users of important events like payment confirmations.

- **Port**: `9304`
- **Message Broker Pattern**: `E!SEND_SOCKET`

