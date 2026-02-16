import { useEffect, useState } from "react";
import socket, { connectSocket } from "../socket";

export default function DiceRoller({ name, gameId, isDM = false }) {
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");

  const rollDice = async (sides) => {
    if (!gameId) {
      setError("Open a game before rolling dice.");
      return;
    }

    setError("");

    const roll = Math.floor(Math.random() * sides) + 1;
    const activeSocket = await connectSocket();

    activeSocket.emit("join_game_room", { gameId });
    activeSocket.emit("roll_dice", {
      gameId,
      from: name,
      sides,
      roll,
      secret: isDM,
    });
  };

  useEffect(() => {
    if (!gameId) return undefined;

    let mounted = true;

    const handleDiceResult = (data) => {
      if (data.gameId !== gameId) return;
      if (!data.secret || isDM) {
        setLog((prev) => [...prev, data]);
      }
    };

    const handleSocketError = (payload) => {
      if (!mounted) return;
      setError(payload?.message || "Socket error.");
    };

    const init = async () => {
      const activeSocket = await connectSocket();
      if (!mounted) return;

      activeSocket.emit("join_game_room", { gameId });
      activeSocket.on("dice_result", handleDiceResult);
      activeSocket.on("socket_error", handleSocketError);
    };

    init();

    return () => {
      mounted = false;
      socket.off("dice_result", handleDiceResult);
      socket.off("socket_error", handleSocketError);
    };
  }, [gameId, isDM]);

  return (
    <div className="mt-6 rounded-xl bg-white p-4 shadow">
      <h3 className="mb-2 text-lg font-bold">Dice Roller</h3>
      <div className="mb-4 flex gap-2">
        <button
          className="rounded bg-gray-200 px-3 py-1"
          onClick={() => rollDice(6)}
          type="button"
        >
          D6
        </button>
        <button
          className="rounded bg-gray-200 px-3 py-1"
          onClick={() => rollDice(20)}
          type="button"
        >
          D20
        </button>
        <button
          className="rounded bg-gray-200 px-3 py-1"
          onClick={() => rollDice(100)}
          type="button"
        >
          D100
        </button>
      </div>

      <div className="text-sm text-gray-700">
        {log.slice(-5).reverse().map((entry) => (
          <div key={entry.id}>
            <strong>{entry.from}</strong> rolled <strong>D{entry.sides}</strong>:{" "}
            {entry.roll}
            {entry.secret && " (secret)"}
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
