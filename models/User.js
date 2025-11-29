import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: false // Optional if you aren't collecting names yet, but recommended
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/.+\@.+\..+/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: true
  },
  
  // Role-Based Auth Field
  role: {
    type: String,
    enum: ['student', 'recruiter'], // Restricts values to these two
    default: 'student',
    required: true
  },

  // Recruiter Specific Fields (Only required if role is 'recruiter')
 
  
  // Optional Contact Info
 
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

const User = mongoose.model('User', userSchema);
export default User;
