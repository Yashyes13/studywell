import { useEffect, useRef, useState } from 'react'
import './App.css'

const starterNotes = 'The water cycle moves water through evaporation, condensation, precipitation, and collection. The Sun heats liquid water, turning it into vapor. As vapor cools in the atmosphere, it condenses into clouds. Water then falls as rain or snow and gathers in rivers, lakes, and oceans.'

function Icon({ name, size = 18 }) {
  const paths = {
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>,
    quiz: <><path d="M9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    arrow: <><path d="M7 17 17 7"/><path d="M7 7h10v10"/></>,
    left: <><path d="m15 18-6-6 6-6"/></>,
    right: <><path d="m9 18 6-6-6-6"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [mode, setMode] = useState('flashcards')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('empty')
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [known, setKnown] = useState([])
  const [answers, setAnswers] = useState({})
  const [wrongOnly, setWrongOnly] = useState(false)
  const [retestIndices, setRetestIndices] = useState([])
  const [saved, setSaved] = useState(false)
  const requestRef = useRef(null)
  const textareaRef = useRef(null)

  const cards = result?.cards ?? []
  const questions = result?.questions ?? []
  const wrongQuestions = questions.filter((_, i) => answers[i] !== undefined && answers[i] !== questions[i]?.correctAnswer)
  const questionSet = wrongOnly ? retestIndices.map((questionIndex) => questions[questionIndex]).filter(Boolean) : questions
  const activeCard = cards[index]
  const activeQuestion = questionSet[index]
  const selectedAnswer = activeQuestion ? answers[questions.indexOf(activeQuestion)] : undefined
  const quizComplete = questions.length > 0 && Object.keys(answers).length === questions.length
  const retestComplete = wrongOnly && retestIndices.every((questionIndex) => answers[questionIndex] !== undefined)

  useEffect(() => () => requestRef.current?.abort(), [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return
      if (mode === 'flashcards' && result?.cards?.length) {
        if (event.code === 'Space') { event.preventDefault(); setRevealed((value) => !value) }
        if (event.key === 'ArrowRight') navigate(1)
        if (event.key === 'ArrowLeft') navigate(-1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function navigate(direction) {
    const length = mode === 'quiz' ? questionSet.length : cards.length
    setIndex((value) => Math.min(Math.max(value + direction, 0), length - 1))
    setRevealed(false)
  }

  async function generate() {
    const input = notes.trim()
    if (!input) {
      setError('Add a few notes or a topic first.')
      textareaRef.current?.focus()
      return
    }
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    let timedOut = false
    const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort() }, 60000)
    setStatus('loading')
    setError('')
    setSaved(false)
    setResult(null)
    setAnswers({})
    setKnown([])
    setIndex(0)
    setWrongOnly(false)
    try {
      const response = await fetch('/api/study-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, mode }),
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'The study set could not be created. Try again.')
      if (controller.signal.aborted) return
      if (mode === 'flashcards' && (!payload?.title || !Array.isArray(payload.cards) || !payload.cards.length)) throw new Error('The AI returned an empty flashcard set. Try adding more detail to your notes.')
      if (mode === 'quiz' && (!payload?.title || !Array.isArray(payload.questions) || !payload.questions.length)) throw new Error('The AI returned an empty quiz. Try adding more detail to your notes.')
      setResult(payload)
      setStatus('ready')
    } catch (cause) {
      if (cause.name === 'AbortError' && !timedOut) return
      setError(timedOut ? 'This is taking longer than expected. Please try again.' : cause.message || 'Something went wrong. Please try again.')
      setStatus('error')
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  function chooseAnswer(optionIndex) {
    const originalIndex = questions.indexOf(activeQuestion)
    if (answers[originalIndex] !== undefined) return
    setAnswers((previous) => ({ ...previous, [originalIndex]: optionIndex }))
  }

  function saveSession() {
    try {
      localStorage.setItem('study-session', JSON.stringify({ mode, notes, result, known, answers }))
      setSaved(true)
    } catch {
      setError('This session could not be saved in your browser.')
    }
  }

  function loadSession() {
    try {
      const session = JSON.parse(localStorage.getItem('study-session') || 'null')
      if (!session?.result) return
      setMode(session.mode)
      setNotes(session.notes || '')
      setResult(session.result)
      setKnown(session.known || [])
      setAnswers(session.answers || {})
      setStatus('ready')
      setIndex(0)
      setWrongOnly(false)
      setError('')
    } catch {
      setError('Your saved session could not be opened. Create a new one instead.')
      setStatus('error')
    }
  }

  function reset() {
    requestRef.current?.abort()
    setResult(null); setStatus('empty'); setError(''); setIndex(0); setAnswers({}); setKnown([]); setWrongOnly(false); setRetestIndices([]); setSaved(false)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); reset() }} aria-label="Studywell home"><span className="brand-mark"><Icon name="book" size={17} /></span><span>studywell</span></a>
        <div className="topbar-right"><span className="privacy-note"><span className="privacy-dot" /> Notes go to Gemini for generation</span><button className="saved-link" onClick={loadSession}>Saved session</button><div className="avatar" aria-label="Your profile">S</div></div>
      </header>

      <main id="home">
        <section className="workspace">
          <aside className="left-column">
            <div className="eyebrow"><span className="eyebrow-line" /> YOUR PERSONAL STUDY SPACE</div>
            <h1>Make learning<br />feel <span className="serif-accent">lighter.</span></h1>
            <p className="intro-copy">Turn your notes into a study session that sticks. Start with anything you’re learning.</p>

            <div className="input-card">
              <div className="input-card-top"><label htmlFor="study-notes">YOUR NOTES OR TOPIC</label><span className="optional-label">Paste or type</span></div>
              <textarea ref={textareaRef} id="study-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste your class notes, a tricky concept, or just a topic you want to understand…" maxLength={12000} />
              <div className="input-card-footer"><span className="char-count">{notes.length.toLocaleString()} / 12,000</span><button className="sample-link" onClick={() => { setNotes(starterNotes); setError('') }}>Try a sample <Icon name="arrow" size={14} /></button></div>
            </div>

            <div className="mode-label">CHOOSE YOUR STUDY STYLE</div>
            <div className="mode-picker" role="tablist" aria-label="Study style">
              <button role="tab" aria-selected={mode === 'flashcards'} className={mode === 'flashcards' ? 'mode-option active' : 'mode-option'} onClick={() => { setMode('flashcards'); setError(''); if (mode !== 'flashcards') reset() }}><span className="mode-icon"><Icon name="book" size={17} /></span><span className="mode-text"><b>Flashcards</b><small>Learn at your pace</small></span>{mode === 'flashcards' && <span className="mode-check"><Icon name="check" size={13} /></span>}</button>
              <button role="tab" aria-selected={mode === 'quiz'} className={mode === 'quiz' ? 'mode-option active' : 'mode-option'} onClick={() => { setMode('quiz'); setError(''); if (mode !== 'quiz') reset() }}><span className="mode-icon"><Icon name="quiz" size={17} /></span><span className="mode-text"><b>Quick quiz</b><small>Check what you know</small></span>{mode === 'quiz' && <span className="mode-check"><Icon name="check" size={13} /></span>}</button>
            </div>

            <button className="generate-button" onClick={generate} disabled={status === 'loading'}><Icon name="spark" size={18} />{status === 'loading' ? 'Building your study set…' : 'Create my study set'}<Icon name="arrow" size={16} /></button>
            {error && <div role="alert" className="error-box"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><Icon name="close" size={15} /></button></div>}
            <div className="trust-note"><span className="lock-icon">✳</span> Made for understanding, not just memorizing.</div>
          </aside>

          <section className="right-column" aria-label="Study set">
            <div className="study-panel">
              <div className="panel-heading"><div><div className="panel-kicker">YOUR STUDY SESSION</div><h2>{status === 'ready' ? result.title : mode === 'quiz' ? 'A little practice goes a long way.' : 'A calmer way to study.'}</h2></div>{status === 'ready' && <button className="new-set-button" onClick={reset}><Icon name="refresh" size={14} /> New set</button>}</div>

              {status === 'empty' && <div className="empty-state">
                <div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="empty-illustration"><span className="illustration-star star-a">✳</span><span className="illustration-star star-b">✦</span><div className="paper paper-back"/><div className="paper paper-front"><span/><span/><span/></div><div className="mini-spark"><Icon name="spark" size={20}/></div></div>
                <div className="empty-caption"><h3>Your next “aha!” moment<br/>starts here.</h3><p>Your study set will show up right here,<br/>ready when you are.</p></div>
                <div className="empty-footer"><span>✦</span> A little progress is still progress.</div>
              </div>}

              {status === 'loading' && <div className="loading-state" role="status"><div className="loader-orb"><Icon name="spark" size={25}/></div><h3>Putting your study set together</h3><p>Finding the ideas that matter most…</p><div className="loading-bar"><i/></div><small>This usually takes a few seconds</small></div>}

              {status === 'error' && <div className="panel-error"><div className="error-illustration">↻</div><h3>Let’s give that another try.</h3><p>{error}</p><button className="retry-button" onClick={generate}><Icon name="refresh" size={15}/> Try again</button></div>}

              {status === 'ready' && mode === 'flashcards' && activeCard && <div className="cards-view">
                <div className="set-meta"><span><span className="meta-dot"/> {cards.length} CARDS</span><span>{known.length} mastered</span></div>
                <div className="progress-track"><span style={{ width: `${((index + 1) / cards.length) * 100}%` }}/></div>
                <button className={`flashcard ${revealed ? 'is-revealed' : ''}`} onClick={() => setRevealed((v) => !v)} aria-label={revealed ? 'Show question' : 'Reveal answer'}>
                  <div className="card-corner"><span>{revealed ? 'THE ANSWER' : 'QUESTION'}</span><span className={`difficulty ${activeCard.difficulty || 'medium'}`}>{activeCard.difficulty || 'medium'}</span></div>
                  <div className="flashcard-content">{revealed ? <><div className="answer-check"><Icon name="spark" size={17}/></div><p>{activeCard.answer}</p>{activeCard.hint && <small>{activeCard.hint}</small>}</> : <p>{activeCard.question}</p>}</div>
                  <div className="flip-prompt">{revealed ? 'Click to see question' : 'Click to reveal'} <span>·</span> <kbd>Space</kbd></div>
                </button>
                <div className="card-controls"><button className="circle-control" onClick={() => navigate(-1)} disabled={index === 0} aria-label="Previous card"><Icon name="left"/></button><span className="card-count"><b>{String(index + 1).padStart(2, '0')}</b><i>/</i>{String(cards.length).padStart(2, '0')}</span><button className="circle-control" onClick={() => navigate(1)} disabled={index === cards.length - 1} aria-label="Next card"><Icon name="right"/></button></div>
                <div className="mastery-controls"><span>{known.includes(index) ? 'You’ve got this one.' : 'How did that feel?'}</span><button className={known.includes(index) ? 'mastery-button mastered' : 'mastery-button'} onClick={() => setKnown((value) => value.includes(index) ? value.filter((v) => v !== index) : [...value, index])}><Icon name="check" size={14}/>{known.includes(index) ? 'Got it' : 'I know this'}</button></div>
              </div>}

              {status === 'ready' && mode === 'quiz' && activeQuestion && <div className="quiz-view">
                <div className="set-meta"><span><span className="meta-dot"/> {wrongOnly ? 'RETEST' : 'QUICK QUIZ'}</span><span>{Object.keys(answers).length} of {questions.length} answered</span></div>
                <div className="progress-track"><span style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}/></div>
                <div className="question-area"><span className="question-count">QUESTION {String(questions.indexOf(activeQuestion) + 1).padStart(2, '0')}</span><h3>{activeQuestion.question}</h3><div className="answer-options">{activeQuestion.options.map((option, optionIndex) => {
                  const originalIndex = questions.indexOf(activeQuestion)
                  const isSelected = answers[originalIndex] === optionIndex
                  const answered = answers[originalIndex] !== undefined
                  const correct = optionIndex === activeQuestion.correctAnswer
                  return <button key={`${optionIndex}-${option}`} className={`answer-option ${answered && correct ? 'correct' : ''} ${isSelected && !correct ? 'incorrect' : ''}`} onClick={() => chooseAnswer(optionIndex)} disabled={answered}><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span>{answered && correct && <Icon name="check" size={17}/>}</button>
                })}</div>{selectedAnswer !== undefined && <div className={`explanation ${selectedAnswer === activeQuestion.correctAnswer ? 'right' : 'wrong'}`}><b>{selectedAnswer === activeQuestion.correctAnswer ? 'That’s right.' : 'Not quite.'}</b> {activeQuestion.explanation}</div>}</div>
                <div className="quiz-controls"><button className="circle-control" onClick={() => navigate(-1)} disabled={index === 0} aria-label="Previous question"><Icon name="left"/></button><span className="card-count"><b>{String(index + 1).padStart(2, '0')}</b><i>/</i>{String(questionSet.length).padStart(2, '0')}</span>{index < questionSet.length - 1 ? <button className="circle-control" onClick={() => navigate(1)} aria-label="Next question"><Icon name="right"/></button> : <span className="circle-control-spacer"/>}</div>
                {quizComplete && !wrongOnly && <div className="quiz-finish"><span>Quiz complete · {questions.length - wrongQuestions.length} of {questions.length} correct</span>{wrongQuestions.length > 0 && <button onClick={() => { const missed = wrongQuestions.map((question) => questions.indexOf(question)); setRetestIndices(missed); setAnswers((previous) => { const next = { ...previous }; missed.forEach((questionIndex) => delete next[questionIndex]); return next }); setWrongOnly(true); setIndex(0) }}>Retest {wrongQuestions.length} missed <Icon name="arrow" size={14}/></button>}</div>}
                {retestComplete && index === questionSet.length - 1 && <div className="quiz-finish"><span>Retest complete · nice work.</span><button onClick={() => { setWrongOnly(false); setIndex(0) }}>Back to quiz <Icon name="arrow" size={14}/></button></div>}
              </div>}

              {status === 'ready' && <div className="session-footer"><span><Icon name="book" size={13}/> A small step closer to knowing it.</span><button onClick={saveSession}>{saved ? 'Saved ✓' : 'Save session'}</button></div>}
            </div>
            <div className="bottom-note"><span className="bottom-star">✳</span><span>Good learning takes time. You’re right where you need to be.</span><span className="note-decoration">✦</span></div>
          </section>
        </section>
      </main>
      <footer className="site-footer"><span>studywell <span className="footer-separator">·</span> a little better, every day</span><span>MADE FOR THE WAY YOU LEARN</span></footer>
    </div>
  )
}

export default App
