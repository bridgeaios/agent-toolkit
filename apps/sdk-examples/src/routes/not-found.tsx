import {Link} from 'react-router'

export default function NotFoundPage() {
  return (
    <main style={{fontFamily: 'sans-serif', maxWidth: 640, margin: '2rem auto', padding: '0 1rem'}}>
      <h1>404 — Page not found</h1>
      <p>
        <Link to="/">Back to home</Link>
      </p>
    </main>
  )
}
