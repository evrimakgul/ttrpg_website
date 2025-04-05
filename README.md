# TTRPG Website

This is a web-based tabletop role-playing game (TTRPG) interface built using **React**, **Vite**, and **Node.js**, with Python integration for backend logic and automation.

## Features

- Dynamic character sheets
- Dice rolling components
- Real-time socket communication
- Modular React components
- Clean and responsive UI

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js (socket server)
- **Python**: for automation or processing logic
- **Others**: VS Code, Git, GitHub

## Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/evrimakgul/ttrpg_website.git
   
Install dependencies:

bash
Copy
Edit
npm install
Run dev server:

bash
Copy
Edit
npm run dev
Activate Python venv (if used):

bash
Copy
Edit
./venv/Scripts/activate

Folder Structure

website/
├── public/
├── server/           # Node.js backend
├── src/
│   ├── components/   # React components
│   ├── pages/        # Page-level views
│   └── assets/
├── venv/             # Python virtual environment


Todo

 Add user auth

 Enhance real-time DM-player interactions

 Export/import campaign data