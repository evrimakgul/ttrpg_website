import { useNavigate } from "react-router-dom";

export default function DMPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      {/* Top Navigation */}
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

      {/* Header */}
      <h2 className="text-xl font-bold text-center mb-6">DM Dashboard</h2>

      {/* Host Game Button */}
      <div className="flex justify-center mb-8">
        <button
          onClick={() => navigate("/host-game")}
          className="bg-purple-100 px-6 py-2 rounded text-sm"
        >
          ➕ Host a New Game
        </button>
      </div>

      {/* Game Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Passive Games */}
        <div>
          <h3 className="text-md font-semibold mb-2">Passive / Old Games</h3>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate("/sheet")}
              className="p-3 rounded border hover:shadow text-left"
            >
              The Black Tombs of Ys (Status: Archived)
            </button>
          </div>
        </div>

        {/* Active Games */}
        <div>
          <h3 className="text-md font-semibold mb-2">Active Games</h3>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate("/sheet")}
              className="p-3 rounded border hover:shadow text-left"
            >
              Ghosts of Arcanum (3 Players)
            </button>
            <button
              onClick={() => navigate("/sheet")}
              className="p-3 rounded border hover:shadow text-left"
            >
              Temple of Dawn (1 Player)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
