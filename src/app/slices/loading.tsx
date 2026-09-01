export default function Loading() {
  return (
    <main>
      <div className="container">
        <div className="state-loading" role="status" aria-live="polite">
          Loading slices…
        </div>
      </div>
    </main>
  );
}
