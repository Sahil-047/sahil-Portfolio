export default function LoaderBackground() {
  return (
    <div className="loader__background" aria-hidden="true">
      <div
        className="loader__background-image"
        style={{ backgroundImage: "url('/images/loader-bg.png')" }}
      />
      <div className="loader__background-shade" />
    </div>
  );
}
