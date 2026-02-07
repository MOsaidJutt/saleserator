Saleserator - Full Platform Setup & User Guide
This document provides a comprehensive guide to setting up the Saleserator platform and understanding its core functionalities.

1. Prerequisites
Ensure the following are installed:

Node.js (LTS Version)
npm (provided with node)
PostgreSQL

2. Database Setup (PostgreSQL)
Create Database: Create a new database in PostgreSQL named saleserator.

Import Data: Locate the provided saleserator.sql backup file.

Execution: Import this file using pgAdmin or the SQL command line to restore the schema and initial data.

3. Project Structure & Setup
To ensure all relative paths and scripts work correctly, please maintain the following structure:

Root Folder: Create a folder named saleserator.

Folders: Place the extracted frontend and backend folders inside it.

Environment Files (.env): 
  Copy the provided Frontend .env into the /frontend folder.
  Copy the provided Backend .env into the /backend folder.

Note: These files are essential for database and API connectivity.

4. Installation & Running
Step 1: Install Dependencies
Navigate to each folder in your terminal and run:

Frontend: npm install
Backend:  npm install

Step 2: Start the Platform
Start Backend: In the /backend folder, run node app.js. (Starts on http://localhost:5000)

Start Frontend: In the /frontend folder, run npm start. (Starts on http://localhost:3000)

5. Admin Panel Access
Credentials:  Email: admin@gmail.com | Password: Admin@123

Super Admin: Access manually via http://localhost:3000/superadmin

Admin Features:
  TV Mode: Access the TV Mode container directly from the dashboard. This tool allows you to generate a specific TV Mode URL, which you can copy and paste into a new tab or a dedicated display screen to show live rankings and data.
  
  Course Management: Create, Edit, Hide, or Delete courses and upload videos.
  
  Course Requests: Approve or reject user enrollment requests.
  
  Activities Management: Filter and monitor all user activities. Edits require a reason for audit trails.
  
  Leaderboard: View rankings by daily, weekly, or monthly filters.
  
  User History: Detailed drill-down into specific user actions and points.
  
  Brand Settings: Customize the platform name and logo.

6. User Panel Access
Sample Accounts:

  sam@gmail.com (Pass: sam)
  
  alex@gmail.com (Pass: alex)

Workflow:

  Dashboard: View enrolled courses and track overall learning progress.
  
  Course Enrollment: Request access to available courses from the catalog.
  
  Learning: Watch videos; progress updates automatically and recommends the next module/course.
  
  Activity Logging: Earn points by completing modules and logging your daily tasks.
  
  Leaderboard Page: Users have access to a dedicated Leaderboard page where they can view their current standing, see points of other users, and filter rankings by daily, weekly, monthly, or all-time statistics to track competition.

If you encounter any issues or have any questions, feel free to reach out for support.
