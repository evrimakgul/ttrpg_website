import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="max-w-4xl mx-auto mt-36 text-center">
      <h1 className="text-3xl font-bold mb-10">Welcome to TTRPG Portal</h1>

      <div className="mb-10">
        <p className="mb-2 text-sm text-gray-600">Signed in as: {user?.email}</p>
        <button
          className="text-sm text-blue-600 underline"
          type="button"
          onClick={handleSignOut}
        >
          Sign Out
        </button>
      </div>

      <div className="flex justify-center gap-8">
        <button
          onClick={() => navigate("/dm")}
          className="bg-white rounded-xl px-8 py-4 shadow hover:shadow-md transition"
        >
          Dungeon Master
        </button>

        <button
          onClick={() => navigate("/player")}
          className="bg-white rounded-xl px-8 py-4 shadow hover:shadow-md transition"
        >
          Player
        </button>
      </div>
    </div>
  );
}
