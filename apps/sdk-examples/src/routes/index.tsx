import { Link } from "react-router";

export default function HomePage() {
  return (
    <main
      style={{
        fontFamily: "sans-serif",
        maxWidth: 640,
        margin: "2rem auto",
        padding: "0 1rem",
      }}
    >
      <h1>SDK Examples</h1>
      <p>Select an example to explore.</p>
      <ul>
        <li>
          <Link to="/examples/document-list">Document List</Link>
        </li>
        <li>
          <Link to="/examples/bulk-document-edit">Bulk Document Edit</Link>
        </li>
      </ul>
    </main>
  );
}
