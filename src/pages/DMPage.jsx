import { useNavigate } from "react-router-dom";

export default function DMPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-white rounded-2xl shadow text-center">
      <h2 className="text-xl font-bold mb-4">DM Dashboard</h2>
      <p className="text-gray-600 mb-6">Coming soon...</p>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-200 rounded"
        >
          ⬅ Back
        </button>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-gray-200 rounded"
        >
          🏠 Home
        </button>
      </div>
    </div>
  );
}
