const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const { ObjectId } = require("mongodb");

require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require("jsonwebtoken");

// Import Models
const Product = require("./models/Product");
const Order = require("./models/Order");
const User = require("./models/User");
const Payment = require("./models/Payment");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// Database Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// JWT Verification Middleware
function verifyToken(req, res, next) {
  if (!req.headers.authorization) return res.sendStatus(401);
  const token = req.headers.authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_SECRATE_KEY, (err, decoded) => {
    if (err) return res.sendStatus(403);
    req.decoded = decoded;
    next();
  });
}

// Admin Role Verification Middleware
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;

  if (!email) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }

  const user = await User.findOne({ email });
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return res.status(403).send({ message: "Forbidden Access" });
  }
  next();
};

// JWT Token Generation
app.post("/jwt", (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_SECRATE_KEY, {
    expiresIn: "15m",
  });
  res.send({ token });
});

// Product Routes

// Get All Menu Items
app.get("/menu", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add New Menu Item
app.post("/menu", async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    console.error("Error adding product:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

// Order Routes

// Place an Order
app.post("/orders", async (req, res) => {
  try {
    const newOrder = new Order(req.body);
    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    console.error("Error placing order:", err);
    res.status(500).json({ message: "Failed to place order" });
  }
});

// Get Orders by User Email
app.get("/orders", async (req, res) => {
  const email = req.query.email;

  if (!email) {
    return res.status(400).json({ message: "Email query param is required" });
  }

  try {
    const orders = await Order.find({ email });
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// Delete Order by ID
app.delete("/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order deleted successfully",
      deletedOrder,
    });
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).json({ message: "Failed to delete order" });
  }
});

// User Routes

// Create User
app.post("/users", async (req, res) => {
  try {
    const newUser = new User(req.body);
    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (err) {
    console.error("Error saving user:", err);
    res.status(500).json({ message: "Failed to save user" });
  }
});

// Get All Users
app.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Check Admin by Email
app.get("/users/admin/:email", verifyToken, async (req, res) => {
  const email = req.params.email;

  if (email !== req.decoded.email) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }

  try {
    const user = await User.findOne({ email });
    const admin = user?.role === "admin";
    res.send({ admin });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server Error" });
  }
});

// Promote User to Admin
app.patch("/users/admin/:id", async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: { role: "admin" },
  };

  try {
    const result = await User.updateOne(filter, updateDoc);
    res.send(result);
  } catch (err) {
    console.error("Error updating user role:", err);
    res.status(500).json({ message: "Failed to update user role" });
  }
});

// Delete User by ID
app.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User deleted successfully",
      deletedUser,
    });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// Payment Routes
// Create Payment Intent (Stripe)
app.post("/create-payment-intent", async (req, res) => {
  const { totalPrice } = req.body;
  if (typeof totalPrice !== "number" || totalPrice <= 0) {
    return res.status(400).json({ message: "Invalid totalPrice" });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100),
      currency: "usd",
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Stripe Error:", error);
    res.status(500).send({ error: error.message });
  }
});
app.get("/menu/:id", async (req, res) => {
  const id = req.params.id;
  const result = await Product.findOne({ _id: new ObjectId(id) });
  res.json(result);
});

app.patch("/menu/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;

    const updatedDoc = await Product.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updatedDoc) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(updatedDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/menu/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await Product.deleteOne(query);
  res.send(result);
});

// Save Payment & Delete Related Orders
app.post("/payment", async (req, res) => {
  try {
    const payment = req.body;
    const newPayment = new Payment(payment);
    const savedPayment = await newPayment.save();

    // Delete all paid orders
    await Order.deleteMany({
      _id: { $in: payment.orderIds },
    });

    res.status(201).json({
      message: "Payment saved & orders deleted successfully",
      payment: savedPayment,
    });
  } catch (error) {
    console.error("Error in payment:", error);
    res.status(500).json({ message: "Failed to process payment" });
  }
});

// Get Payment History by Email
app.get("/payments/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const paymentHistory = await Payment.find({ email });
    res.json(paymentHistory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch payment history" });
  }
});

// Start the Server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
