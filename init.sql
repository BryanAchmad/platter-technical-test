-- Create databases
CREATE DATABASE product;
CREATE DATABASE payment;
CREATE DATABASE user_db;

-- Connect to product database
\c product

-- Create products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price BIGINT NOT NULL,
    qty INT NOT NULL
);

-- Connect to payment database
\c payment

-- Create payments table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    userId INT NOT NULL,
    productId INT NOT NULL,
    price BIGINT NOT NULL,
    qty INT NOT NULL,
    bill BIGINT NOT NULL,
    paymentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Connect to user database
\c user_db

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    alamat TEXT NOT NULL
);