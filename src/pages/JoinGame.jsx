// Import navigation and state handling
import { useNavigate } from "react-router-dom"; // lets us navigate programmatically
import { useState } from "react";               // lets us track selected game in memory

// Hardcoded lists of games (for now)
const activeGames = ["Ghosts of Arcanum", "Temple of Dawn"];
const passiveGames = ["Forgotten Pact", "Shattered Bonds"];

// This is the main component that lets a player join a game
export default function JoinGame() {
  const navigate = useNavigate();           // used to redirect to another route
  const [selected, setSelected] = useState(""); // stores selected game name

  // Called when user clicks the "Join" button
  const handleJoin = () => {
    // If no game is selected, block and alert
    if (!selected) {
      alert("Please select a game.");
      return;
    }

    // Later we might store this selected game in global state
    // For now, go directly to character creation page
    navigate("/create-character");
  };

  // Return JSX layout for the Join Game form
  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      
      {/* Page Title */}
      <h2 className="text-xl font-bold text-center mb-6">Join a Game</h2>

      {/* Game selection label */}
      <label className="block mb-2 font-medium">Select a Game</label>

      {/* Dropdown for selecting game */}
      <select
        value={selected}                         // current selected value
        onChange={(e) => setSelected(e.target.value)} // update when selection changes
        className="w-full border rounded p-2 mb-4"
      >
        <option value="">-- Choose --</option>  {/* Placeholder option */}

        {/* Active Games Group */}
        <optgroup label="Active Games">
          {activeGames.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </optgroup>

        {/* Passive Games Group */}
        <optgroup label="Passive Games">
          {passiveGames.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </optgroup>
      </select>

      {/* Join button */}
      <button
        onClick={handleJoin} // triggers validation and navigation
        className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Join
      </button>
    </div>
  );
}
