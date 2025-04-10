import { useNavigate } from "react-router-dom";

export default function PlayerPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      <div className="flex justify-start gap-2 mb-6">
        <button
          onClick={() => navigate("/")}
          className="px-4 py-1 bg-gray-200 rounded"
        >
          🏠 Home
        </button>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-1 bg-gray-200 rounded"
        >
          ⬅ Back
        </button>
      </div>

      <h2 className="text-xl font-bold text-center mb-6">Player Dashboard</h2>

      {/* Top Actions */}
      <div className="flex justify-center mb-8">
        <button
          onClick={() => navigate("/select-game")}
          className="bg-blue-100 px-6 py-2 rounded text-sm"
        >
          ➕ Create a New Character / Join a New Game
        </button>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Passive / Old Games (left) */}
        <div>
          <h3 className="text-md font-semibold mb-2">Passive / Old Games</h3>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate("/sheet")}
              className="p-3 rounded border hover:shadow text-left"
            >
              Character C (Game: Forgotten Pact)
            </button>
          </div>
        </div>

        {/* Active Games (right) */}
        <div>
          <h3 className="text-md font-semibold mb-2">Active Games</h3>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate("/sheet")}
              className="p-3 rounded border hover:shadow text-left"
            >
              Character A (Game: Ghosts of Arcanum)
            </button>
            <button
              onClick={() => navigate("/sheet")}
              className="p-3 rounded border hover:shadow text-left"
            >
              Character B (Game: Temple of Dawn)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
