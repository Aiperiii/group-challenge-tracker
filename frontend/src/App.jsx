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
  const [inviteCode, setInviteCode] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState([])
  const [groupTab, setGroupTab] = useState('challenges')   // 'challenges' or 'members'
  const [showIntro, setShowIntro] = useState(true)
  const [groupError, setGroupError] = useState('')
  const [copiedCode, setCopiedCode] = useState('')
  const [checkinHistory, setCheckinHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [noteValue, setNoteValue] = useState('')

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

    // Validate before sending
    if (!name) {
      setError('Please enter your name.')
      return
    }
    if (!email) {
      setError('Please enter your email.')
      return
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    try {
      const response = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email,  name: name, password: password, timezone: timezone }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(
          typeof data.detail === 'string'
            ? data.detail
            : 'Registration failed — please check your details.'
        )
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
    setShowHistory(false)   // always start on the check-in screen, not history
    setLeaderboardView('current')  

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
    await fetchCheckinHistory(challenge.id)
  }

  async function handleCheckin(challenge) {
    setCheckinMessage('')

    // Numeric challenges require a value before checking in.
    if (challenge.check_in_type === 'numeric' && !numericValue) {
      setCheckinMessage('Please enter a value first.')
      return
    }
    
    if (challenge.check_in_type === 'text' && !noteValue) {
      setCheckinMessage('Please write a note first.')
      return
    }

    const token = localStorage.getItem('token')

    // Build the request body based on the challenge type.
    let body = {}
    if (challenge.check_in_type === 'numeric') {
      body = { value: Number(numericValue) }
    } else if (challenge.check_in_type === 'text') {
      body = { note: noteValue }
    } else {
      body = {}  // boolean: no value/note
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
        `✓ Checked in for today — see you tomorrow`
      )
      setCurrentStreak(data.current_streak)
      setNumericValue('')
      setNoteValue('')
      fetchCheckinHistory(challenge.id)   // refresh history after checking in
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

  async function fetchCheckinHistory(challengeId) {
    const token = localStorage.getItem('token')
    try {
      const response = await fetch(
        `http://localhost:8000/challenges/${challengeId}/my-checkins`,
        { headers: { 'Authorization': 'Bearer ' + token } }
      )
      const data = await response.json()
      setCheckinHistory(data)
    } catch (err) {
      setCheckinHistory([])
    }
  }

  function hasStarted(challenge) {
    const start = new Date(challenge.start_date)
    const today = new Date()
    // compare dates only (ignore time)
    today.setHours(0, 0, 0, 0)
    start.setHours(0, 0, 0, 0)
    return today >= start
  }

  function handleLogout() {
    localStorage.removeItem('token')
    setLoggedIn(false)
    setUser(null)
    setEmail('')
    setPassword('')
    setName('')
    // return to the intro/landing page
    setShowIntro(true)
    setShowRegister(false)
    // clear app data
    setGroups([])
    setChallenges([])
    setSelectedGroup('')
    setSelectedChallenge(null)
    setGroupMembers([])
    setLeaderboard([])
    setShowCreateChallenge(false)
    setShowHistory(false)
    setCheckinHistory([])
    setNewName('')
    setNewDescription('')
    setNewDurationDays('')
    setNewStartDate('')
    setNewGoalValue('')
    setNewGroupName('')
    setInviteCode('')
    setError('')
    setGroupError('')
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

    if (!newDurationDays || Number(newDurationDays) <= 0) {
      setError('Please enter a duration (a positive number of days).')
      return
    }
    if (!newStartDate) {
      setError('Please choose a start date.')
      return
    }
    // Numeric challenges need a goal value.
    if (newCheckInType === 'numeric' && !newGoalValue) {
      setError('Please enter a goal value for a number challenge.')
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
        `http://localhost:8000/groups/${selectedGroup.id}/challenges`,
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
      setNewDurationDays('')       
      setNewCheckInType('boolean')

      // Reload only the current group's challenges (not all groups)
      const challengesResponse = await fetch(
        `http://localhost:8000/groups/${selectedGroup.id}/challenges`,
        { headers: { 'Authorization': 'Bearer ' + token } }
      )
      const challengesData = await challengesResponse.json()
      setChallenges(challengesData)
    } catch (err) {
      setError('Could not reach the server.')
    }
  }


  async function openGroup(group) {
    setSelectedGroup(group)
    setSelectedChallenge(null)   // clear any open challenge when switching groups
    setGroupTab('challenges')     // reset to challenges tab
    const token = localStorage.getItem('token')
    try {
      const response = await fetch(
        `http://localhost:8000/groups/${group.id}/challenges`,
        { headers: { 'Authorization': 'Bearer ' + token } }
      )
      const data = await response.json()
      setChallenges(data)   // now `challenges` holds ONLY this group's challenges
      await fetchMembers(group.id)   // also load the group's members
    } catch (err) {
      setError('Could not load challenges for this group.')
    }
  }


  async function handleJoinGroup(){
    setError('')
    const token = localStorage.getItem('token')

    if(!inviteCode){
      setError('Please enter an invite code.')
      return
    }
    try {
      const response = await fetch('http://localhost:8000/groups/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ invite_code: inviteCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(
          typeof data.detail === 'string' ? data.detail : 'Could not join group.'
        )
        return
      }

      // Success — refresh groups so the new one appears, and clear the field.
      setError('')
      setInviteCode('')
      await fetchGroupsAndChallenges(token)
    } catch (err) {
      setError('Could not reach the server.')
    }
  }

  async function handleCreateGroup() {
    setGroupError('')
    const token = localStorage.getItem('token')

    if (!newGroupName) {
      setGroupError('Please enter a group name.')
      return
    }

    try {
      const response = await fetch('http://localhost:8000/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ name: newGroupName }),
      })

      const data = await response.json()

      if (!response.ok) {
        setGroupError(
          typeof data.detail === 'string' ? data.detail : 'Could not create group.'
        )
        return
      }

      // Success — refresh groups so the new one appears, and clear the field.
      setGroupError('')
      setNewGroupName('')
      await fetchGroupsAndChallenges(token)
    } catch (err) {
      setGroupError('Could not reach the server.')
    }
  }

  async function fetchMembers(groupId) {
    const token = localStorage.getItem('token')
    try {
      const response = await fetch(
        `http://localhost:8000/groups/${groupId}/members`,
        { headers: { 'Authorization': 'Bearer ' + token } }
      )
      const data = await response.json()
      setGroupMembers(data)
    } catch (err) {
      setError('Could not load members.')
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetchMe(token)   // re-log-in using the stored token
    }
  }, [])

  function challengeDay(challenge) {
    const start = new Date(challenge.start_date)
    const today = new Date()
    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1
    return Math.max(1, Math.min(diffDays, challenge.duration_days))
  }

  // Show a check-in's logged content: value (numeric), note (text), or ✓ (boolean)
  function checkinDisplay(ch) {
    if (ch.value !== null) return ch.value
    if (ch.note !== null) return ch.note
    return '✓'
  }

  // Reusable leaderboard rows (used inside the two-column layout)
  function renderLeaderboard() {
    if (leaderboard.length === 0) {
      return <p className="muted">No streaks yet.</p>
    }
    if (leaderboardView === 'current') {
      return (
        <div>
          {assignRanks(leaderboard, 'current_streak').map((entry) => (
            <div key={entry.user_id} className={`lb-row ${entry.rank === 1 ? 'rank-1' : ''}`}>
              <span className="lb-rank">#{entry.rank}</span>
              <span className="avatar">{(entry.name || entry.email).charAt(0).toUpperCase()}</span>
              <span className="lb-name">
                {entry.name || entry.email}
                {entry.user_id === user.id && <span className="you-tag"> (you)</span>}
              </span>
              <span className="lb-streak">{entry.current_streak} 🔥</span>
            </div>
          ))}
        </div>
      )
    }
    return (
      <div>
        {assignRanks(
          [...leaderboard].sort((a, b) => b.longest_streak - a.longest_streak),
          'longest_streak'
        ).map((entry) => (
          <div key={entry.user_id} className={`lb-row ${entry.rank === 1 ? 'rank-1' : ''}`}>
            <span className="lb-rank">#{entry.rank}</span>
            <span className="avatar">{(entry.name || entry.email).charAt(0).toUpperCase()}</span>
            <span className="lb-name">
              {entry.name || entry.email}
              {entry.user_id === user.id && <span className="you-tag"> (you)</span>}
            </span>
            <span className="lb-streak">{entry.longest_streak} 🏆</span>
          </div>
        ))}
      </div>
    )
  }

  function copyInviteCode(code) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(''), 1500)
  }

  // RETURN starts here
  return (
    <div className="app">
      <div className="app-header">
        <div className="brand">
          <span className="brand-logo">⚡</span>
          Challenge Tracker
        </div>
        {loggedIn && (
          <div className="header-user">
            <span className="brand-who">Hi, {user.name}</span>
            <button className="btn-logout" onClick={handleLogout}>Log out</button>
          </div>
        )}
      </div>

      {loggedIn ? (
        <div>
          {!selectedGroup ? (
            // ---- GROUPS LIST (no group selected) ----
            <div>
              <h1 className="title">Your groups</h1>
              <p className="subtitle">Pick a group, or start a new one.</p>

              {groups.length === 0 ? (
                <p className="muted">You're not in any groups yet.</p>
              ) : (
                <div>
                  {groups.map((group) => (
                    <button key={group.id} className="card-btn card-row" onClick={() => openGroup(group)}>
                      <span className="card-title">{group.name}</span>
                      <span className="card-meta">
                        Invite code:{' '}
                        <span
                          className="code-pill code-copy"
                          onClick={(e) => { e.stopPropagation(); copyInviteCode(group.invite_code) }}
                        >
                          {copiedCode === group.invite_code ? 'Copied! ✓' : `${group.invite_code} 📋`}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="eyebrow eyebrow-green">Join a group</div>
              <div className="row">
                <input
                  type="text"
                  placeholder="Enter invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                />
                <button className="btn btn-small" onClick={handleJoinGroup}>Join</button>
              </div>
              {error && <p className="error-text">{error}</p>}

              <div className="eyebrow eyebrow-blue">Create a group</div>
              <div className="row">
                <input
                  type="text"
                  placeholder="Group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
                <button className="btn btn-small btn-accent" onClick={handleCreateGroup}>Create</button>
              </div>
              {groupError && <p className="error-text">{groupError}</p>}
            </div>
          ) : (
            // ---- INSIDE A GROUP (a group is selected) ----
            <div>
              {!selectedChallenge && (
                <>
                  <button className="back" onClick={() => { setSelectedGroup(null); setSelectedChallenge(null) }}>
                    ← Back to groups
                  </button>
                  <h1 className="title">{selectedGroup.name}</h1>
                  <p className="group-code">
                    Invite code:{' '}
                    <button className="code-pill code-copy" onClick={() => copyInviteCode(selectedGroup.invite_code)}>
                    {copiedCode === selectedGroup.invite_code ? 'Copied! ✓' : `${selectedGroup.invite_code} 📋`}
                    </button>
                  </p>

                  <div className="toggle group-tabs">
                    <button className={groupTab === 'challenges' ? 'on' : ''} onClick={() => setGroupTab('challenges')}>
                      Challenges
                    </button>
                    <button className={groupTab === 'members' ? 'on' : ''} onClick={() => setGroupTab('members')}>
                      Members
                    </button>
                  </div>
                </>
              )}

              {groupTab === 'members' ? (
                // ---- MEMBERS LIST ----
                <div>
                  {groupMembers.map((m) => (
                    <div key={m.user_id} className={`lb-row ${m.user_id === user.id ? 'me' : ''}`}>
                      <span className="avatar">{(m.name || m.email).charAt(0).toUpperCase()}</span>
                      <span className="lb-name">
                        {m.name || m.email}
                        {m.user_id === user.id && <span className="you-tag"> (you)</span>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : selectedChallenge ? (
                showHistory ? (
                  // ---- CHECK-IN HISTORY VIEW ----
                  <div>
                    <button className="back" onClick={() => setShowHistory(false)}>
                      ← {selectedChallenge.name}
                    </button>
                    <h1 className="title">Your check-ins</h1>
                    <p className="subtitle">{selectedChallenge.name}</p>

                    {checkinHistory.length === 0 ? (
                      <p className="muted">No check-ins yet.</p>
                    ) : (
                      <div className="space">
                        {checkinHistory.map((ch, i) => (
                          <div key={i} className="history-row">
                            <span className="history-date">{ch.date}</span>
                            <span className="history-value">{checkinDisplay(ch)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // ---- CHECK-IN + LEADERBOARD (two columns on desktop) ----
                  <div>
                    <button className="back" onClick={() => { setSelectedChallenge(null); setCheckinMessage('') }}>
                      ← {selectedGroup.name}
                    </button>

                    <h1 className="title">{selectedChallenge.name}</h1>
                    {selectedChallenge.description && (
                      <p className="challenge-desc">{selectedChallenge.description}</p>
                    )}
                    <p className="subtitle">Check in every day to keep your streak.</p>

                    <div className="checkin-layout">
                      {/* LEFT: streak + check-in */}
                      <div className="checkin-left">
                        <div className="streak-hero">
                          <div className="streak-num">{currentStreak}</div>
                          <div className="streak-label">Day streak 🔥</div>
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{ width: `${(challengeDay(selectedChallenge) / selectedChallenge.duration_days) * 100}%` }}
                            ></div>
                          </div>
                          <p className="progress-text">
                            Day {challengeDay(selectedChallenge)} of {selectedChallenge.duration_days}
                          </p>
                        </div>

                        {!hasStarted(selectedChallenge) ? (
                          <div className="checked-badge space" style={{background: 'var(--surface-2)', color: 'var(--text-dim)', borderColor: 'var(--border)'}}>
                            Starts on {selectedChallenge.start_date}
                          </div>
                        ) : selectedChallenge.check_in_type === 'numeric' ? (
                          <div>
                            <input
                              type="number"
                              placeholder="Enter your value"
                              value={numericValue}
                              onChange={(e) => setNumericValue(e.target.value)}
                            />
                            <button className="btn btn-checkin" onClick={() => handleCheckin(selectedChallenge)}>Log today</button>
                          </div>
                        ) : selectedChallenge.check_in_type === 'text' ? (
                          <div>
                            <input
                              type="text"
                              placeholder="Write your note..."
                              value={noteValue}
                              onChange={(e) => setNoteValue(e.target.value)}
                            />
                            <button className="btn btn-checkin" onClick={() => handleCheckin(selectedChallenge)}>Save note</button>
                          </div>
                        ) : (
                          <button className="btn btn-checkin" onClick={() => handleCheckin(selectedChallenge)}>I did it today ✓</button>
                        )}

                        {checkinMessage && (
                          <div className="checked-badge space">{checkinMessage}</div>
                        )}

                        {checkinHistory.length > 0 && (
                          <button className="btn btn-ghost space" onClick={() => setShowHistory(true)}>
                            View your check-ins ({checkinHistory.length})
                          </button>
                        )}
                      </div>

                      {/* RIGHT: leaderboard */}
                      <div className="checkin-right">
                        <div className="eyebrow">Leaderboard</div>
                        <div className="toggle">
                          <button className={leaderboardView === 'current' ? 'on' : ''} onClick={() => setLeaderboardView('current')}>
                            Current streak 🔥
                          </button>
                          <button className={leaderboardView === 'longest' ? 'on' : ''} onClick={() => setLeaderboardView('longest')}>
                            Longest streak 🏆
                          </button>
                        </div>

                        {renderLeaderboard()}

                        <div className="live-badge space">⚡ Live — updates the moment anyone checks in</div>
                      </div>
                    </div>
                  </div>
                )
              ) : challenges.length === 0 ? (
                <p className="muted">No challenges in this group yet.</p>
              ) : (
                // CHALLENGE LIST
                <div>
                  {challenges.map((challenge) => (
                    <button key={challenge.id} className="card-btn" onClick={() => openChallenge(challenge)}>
                      <div className="card-title">
                        {challenge.name}
                        <span className={
                          challenge.check_in_type === 'numeric' ? 'chip chip-num'
                          : challenge.check_in_type === 'text' ? 'chip chip-note'
                          : 'chip'
                        }>
                          {challenge.check_in_type === 'numeric' ? 'Track a number'
                          : challenge.check_in_type === 'text' ? 'Write a note'
                          : 'Check off ✓'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {groupTab === 'challenges' && !selectedChallenge && (
                <>
                  {!showCreateChallenge && (
                    <button className="btn btn-ghost space" onClick={() => setShowCreateChallenge(true)}>
                      + New challenge
                    </button>
                  )}
                  {showCreateChallenge && (
                    <div className="space">
                      <label>Name</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                      <label>Description (optional)</label>
                      <input
                        type="text"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                      />
                      <label>How do you check in?</label>
                      <select value={newCheckInType} onChange={(e) => setNewCheckInType(e.target.value)}>
                        <option value="boolean">Check off ✓ — just mark it done</option>
                        <option value="numeric">Track a number — log a value</option>
                        <option value="text">Write a note — a short entry</option>
                      </select>
                      <label>Duration (days)</label>
                      <input
                        type="number"
                        value={newDurationDays}
                        onChange={(e) => setNewDurationDays(e.target.value)}
                      />
                      <label>Start date</label>
                      <input
                        type="date"
                        value={newStartDate}
                        onChange={(e) => setNewStartDate(e.target.value)}
                      />
                      {newCheckInType === 'numeric' && (
                        <>
                          <label>Goal value</label>
                          <input
                            type="number"
                            placeholder="e.g. 10000"
                            value={newGoalValue}
                            onChange={(e) => setNewGoalValue(e.target.value)}
                          />
                        </>
                      )}
                      <div className="row space">
                        <button className="btn btn-ghost" onClick={() => setShowCreateChallenge(false)} style={{flex: 1}}>
                          Cancel
                        </button>
                        <button className="btn" onClick={handleCreateChallenge} style={{flex: 1}}>
                          Create challenge
                        </button>
                      </div>
                      {error && <p className="error-text">{error}</p>}
                    </div>
                  )}
                </>
              )}

            </div>
          )}
        </div>
      ) : showIntro ? (
        // ---- INTRO / LANDING ----
        <div className="intro">
          <div className="intro-mark">⚡</div>
          <h1 className="intro-title">Chase streaks with your crew.</h1>
          <p className="intro-sub">Set daily challenges, check in together, and watch the leaderboard live.</p>
          <button
            className="btn space"
            onClick={() => { setShowIntro(false); setShowRegister(true); setError(''); setName(''); setEmail(''); setPassword('') }}
          >
            Get started
          </button>
          <button
            className="btn btn-ghost space-sm"
            onClick={() => { setShowIntro(false); setShowRegister(false); setError(''); setName(''); setEmail(''); setPassword('') }}
          >
            Log in
          </button>
        </div>
      ) : showRegister ? (
        <div>
          <h1 className="title">Create account</h1>
          <p className="subtitle">Your streak starts here.</p>

          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label>Email</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label>Password</label>
          <input
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn space" onClick={handleRegister}>Register</button>
          {error && <p className="error-text">{error}</p>}
          <p className="center space muted">
            Already have an account?{' '}
            <button className="link" onClick={() => { setShowRegister(false); setError(''); setName(''); setEmail(''); setPassword('') }}>
              Log in
            </button>
          </p>
        </div>
      ) : (
        <div>
          <h1 className="title">Welcome</h1>
          <p className="subtitle">Log in to keep your streak going.</p>

          <label>Email</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn space" onClick={handleLogin}>Log in</button>
          {error && <p className="error-text">{error}</p>}
          <p className="center space muted">
            New here?{' '}
            <button className="link" onClick={() => { setShowRegister(true); setError(''); setName(''); setEmail(''); setPassword('') }}>
              Create an account
            </button>
          </p>
        </div>
      )}
    </div>
  )
}


export default App
