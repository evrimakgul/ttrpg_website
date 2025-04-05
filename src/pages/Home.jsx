import ChoiceTree from "../components/ChoiceTree";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center">Choose Your Path</h1>
      <ChoiceTree />
    </div>
  );
}
