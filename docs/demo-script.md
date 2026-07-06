# PawPin Demo Script

This script outlines a 3-minute video pitch for the #hackthekitty hackathon submission.

## Setup Before Recording
1. Ensure Supabase is running locally with clean data.
2. Log into two browser profiles:
   - Profile A: Normal User (e.g., `user@example.com`)
   - Profile B: Approved Organization Admin (e.g., `org@pawpin.app`)
3. Open the PawPin Live Map on both profiles.
4. Have a test cat photo ready for upload.

## 0:00 - 0:30 | The Pitch & Problem
*Screen: The PawPin landing page.*
**Speaker:** "Welcome to PawPin! Every day, countless stray and lost cats go unnoticed because communities lack a safe, centralized way to track them. PawPin is a community-driven web app designed to reunite cats with their families or help rescues intervene, all while keeping the cats safe from malicious actors using our Privacy-First model."

## 0:30 - 1:15 | The Reporting Flow & AI
*Screen: Switch to Profile A (Normal User). Click 'Report a Cat'. Upload the cat photo.*
**Speaker:** "Let's see it in action. A user spots a stray cat. They snap a photo and upload it. Notice our optional integration with Gemini Vision API—it automatically scans the image and suggests the coat color and fur pattern, making reports more accurate and consistent without bypassing the human in the loop."
*Action: Complete the form and submit. Show the success screen.*

## 1:15 - 1:45 | Privacy & Fuzzy Maps
*Screen: Go to the Live Map on Profile A.*
**Speaker:** "The sighting is now on the map. But notice the location is slightly generalized. To protect vulnerable cats, public users only see 'fuzzy' locations rounded to a 1-kilometer radius. We never expose precise coordinates to the public."

## 1:45 - 2:30 | Org Dashboard & Smart Matching
*Screen: Switch to Profile B (Org Admin).*
**Speaker:** "Now let's look at the perspective of an approved rescue organization. Because this account is verified and elevated, they can see the exact coordinates to mount a rescue."
*Action: Open the new sighting from the Cases page.*
**Speaker:** "When we view the case, our Smart Matching Engine automatically calculates a confidence score against existing lost cat reports based on time, distance, and physical traits, instantly connecting the dots between a 'lost' report and a 'found' sighting."

## 2:30 - 3:00 | Outro
*Screen: Go to the Profile page showing the tabbed layout (Overview, Followed Cats, Notifications).*
**Speaker:** "Users can easily track their followed cats and receive notifications when updates happen. Built entirely on Next.js 14, Supabase, and Tailwind, PawPin is fast, accessible, and ready to help communities #hackthekitty. Thank you for watching!"
