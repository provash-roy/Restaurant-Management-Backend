const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const { ObjectId } = require("mongodb");

require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require("jsonwebtoken");

const Product = require("./models/Product");
const Order = require("./models/Order");
const User = require("./models/User");
const Payment = require("./models/Payment");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

function verifyToken(req, res, next) {
  if (!req.headers.authorization) return res.sendStatus(401);
  const token = req.headers.authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_SECRATE_KEY, (err, decoded) => {
    if (err) return res.sendStatus(403);
    req.user = decoded;
    next();
  });
}

app.post("/jwt", (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_SECRATE_KEY, {
    expiresIn: "15m",
  });

  res.send({ token });
});

// Get All Menu Items
app.get("/menu", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.post("/payment", async (req, res) => {
  try {
    const payment = req.body;
    const newPayment = new Payment(payment);
    const savedPayment = await newPayment.save();

    await Order.deleteMany({
      _id: { $in: payment.orderIds },
    });
    console.log(savedPayment);

    res.status(201).json({
      message: "Payment saved & orders deleted successfully",
      payment: savedPayment,
    });
  } catch (error) {
    console.error("Error in payment:", error);
    res.status(500).json({ message: "Failed to process payment" });
  }
});

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

// Get All Users
app.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
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

//Promote User to Admin
app.patch("/users/admin/:id", async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  const updateDoc = {
    $set: {
      role: "admin",
    },
  };

  try {
    const result = await User.updateOne(filter, updateDoc);
    res.send(result);
  } catch (err) {
    console.error("Error updating user role:", err);
    res.status(500).json({ message: "Failed to update user role" });
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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
