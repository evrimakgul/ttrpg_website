import { useNavigate } from "react-router-dom";
import { useState } from "react";

const activeGames = ["Ghosts of Arcanum", "Temple of Dawn"];
const passiveGames = ["Forgotten Pact", "Shattered Bonds"];

export default function JoinGame() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("");

  const handleJoin = () => {
    if (!selected) {
      alert("Please select a game.");
      return;
    }
    navigate("/select-game");
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      <h2 className="text-xl font-bold text-center mb-6">Join a Game</h2>

      <label className="block mb-2 font-medium">Select a Game</label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full border rounded p-2 mb-4"
      >
        <option value="">-- Choose --</option>
        <optgroup label="Active Games">
          {activeGames.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </optgroup>
        <optgroup label="Passive Games">
          {passiveGames.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </optgroup>
      </select>

      <button
        onClick={handleJoin}
        className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Join
      </button>
    </div>
  );
}
