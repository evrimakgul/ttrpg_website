// ---------- Imports ----------
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

export default function GameDashboard() {
  /* ROUTE DATA ---------------------------------------------------------- */
  const navigate   = useNavigate();
  const { state }  = useLocation();
  const gameId     = state?.gameId;
  const startRid   = state?.rulesetId;

  /* PERSISTED DATA ------------------------------------------------------ */
  const allGames    = JSON.parse(localStorage.getItem("games")    || "[]");
  const allRulesets = JSON.parse(localStorage.getItem("rulesets") || "[]");

  /* LOCAL STATE --------------------------------------------------------- */
  const [gameState, setGameState] = useState(
    () => allGames.find(g => g.id === gameId) || { id:gameId, name:"", notes:"", rulesetId:startRid }
  );
  const [rulesetId, setRulesetId] = useState(gameState.rulesetId || "");
  const [showPicker, setShowPicker] = useState(false);

  /* HELPERS ------------------------------------------------------------- */
  const ruleset = allRulesets.find(r => r.id === rulesetId) || { name:"(no ruleset)" };
  const changeGame = (field,val)=> setGameState(p=>({...p,[field]:val}));
  const chooseRuleset = id => { setRulesetId(id); changeGame("rulesetId",id); setShowPicker(false); };

  const handleSave = () => {
    const newGames = allGames.map(g => g.id===gameId ? { ...gameState, rulesetId } : g);
    localStorage.setItem("games", JSON.stringify(newGames));
    alert("Saved!");
  };

  /* RENDER -------------------------------------------------------------- */
  return (
    <div className="max-w-3xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button onClick={()=>navigate("/")}  className="px-4 py-1 bg-gray-200 rounded">🏠 Home</button>
          <button onClick={()=>navigate(-1)}   className="px-4 py-1 bg-gray-200 rounded">⬅ Back</button>
        </div>
        <button onClick={handleSave} className="px-4 py-1 bg-green-100 rounded">💾 Save</button>
      </div>

      <h2 className="text-xl font-bold text-center mb-6">Game Dashboard</h2>

      {/* Game Info */}
      <Section title="Game Info">
        <label className="block text-xs font-semibold mb-1">Name</label>
        <input
          className="w-full p-2 border rounded mb-4"
          value={gameState.name}
          onChange={e=>changeGame("name",e.target.value)}
          placeholder="Game Name"
        />

        <label className="block text-xs font-semibold mb-1">Notes</label>
        <textarea
          className="w-full p-2 border rounded mb-4"
          rows={4}
          value={gameState.notes}
          onChange={e=>changeGame("notes",e.target.value)}
          placeholder="Notes"
        />

        <label className="block text-xs font-semibold mb-1">Ruleset</label>
        <button
          className="border px-3 py-1 rounded bg-blue-100"
          onClick={()=>setShowPicker(true)}
        >
          {ruleset.name}
        </button>
      </Section>

      {/* Modal Picker ----------------------------------------------------- */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h4 className="text-md font-semibold mb-4">Choose a Ruleset</h4>
            <div className="grid gap-2">
              {allRulesets.map(r=>(
                <button
                  key={r.id}
                  onClick={()=>chooseRuleset(r.id)}
                  className="w-full border px-3 py-2 rounded hover:bg-blue-100"
                >
                  {r.name}
                </button>
              ))}
            </div>
            <button onClick={()=>setShowPicker(false)} className="mt-4 text-xs underline">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Reusable bordered box */
function Section({ title, children }) {
  return (
    <div className="border p-4 rounded mb-6">
      <h3 className="text-md font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
