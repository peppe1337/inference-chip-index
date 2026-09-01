export default function Loading() {
  return (
    <main>
      <div className="container">
        <div className="state-loading" role="status" aria-live="polite">
          Loading slice ranking…
        </div>
      </div>
    </main>
  );
}
