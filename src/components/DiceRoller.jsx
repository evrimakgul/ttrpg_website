import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import socket from "../socket";

export default function DiceRoller({ name, isDM = false }) {
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);

  const rollDice = (sides) => {
    const roll = Math.floor(Math.random() * sides) + 1;
    const rollData = {
      id: uuidv4(),
      from: name,
      sides,
      roll,
      secret: isDM, // only DM sees secret rolls
    };
    socket.emit("roll_dice", rollData);
    if (isDM) setLog((prev) => [...prev, rollData]);
  };

  useEffect(() => {
    socket.on("dice_result", (data) => {
      if (!data.secret || isDM) {
        setLog((prev) => [...prev, data]);
      }
    });

    return () => socket.off("dice_result");
  }, [isDM]);

  return (
    <div className="bg-white p-4 rounded-xl shadow mt-6">
      <h3 className="text-lg font-bold mb-2">🎲 Dice Roller</h3>
      <div className="flex gap-2 mb-4">
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => rollDice(6)}>D6</button>
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => rollDice(20)}>D20</button>
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => rollDice(100)}>D100</button>
      </div>
      <div className="text-sm text-gray-700">
        {log.slice(-5).reverse().map((entry) => (
          <div key={entry.id}>
            <strong>{entry.from}</strong> rolled <strong>D{entry.sides}</strong>: {entry.roll}
            {entry.secret && " (secret)"}
          </div>
        ))}
      </div>
    </div>
  );
}
