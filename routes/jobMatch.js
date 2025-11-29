import express from "express";
import Job from "../models/Job.js";

const router = express.Router();

// Comprehensive skill synonyms and variations
const SKILL_SYNONYMS = {
  'javascript': ['js', 'javascript', 'ecmascript', 'es6', 'es2015', 'es2020'],
  'typescript': ['ts', 'typescript'],
  'react': ['react', 'reactjs', 'react.js', 'react js'],
  'angular': ['angular', 'angularjs', 'angular.js', 'angular2', 'angular 2'],
  'vue': ['vue', 'vuejs', 'vue.js', 'vue js'],
  'node': ['node', 'nodejs', 'node.js', 'node js'],
  'express': ['express', 'expressjs', 'express.js'],
  'mongodb': ['mongodb', 'mongo', 'mongo db'],
  'sql': ['sql', 'mysql', 'postgresql', 'postgres', 'mssql', 'oracle', 'sql server'],
  'nosql': ['nosql', 'no sql', 'no-sql'],
  'aws': ['aws', 'amazon web services'],
  'docker': ['docker', 'containerization', 'containers'],
  'kubernetes': ['kubernetes', 'k8s'],
  'python': ['python', 'py'],
  'java': ['java', 'jdk', 'jvm'],
  'csharp': ['c#', 'csharp', 'c sharp', '.net', 'dotnet', 'asp.net'],
  'cpp': ['c++', 'cpp', 'cplusplus'],
  'html': ['html', 'html5'],
  'css': ['css', 'css3', 'cascading style sheets'],
  'tailwind': ['tailwind', 'tailwindcss', 'tailwind css'],
  'bootstrap': ['bootstrap', 'bootstrap css'],
  'rest': ['rest', 'restful', 'rest api', 'restful api'],
  'graphql': ['graphql', 'graph ql'],
  'git': ['git', 'github', 'gitlab', 'version control'],
  'cicd': ['ci/cd', 'cicd', 'continuous integration', 'continuous deployment'],
  'devops': ['devops', 'dev ops'],
  'agile': ['agile', 'scrum', 'kanban'],
  'redux': ['redux', 'redux toolkit'],
  'nextjs': ['next.js', 'nextjs', 'next js', 'next'],
  'django': ['django', 'django rest framework', 'drf'],
  'flask': ['flask', 'flask-restful'],
  'spring': ['spring', 'spring boot', 'spring framework'],
  'laravel': ['laravel', 'laravel framework'],
  'ruby': ['ruby', 'ruby on rails', 'rails', 'ror'],
  'php': ['php', 'php7', 'php8'],
  'swift': ['swift', 'swift ui', 'swiftui'],
  'kotlin': ['kotlin', 'kotlin jvm'],
  'flutter': ['flutter', 'dart', 'flutter framework'],
  'reactnative': ['react native', 'react-native', 'reactnative', 'rn'],
  'ml': ['machine learning', 'ml', 'artificial intelligence', 'ai', 'deep learning'],
  'tensorflow': ['tensorflow', 'tf', 'tensor flow'],
  'pytorch': ['pytorch', 'torch', 'py torch'],
  'azure': ['azure', 'microsoft azure'],
  'gcp': ['gcp', 'google cloud', 'google cloud platform'],
  'firebase': ['firebase', 'firestore', 'firebase auth'],
  'linux': ['linux', 'unix', 'ubuntu', 'centos'],
  'terraform': ['terraform', 'iac', 'infrastructure as code'],
  'jenkins': ['jenkins', 'jenkins ci'],
  'redis': ['redis', 'cache', 'in-memory database'],
  'nginx': ['nginx', 'reverse proxy'],
  'apache': ['apache', 'apache server'],
  'microservices': ['microservices', 'micro services', 'microservice architecture'],
  'api': ['api', 'apis', 'application programming interface'],
  'sass': ['sass', 'scss'],
  'webpack': ['webpack', 'bundler'],
  'vite': ['vite', 'vite.js'],
  'jest': ['jest', 'testing', 'unit testing'],
  'cypress': ['cypress', 'e2e testing'],
  'figma': ['figma', 'design'],
  'photoshop': ['photoshop', 'ps'],
  'illustrator': ['illustrator', 'ai'],
  'xd': ['xd', 'adobe xd']
};

