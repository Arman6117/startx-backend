import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
const router = express.Router();

router.post("/signup", async (req, res) => {
  // 1. Accept 'role' from body
  const { email, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 2. Save user with role
    const newUser = new User({
      email,
      password: hashedPassword,
      role: role || 'student' // Default to student if not provided
    });
    
    const result = await newUser.save();
    return res.json({ result: result });
  } catch (error) {
    res.status(500).json({ error: "Server error during signup" });
  }
});

router.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    
    const expiresIn = "1h";
    // 3. Embed role in the token payload
    const token = jwt.sign(
        { userId: user._id, role: user.role }, 
        process.env.JWT_SECRET, 
        { expiresIn: expiresIn }
    );

    // 4. Return role to frontend
    res.json({ token, email: user.email, role: user.role, expiresIn: expiresIn });
  } catch (error) {
    res.status(500).json({ error: "Error during sign-in" });
  }
});

export default router;
