import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const authMiddleware = async (req, res, next) => {
  const token = req.headers["authorization"];
  
  if (!token) {
    return res.status(401).json({ error: "Access denied, no token provided" });
  }
  
  try {
    // Remove "Bearer " if present
    const actualToken = token.startsWith("Bearer ") ? token.slice(7, token.length) : token;
    
    const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    
    // Fetch the user to get the role
    const user = await User.findById(decoded.userId);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    // Attach role to the request object
    req.userRole = user.role;
    next();
  } catch (error) {
    res.status(400).json({ error: "Invalid token" });
  }
};

// New Middleware: Checks if the user is a Recruiter
export const isRecruiter = (req, res, next) => {
    // authMiddleware runs first, so req.userRole is available
    if (req.userRole === 'recruiter') {
        next();
    } else {
        return res.status(403).json({ error: "Access denied. Recruiters only." });
    }
};