// Normalize and tokenize text
const normalizeText = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s.#+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Get all variations of a skill
const getSkillVariations = (skill) => {
  const normalized = normalizeText(skill);
  
  // Check if this skill is in any synonym group
  for (const [key, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return synonyms;
    }
  }
  
  return [normalized];
};

// Advanced similarity calculation
const calculateSimilarity = (str1, str2) => {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  // Get all variations for both strings
  const variations1 = getSkillVariations(s1);
  const variations2 = getSkillVariations(s2);
  
  // Check if any variations match
  for (const v1 of variations1) {
    for (const v2 of variations2) {
      // Exact match
      if (v1 === v2) return 1.0;
      
      // One contains the other
      if (v1.includes(v2) || v2.includes(v1)) {
        const shorter = Math.min(v1.length, v2.length);
        const longer = Math.max(v1.length, v2.length);
        return 0.7 + (shorter / longer) * 0.2;
      }
    }
  }
  
  // Check for word overlap
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(word => words2.includes(word));
  
  if (commonWords.length > 0) {
    return 0.4 + (commonWords.length / Math.max(words1.length, words2.length)) * 0.3;
  }
  
  return 0;
};

// Match jobs based on resume skills
router.post("/match-jobs", async (req, res) => {
  try {
    const { skills, experienceLevel, location, minMatchPercentage = 15 } = req.body;

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ 
        message: "Skills array is required and cannot be empty",
        totalMatches: 0,
        jobs: []
      });
    }

    // Normalize and expand skills with variations
    const normalizedSkills = skills.map(skill => normalizeText(skill));
    const expandedSkills = [...new Set(normalizedSkills.flatMap(skill => getSkillVariations(skill)))];

    console.log('Input skills:', skills);
    console.log('Expanded skills:', expandedSkills);

    // Fetch all active jobs
    const allJobs = await Job.find({}).lean();

    if (allJobs.length === 0) {
      return res.json({
        totalMatches: 0,
        jobs: [],
        message: "No jobs available at the moment"
      });
    }

    // Calculate match score for each job
    const jobsWithScores = allJobs.map(job => {
      let matchScore = 0;
      let matchedSkills = new Set();
      let skillMatchDetails = [];
      
      if (!job.skills || job.skills.length === 0) {
        return {
          ...job,
          matchScore: 0,
          matchPercentage: 0,
          matchedSkills: [],
          totalSkillsMatched: 0,
          totalSkillsRequired: 0
        };
      }

      const jobSkills = job.skills.map(s => normalizeText(s));
      const expandedJobSkills = [...new Set(jobSkills.flatMap(skill => getSkillVariations(skill)))];
      
      // Match expanded skills
      expandedSkills.forEach(resumeSkill => {
        let bestMatch = 0;
        let matchedJobSkill = null;
        let originalResumeSkill = null;

        // Find which original skill this came from
        for (const origSkill of normalizedSkills) {
          if (getSkillVariations(origSkill).includes(resumeSkill)) {
            originalResumeSkill = origSkill;
            break;
          }
        }

        expandedJobSkills.forEach(jobSkill => {
          const similarity = calculateSimilarity(resumeSkill, jobSkill);
          
          if (similarity > bestMatch) {
            bestMatch = similarity;
            matchedJobSkill = jobSkill;
          }
        });

        // Award points based on match quality
        if (bestMatch >= 1.0) {
          matchScore += 10;
          matchedSkills.add(originalResumeSkill || resumeSkill);
          skillMatchDetails.push({
            resumeSkill: originalResumeSkill || resumeSkill,
            jobSkill: matchedJobSkill,
            matchType: 'exact',
            score: 10
          });
        } else if (bestMatch >= 0.8) {
          matchScore += 8;
          matchedSkills.add(originalResumeSkill || resumeSkill);
          skillMatchDetails.push({
            resumeSkill: originalResumeSkill || resumeSkill,
            jobSkill: matchedJobSkill,
            matchType: 'strong',
            score: 8
          });
        } else if (bestMatch >= 0.6) {
          matchScore += 5;
          matchedSkills.add(originalResumeSkill || resumeSkill);
          skillMatchDetails.push({
            resumeSkill: originalResumeSkill || resumeSkill,
            jobSkill: matchedJobSkill,
            matchType: 'partial',
            score: 5
          });
        } else if (bestMatch >= 0.4) {
          matchScore += 2;
          skillMatchDetails.push({
            resumeSkill: originalResumeSkill || resumeSkill,
            jobSkill: matchedJobSkill,
            matchType: 'weak',
            score: 2
          });
        }
      });

      // Experience level matching
      if (experienceLevel && job.experienceLevel) {
        const expSimilarity = calculateSimilarity(experienceLevel, job.experienceLevel);
        if (expSimilarity >= 0.7) {
          matchScore += 5;
        }
      }

      // Location matching
      if (location && job.jobLocation) {
        const locSimilarity = calculateSimilarity(location, job.jobLocation);
        if (locSimilarity >= 0.7) {
          matchScore += 5;
        }
      }

      // Calculate match percentage
      const maxPossibleScore = (expandedSkills.length * 10) + 10;
      const matchPercentage = Math.min(
        Math.round((matchScore / maxPossibleScore) * 100), 
        100
      );

      // Calculate skill coverage
      const skillCoverage = job.skills.length > 0 
        ? Math.round((matchedSkills.size / job.skills.length) * 100)
        : 0;

      return {
        ...job,
        matchScore,
        matchPercentage,
        skillCoverage,
        matchedSkills: Array.from(matchedSkills),
        totalSkillsMatched: matchedSkills.size,
        totalSkillsRequired: job.skills.length,
        skillMatchDetails: skillMatchDetails
      };
    });

    // Filter and sort
    const matchedJobs = jobsWithScores
      .filter(job => job.matchPercentage >= minMatchPercentage)
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        if (b.skillCoverage !== a.skillCoverage) return b.skillCoverage - a.skillCoverage;
        return new Date(b.postingDate) - new Date(a.postingDate);
      })
      .slice(0, 20);

    // Group by quality
    const excellent = matchedJobs.filter(job => job.matchPercentage >= 70);
    const good = matchedJobs.filter(job => job.matchPercentage >= 50 && job.matchPercentage < 70);
    const fair = matchedJobs.filter(job => job.matchPercentage < 50);

    res.json({
      totalMatches: matchedJobs.length,
      jobs: matchedJobs,
      summary: {
        excellent: excellent.length,
        good: good.length,
        fair: fair.length,
        averageMatch: matchedJobs.length > 0 
          ? Math.round(matchedJobs.reduce((sum, job) => sum + job.matchPercentage, 0) / matchedJobs.length)
          : 0
      },
      debug: {
        inputSkills: skills,
        expandedSkills: expandedSkills,
        totalJobsSearched: allJobs.length
      }
    });

  } catch (error) {
    console.error("Error matching jobs:", error);
    res.status(500).json({ 
      message: "Error matching jobs", 
      error: error.message,
      totalMatches: 0,
      jobs: []
    });
  }
});

