import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ChoiceBox from "./ChoiceBox";

const tree = {
  label: "Choose Class",
  children: [
    {
      label: "Warrior",
      children: [
        { label: "Knight", end: true },
        { label: "Berserker", end: true },
      ],
    },
    {
      label: "Mage",
      children: [
        { label: "Elementalist", end: true },
        { label: "Necromancer", end: true },
      ],
    },
  ],
};

export default function ChoiceTree() {
  const [path, setPath] = useState([tree]);
  const navigate = useNavigate();

  const handleSelect = (choice) => {
    if (choice.end) {
      navigate("/sheet");
    } else {
      setPath([...path, choice]);
    }
  };

  const current = path[path.length - 1];

  return (
    <div className="grid grid-cols-2 gap-4">
      {current.children?.map((child, i) => (
        <ChoiceBox key={i} label={child.label} onClick={() => handleSelect(child)} />
      ))}
    </div>
  );
}
