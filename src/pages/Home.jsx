import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const handleProtectedNav = (role) => {
    // replace this later with actual auth check
    const isSignedIn = true;
    if (!isSignedIn) {
      alert("Please sign in first.");
      // navigate("/signin"); // in the future
    } else {
      navigate(`/${role}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-36 text-center">
      <h1 className="text-3xl font-bold mb-10">Welcome to TTRPG Portal</h1>

      {/* Side Option: Sign In/Up */}
      <div className="mb-10">
        <button className="text-sm text-blue-600 underline">
          Sign In / Sign Up
        </button>
      </div>

      {/* Main Options */}
      <div className="flex justify-center gap-8">
        <button
          onClick={() => handleProtectedNav("dm")}
          className="bg-white rounded-xl px-8 py-4 shadow hover:shadow-md transition"
        >
          Dungeon Master
        </button>

        <button
          onClick={() => handleProtectedNav("player")}
          className="bg-white rounded-xl px-8 py-4 shadow hover:shadow-md transition"
        >
          Player
        </button>
      </div>
    </div>
  );
}
