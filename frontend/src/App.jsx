import { useState, useEffect } from 'react'
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
  const [groups, setGroups] = useState([])
  const [challenges, setChallenges] = useState([])
  const [name, setName] = useState("")
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [numericValue, setNumericValue] = useState('')
  const [checkinMessage, setCheckinMessage] = useState('')
  const [currentStreak, setCurrentStreak] = useState(0)
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardView, setLeaderboardView] = useState('current')
  const [showCreateChallenge, setShowCreateChallenge] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDurationDays, setNewDurationDays] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newCheckInType, setNewCheckInType] = useState('boolean')
  const [newGoalValue, setNewGoalValue] = useState('')
  const [newChallengeGroupId, setNewChallengeGroupId] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  


  async function fetchMe(token) {
    try {
      const response = await fetch('http://localhost:8000/me', {
        headers: { 'Authorization': 'Bearer ' + token },
      })
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        setLoggedIn(true)
        await fetchGroupsAndChallenges(token)
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
        body: JSON.stringify({ email: email,  name: name, password: password, timezone: timezone }),
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

  async function fetchGroupsAndChallenges(token) {
    try {
      // Get the user's groups.
      const groupsResponse = await fetch('http://localhost:8000/my-groups', {
        headers: { 'Authorization': 'Bearer ' + token },
      })
      const groupsData = await groupsResponse.json()
      setGroups(groupsData)

      // For each group, get its challenges, and collect them all.
      let allChallenges = []
      for (const group of groupsData) {
        const challengesResponse = await fetch(
          `http://localhost:8000/groups/${group.id}/challenges`,
          { headers: { 'Authorization': 'Bearer ' + token } }
        )
        const challengesData = await challengesResponse.json()
        allChallenges = allChallenges.concat(challengesData)
      }
      setChallenges(allChallenges)
    } catch (err) {
      setError('Could not load your challenges.')
    }
  }

  async function openChallenge(challenge) {
    setSelectedChallenge(challenge)
    setCheckinMessage('')
    setNumericValue('')

    // Fetch this challenge's leaderboard to find the current user's streak.
    const token = localStorage.getItem('token')
    try {
      const response = await fetch(
        `http://localhost:8000/challenges/${challenge.id}/leaderboard`,
        { headers: { 'Authorization': 'Bearer ' + token } }
      )
      const leaderboard = await response.json()
      setLeaderboard(leaderboard)
      const myEntry = leaderboard.find((entry) => entry.user_id === user.id)
      setCurrentStreak(myEntry ? myEntry.current_streak : 0)
    } catch (err) {
      setCurrentStreak(0)
    }
  }

  async function handleCheckin(challenge) {
    setCheckinMessage('')
    const token = localStorage.getItem('token')

    // Build the request body based on the challenge type.
    let body = {}
    if (challenge.check_in_type === 'numeric') {
      body = { value: Number(numericValue) }
    } else {
      body = {}  // boolean/text: no value needed for a simple "done"
    }

    try {
      const response = await fetch(
        `http://localhost:8000/challenges/${challenge.id}/checkin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify(body),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setCheckinMessage(data.detail || 'Check-in failed.')
        return
      }

      setCheckinMessage(
        `Checked in! Current streak: ${data.current_streak} 🔥`
      )
      setCurrentStreak(data.current_streak) 
      setNumericValue('')
    } catch (err) {
      setCheckinMessage('Could not reach the server.')
    }
  }

  useEffect(() => {
    //only connect if the challenge is selected
    if(!selectedChallenge) return

    const token = localStorage.getItem('token')
    const groupId = selectedChallenge.group_id
    const ws = new WebSocket(
      `ws://localhost:8000/ws/groups/${groupId}?token=${token}`
    )

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      // If this message is for the challenge we're viewing, update the leaderboard.
      if(message.challenge_id == selectedChallenge.id && message.leaderboard){
        setLeaderboard(message.leaderboard)
      }
    }
    // Cleanup: close the WebSocket when leaving or switching challenges.
    return () => {
      ws.close()
    }
  }, [selectedChallenge])

  function handleLogout() {
    localStorage.removeItem('token')
    setLoggedIn(false)
    setUser(null)
    setEmail('')
    setPassword('')
  }

  function assignRanks(entries, streakField){
    let rank = 0
    let previousValue = null
    return entries.map((entry, index ) => {
      const value = entry[streakField]
      if (value != previousValue){
        rank = index + 1
        previousValue = value
      }
      return { ...entry, rank: rank }
    })
  }

  async function handleCreateChallenge() {
    setError('')

    // Validate the form before sending
    if (!newName) {
      setError('Please enter a challenge name.')
      return
    }
    if (!newChallengeGroupId) {
      setError('Please choose a group.')
      return
    }
    if (!newDurationDays || Number(newDurationDays) <= 0) {
      setError('Please enter a duration (a positive number of days).')
      return
    }
    if (!newStartDate) {
      setError('Please choose a start date.')
      return
    }

    const token = localStorage.getItem('token')

    // Build the body, matching the ChallengeCreate schema.
    const body = {
      name: newName,
      description: newDescription || null,
      duration_days: Number(newDurationDays),
      start_date: newStartDate,   // "YYYY-MM-DD" from the date picker
      check_in_type: newCheckInType,
      goal_value: newGoalValue ? Number(newGoalValue) : null,
    }

    try {
      const response = await fetch(
        `http://localhost:8000/groups/${newChallengeGroupId}/challenges`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify(body),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        setError(
          typeof data.detail === 'string'
            ? data.detail
            : 'Could not create challenge — check the fields.'
        )
        return
      }

      // Success — refresh the challenge list and close the form.
      setShowCreateChallenge(false)
      setNewName('')
      setNewDescription('')
      setNewStartDate('')
      setNewGoalValue('')
      await fetchGroupsAndChallenges(token)
    } catch (err) {
      setError('Could not reach the server.')
    }
  }

  
  async function openGroup(group) {
    setSelectedGroup(group)
    setSelectedChallenge(null)   // clear any open challenge when switching groups
    const token = localStorage.getItem('token')
    try {
      const response = await fetch(
        `http://localhost:8000/groups/${group.id}/challenges`,
        { headers: { 'Authorization': 'Bearer ' + token } }
      )
      const data = await response.json()
      setChallenges(data)   // now `challenges` holds ONLY this group's challenges
    } catch (err) {
      setError('Could not load challenges for this group.')
    }
  }

  // RETURN starts here
  return (
    <div>
      <h1>Challenge Tracker</h1>

      {loggedIn ? (
        <div>
        <p>Welcome, {user.name}!</p>
        <button onClick={handleLogout}>Log out</button>

        {!selectedGroup ? (
          // ---- GROUPS LIST (no group selected) ----
          <div>
            <h2>Your Groups</h2>
            {groups.length === 0 ? (
              <p>You're not in any groups yet.</p>
            ) : (
              <ul>
                {groups.map((group) => (
                  <li key={group.id}>
                    <button onClick={() => openGroup(group)}>
                      {group.name} (invite code: {group.invite_code})
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          // ---- INSIDE A GROUP (a group is selected) ----
          <div>
            <button onClick={() => { setSelectedGroup(null); setSelectedChallenge(null) }}>
              ← Back to groups
            </button>

            <h2>{selectedGroup.name}</h2>
            <p>Invite code: {selectedGroup.invite_code}</p>

            {/* Create-challenge form (only when not viewing a challenge) */}
            {!selectedChallenge && (
              <div>
                <button onClick={() => setShowCreateChallenge(!showCreateChallenge)}>
                  {showCreateChallenge ? 'Cancel' : '+ New challenge'}
                </button>

                {showCreateChallenge && (
                  <div>
                    <input
                      type="text"
                      placeholder="Challenge name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                    />
                    <select value={newCheckInType} onChange={(e) => setNewCheckInType(e.target.value)}>
                      <option value="boolean">Yes/No (boolean)</option>
                      <option value="numeric">Number (numeric)</option>
                      <option value="text">Text</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Duration (days)"
                      value={newDurationDays}
                      onChange={(e) => setNewDurationDays(e.target.value)}
                    />
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                    />
                    {newCheckInType === 'numeric' && (
                      <input
                        type="number"
                        placeholder="Goal value (optional)"
                        value={newGoalValue}
                        onChange={(e) => setNewGoalValue(e.target.value)}
                      />
                    )}
                    <button onClick={handleCreateChallenge}>Create</button>
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Either the check-in screen or this group's challenge list */}
            {selectedChallenge ? (
              <div>
                <button onClick={() => { setSelectedChallenge(null); setCheckinMessage('') }}>
                  ← Back to challenges
                </button>

                <h3>{selectedChallenge.name}</h3>
                <p>Type: {selectedChallenge.check_in_type}</p>
                <p>Current streak: {currentStreak} 🔥</p>

                {selectedChallenge.check_in_type === 'numeric' ? (
                  <div>
                    <input
                      type="number"
                      placeholder="Enter your value"
                      value={numericValue}
                      onChange={(e) => setNumericValue(e.target.value)}
                    />
                    <button onClick={() => handleCheckin(selectedChallenge)}>Log today</button>
                  </div>
                ) : (
                  <button onClick={() => handleCheckin(selectedChallenge)}>I did it today</button>
                )}

                {checkinMessage && <p>{checkinMessage}</p>}

                <h3>Leaderboard</h3>
                <div>
                  <button
                    onClick={() => setLeaderboardView('current')}
                    style={{
                      backgroundColor: leaderboardView === 'current' ? '#ff6b35' : '#eee',
                      color: leaderboardView === 'current' ? 'white' : 'black',
                      border: 'none', padding: '8px 16px', marginRight: '8px',
                      borderRadius: '6px', cursor: 'pointer',
                    }}
                  >
                    Current streak 🔥
                  </button>
                  <button
                    onClick={() => setLeaderboardView('longest')}
                    style={{
                      backgroundColor: leaderboardView === 'longest' ? '#f7b731' : '#eee',
                      color: leaderboardView === 'longest' ? 'white' : 'black',
                      border: 'none', padding: '8px 16px',
                      borderRadius: '6px', cursor: 'pointer',
                    }}
                  >
                    Longest streak 🏆
                  </button>
                </div>

                {leaderboard.length === 0 ? (
                  <p>No streaks yet.</p>
                ) : leaderboardView === 'current' ? (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {assignRanks(leaderboard, 'current_streak').map((entry) => (
                      <li key={entry.user_id}>
                        #{entry.rank} {entry.name || entry.email} — {entry.current_streak} 🔥
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {assignRanks(
                      [...leaderboard].sort((a, b) => b.longest_streak - a.longest_streak),
                      'longest_streak'
                    ).map((entry) => (
                      <li key={entry.user_id}>
                        #{entry.rank} {entry.name || entry.email} — {entry.longest_streak} 🏆
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : challenges.length === 0 ? (
              <p>No challenges in this group yet.</p>
            ) : (
              <ul>
                {challenges.map((challenge) => (
                  <li key={challenge.id}>
                    <button onClick={() => openChallenge(challenge)}>
                      {challenge.name} — {challenge.check_in_type}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      ) : showRegister ? (
        <div>
          <h2>Register</h2>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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