export function NavButton({ active, disabled, onClick, children }) {
  return (
    <button
      className={`rounded-xl px-3 py-1.5 text-sm ${
        active
          ? "bg-neutral-900 text-white"
          : disabled
          ? "bg-neutral-100 text-neutral-400"
          : "bg-white text-neutral-800 hover:bg-neutral-50"
      } border shadow-sm`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
