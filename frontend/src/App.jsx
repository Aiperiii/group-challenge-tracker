import { useState } from 'react'
import './App.css'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [showRegister, setShowRegister] = useState(false)
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  async function fetchMe(token) {
    try {
      const response = await fetch('http://localhost:8000/me', {
        headers: { 'Authorization': 'Bearer ' + token },
      })
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        setLoggedIn(true)
      } else {
        setError('Could not load your profile.')
      }
    } catch (err) {
      setError('Could not reach the server.')
    }
  }

  async function handleLogin(){
    setError('') //clear any old error

    try{
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: email, password: password }),
      })

      if (!response.ok){
        setError('Login failed — check your email and password.')
        return
      }

      const data = await response.json()
      localStorage.setItem('token', data.access_token)
      setError('')

      await fetchMe(data.access_token)
    }catch (err) {
      setError('Could not reach the server.')
    }
  }

  async function handleRegister() {
    setError('')

    try {
      const response = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, timezone: timezone }),
      })

      if (!response.ok) {
        setError('Registration failed — that email may already be registered.')
        return
      }

      // Registration succeeded — now log them in automatically.
      await handleLogin()
    } catch (err) {
      setError('Could not reach the server.')
    }
  }

  function handleLogout() {
    localStorage.removeItem('token')
    setLoggedIn(false)
    setUser(null)
    setEmail('')
    setPassword('')
  }

  return (
    <div>
      <h1>Challenge Tracker</h1>

      {loggedIn ? (
        <div>
          <p>Welcome, {user.email}!</p>
          <p>Your timezone: {user.timezone}</p>
          <button onClick={handleLogout}>Log out</button>
        </div>
      ) : showRegister ? (
        <div>
          <h2>Register</h2>
          <input
            type="text"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            <option value="America/Chicago">Central (Houston, Chicago)</option>
            <option value="America/New_York">Eastern (New York)</option>
            <option value="America/Denver">Mountain (Denver)</option>
            <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
            <option value="Asia/Bishkek">Bishkek</option>
          </select>
          <button onClick={handleRegister}>Register</button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <p>
            Already have an account?{' '}
            <button onClick={() => { setShowRegister(false); setError('') }}>
              Log in
            </button>
          </p>
        </div>
      ) : (
        <div>
          <h2>Log in</h2>
          <input
            type="text"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleLogin}>Log in</button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <p>
            Need an account?{' '}
            <button onClick={() => { setShowRegister(true); setError('') }}>
              Register
            </button>
          </p>
        </div>
      )}
    </div>
  )
}

export default App