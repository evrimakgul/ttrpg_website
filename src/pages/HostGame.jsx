// Import navigation and state handling from React Router and React core
import { useNavigate } from "react-router-dom";  // lets us redirect to another page
import { useState } from "react";                // lets us store user inputs in memory

// This is the main component where the DM can host (create) a new game
export default function HostGame() {
  const navigate = useNavigate(); // used to navigate to another route

  // React state: stores game name typed by the user
  const [gameName, setGameName] = useState("");

  // React state: stores notes typed by the user
  const [notes, setNotes] = useState("");

  // This function runs when user clicks "Host Game"
  const handleSubmit = () => {
    // If game name is empty, show alert and stop
    if (!gameName.trim()) {
      alert("Please enter a game name.");
      return;
    }

    // Build a new game object with a unique ID and timestamp
    const newGame = {
      id: Date.now().toString(),               // unique ID using current time
      name: gameName.trim(),                   // trimmed game name
      notes: notes.trim(),                     // trimmed notes
      createdAt: new Date().toISOString(),     // creation timestamp
    };

    // Load current game list from localStorage
    const existing = JSON.parse(localStorage.getItem("games") || "[]");

    // Add the new game to the list
    const updated = [...existing, newGame];

    // Save updated game list back to localStorage
    localStorage.setItem("games", JSON.stringify(updated));

    // Navigate to the ruleset selection page and pass the new game ID
    navigate("/select-ruleset", { state: { gameId: newGame.id } });
  };

  // JSX layout: form with fields for game name, notes, and a submit button
  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      
      {/* Navigation buttons: Home and Back */}
      <div className="flex justify-start gap-2 mb-6">
        <button
          onClick={() => navigate("/")} // Go to home page
          className="px-4 py-1 bg-gray-200 rounded"
        >
          🏠 Home
        </button>
        <button
          onClick={() => navigate(-1)} // Go back to previous page
          className="px-4 py-1 bg-gray-200 rounded"
        >
          ⬅ Back
        </button>
      </div>

      {/* Page title */}
      <h2 className="text-lg font-bold text-center mb-6">Host a New Game</h2>

      {/* Input for game name */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Game Name</label>
        <input
          value={gameName}
          onChange={(e) => setGameName(e.target.value)} // update state as user types
          className="w-full border p-2 rounded"
        />
      </div>

      {/* Textarea for optional notes */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)} // update state as user types
          rows={4}
          className="w-full border p-2 rounded"
        />
      </div>

      {/* Submit button: triggers handleSubmit */}
      <button
        onClick={handleSubmit}
        className="w-full bg-purple-100 py-2 rounded"
      >
        ✅ Host Game
      </button>
    </div>
  );
}