// Get match explanation for a specific job
router.post("/match-explanation", async (req, res) => {
  try {
    const { jobId, skills } = req.body;

    if (!jobId || !skills || skills.length === 0) {
      return res.status(400).json({ message: "Job ID and skills are required" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const normalizedSkills = skills.map(s => normalizeText(s));
    const jobSkills = job.skills.map(s => normalizeText(s));

    const matchedSkills = [];
    const missingSkills = [];

    jobSkills.forEach(jobSkill => {
      const match = normalizedSkills.find(resumeSkill => 
        calculateSimilarity(resumeSkill, jobSkill) >= 0.7
      );
      
      if (match) {
        matchedSkills.push(jobSkill);
      } else {
        missingSkills.push(jobSkill);
      }
    });

    res.json({
      jobTitle: job.jobTitle,
      companyName: job.companyName,
      matchedSkills,
      missingSkills,
      matchPercentage: Math.round((matchedSkills.length / jobSkills.length) * 100),
      recommendations: missingSkills.length > 0 
        ? `Consider learning: ${missingSkills.slice(0, 3).join(', ')}`
        : "You have all the required skills!"
    });

  } catch (error) {
    console.error("Error getting match explanation:", error);
    res.status(500).json({ message: "Error getting match explanation", error: error.message });
  }
});

export default router;
