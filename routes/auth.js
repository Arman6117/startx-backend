import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { name, email, password, role } = req.body;
  
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'student'
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
    const token = jwt.sign(
      { userId: user._id, role: user.role, name: user.name }, 
      process.env.JWT_SECRET, 
      { expiresIn: expiresIn }
    );

    res.json({ 
      token, 
      email: user.email, 
      name: user.name,
      role: user.role, 
      expiresIn: expiresIn 
    });
  } catch (error) {
    res.status(500).json({ error: "Error during sign-in" });
  }
});

export default router;
