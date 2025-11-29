import express from "express";
import Job from "../models/Job.js"; 
import { authMiddleware, isRecruiter } from "../middleware/authMiddleware.js"; 

const router = express.Router();

// POST a new job (Protected: Logged In + Recruiter Only)
router.post("/post-job", authMiddleware, isRecruiter, async (req, res) => {
    try {
        const job = new Job(req.body);
        job.createdAt = new Date();
        const savedJob = await job.save();
        return res.status(200).send(savedJob);
    } catch (error) {
        return res.status(500).send({
            message: "Internal Server Error",
            status: false,
            error: error.message
        });
    }
});

// GET all jobs (Public - anyone can view)
router.get("/all-jobs", async (req, res) => {
    try {
        const jobs = await Job.find({});
        res.send(jobs);
    } catch (error) {
        return res.status(500).send({
            message: "Internal Server Error",
            status: false,
            error: error.message
        });
    }
});

// GET jobs posted by a specific user (Protected: Recruiter Only)
router.get("/myJobs/:email", authMiddleware, isRecruiter, async (req, res) => {
    try {
        const email = req.params.email;
        const jobs = await Job.find({ postedBy: email });
        res.send(jobs);
    } catch (error) {
        return res.status(500).send({
            message: "Internal Server Error",
            status: false,
            error: error.message
        });
    }
});

// DELETE a job (Protected: Recruiter Only)
router.delete("/delete-job/:jobId", authMiddleware, isRecruiter, async (req, res) => {
    try {
        const id = req.params.jobId;
        const result = await Job.findByIdAndDelete(id);
        if (result) {
            res.status(200).send({ message: "Job deleted successfully" });
        } else {
            res.status(404).send({ message: "Job not found" });
        }
    } catch (error) {
        return res.status(500).send({
            message: "Internal Server Error",
            status: false,
            error: error.message
        });
    }
});

// EDIT a job (Protected: Recruiter Only)
router.put("/edit-job/:jobId", authMiddleware, isRecruiter, async (req, res) => {
    try {
        const id = req.params.jobId;
        const updatedJob = await Job.findByIdAndUpdate(id, req.body, { new: true });
        if (updatedJob) {
            res.status(200).send({ message: "Job updated successfully", updatedJob });
        } else {
            res.status(404).send({ message: "Job not found" });
        }
    } catch (error) {
        return res.status(500).send({
            message: "Internal Server Error",
            status: false,
            error: error.message
        });
    }
});

export default router;
