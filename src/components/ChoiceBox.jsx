export default function ChoiceBox({ label, onClick }) {
    return (
      <button
        onClick={onClick}
        className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition duration-200 text-center text-lg font-medium"
      >
        {label}
      </button>
    );
  }
  