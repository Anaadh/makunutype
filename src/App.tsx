import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dhivehiWords } from './data/words';
import { phoneticMap, reversePhoneticMap } from './data/keymap';
import ReCAPTCHA from 'react-google-recaptcha';
import './App.css';

const WORD_MODES = [5, 10, 20];
const TIME_MODES = [15, 30, 60, 120];

type TestMode = 'time' | 'words';
type AppView = 'typing' | 'leaderboard';

interface LetterState {
  char: string;
  status: 'correct' | 'incorrect' | 'extra' | 'none';
}

interface WordState {
  letters: LetterState[];
  original: string;
}

interface LeaderboardEntry {
  id?: string | number;
  name: string;
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  mode: string;
  config: number;
  created_at?: string;
}

const App: React.FC = () => {
  // Navigation
  const [currentView, setCurrentView] = useState<AppView>('typing');

  // Config state
  const [testMode, setTestMode] = useState<TestMode>('words');
  const [testConfig, setTestConfig] = useState<number>(10);

  // Game state
  const [words, setWords] = useState<WordState[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Final Stats
  const [wpm, setWpm] = useState(0);
  const [rawWpm, setRawWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  // UI state
  const [playerName, setPlayerName] = useState(localStorage.getItem('makunu_player_name') || '');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isFocused, setIsFocused] = useState(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [showHelper, setShowHelper] = useState<boolean>(localStorage.getItem('makunu_show_helper') === 'true' || true);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const wordsWrapperRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const getNewWords = useCallback((count: number): WordState[] => {
    const shuffled = [...dhivehiWords].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(word => ({
      original: word,
      letters: word.split('').map(char => ({ char, status: 'none' as const }))
    }));
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboard([]); // Clear stale data before loading new category
    setIsLoadingLeaderboard(true);
    setLeaderboardError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api/leaderboard';
      const response = await fetch(`${apiUrl}?mode=${testMode}&config=${testConfig}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setLeaderboard(data);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setLeaderboardError('ލީޑަރބޯޑު ލޯޑު ނުކުރެވުނު! ފަހުން އަލުން މަސައްކަތް ކޮށްލައްވާ.');
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [testMode, testConfig]);

  const resetTest = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const count = testMode === 'words' ? testConfig : 70;
    setWords(getNewWords(count));
    setCurrentWordIndex(0);
    setCurrentLetterIndex(0);
    setInputValue('');
    setStartTime(null);
    setEndTime(null);
    setIsFinished(false);
    setHasSaved(false);
    setWpm(0);
    setRawWpm(0);
    setAccuracy(0);
    setTimeLeft(testMode === 'time' ? testConfig : 0);

    inputRef.current?.focus();
    fetchLeaderboard();
  }, [testMode, testConfig, getNewWords, fetchLeaderboard]);

  useEffect(() => {
    // Ensure testConfig is valid for the current mode
    const currentModes = testMode === 'time' ? TIME_MODES : WORD_MODES;
    if (!currentModes.includes(testConfig)) {
      setTestConfig(currentModes[0]);
    }

    if (currentView === 'typing') {
      if (!startTime && !isFinished) resetTest();
    } else {
      fetchLeaderboard();
    }
  }, [currentView, testMode, testConfig, fetchLeaderboard]);

  const saveSessionScore = useCallback(async (stats: { wpm: number, rawWpm: number, accuracy: number }) => {
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/leaderboard$/, '') + '/session-score';
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          wpm: stats.wpm,
          raw_wpm: stats.rawWpm,
          accuracy: stats.accuracy,
          mode: testMode,
          config: testConfig
        }),
      });
    } catch (err) {
      console.error('Error saving session score:', err);
    }
  }, [testMode, testConfig]);

  const handleSaveScore = async () => {
    if (!playerName.trim() || hasSaved) return;

    // Check if recaptcha key is present in env, if so require token
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (siteKey && !recaptchaToken) {
      alert('Please complete the captcha!');
      return;
    }

    const payload = {
      name: playerName.trim(),
      recaptchaToken
    };

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api/leaderboard';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      setHasSaved(true);
      localStorage.setItem('makunu_player_name', playerName.trim());

      // Reset Recaptcha
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
      setRecaptchaToken(null);

      fetchLeaderboard();
    } catch (err) {
      console.error('Error saving score:', err);
      alert('ސްކޯ ސޭވް ނުކުރެވުނު! ފަހުން އަލުން މަސައްކަތް ކޮށްލައްވާ.');
    }
  };

  const endTest = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setEndTime(Date.now());
    setIsFinished(true);
  }, []);

  useEffect(() => {
    if (startTime && testMode === 'time' && !isFinished) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimeLeft((prev: number) => {
          if (prev <= 1) {
            endTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [startTime, testMode, isFinished, endTest]);

  const calculateStats = useCallback(() => {
    if (!startTime || !endTime) return;

    let correctLetters = 0;
    let incorrectLetters = 0;
    let extraLetters = 0;
    let missedLetters = 0;

    // Each currentWordIndex represents a space typed (or the final word completed)
    const spaces = currentWordIndex;

    words.forEach((word, wIdx) => {
      if (wIdx <= currentWordIndex) {
        word.letters.forEach((letter) => {
          if (letter.status === 'correct') {
            correctLetters++;
          } else if (letter.status === 'incorrect') {
            incorrectLetters++;
          } else if (letter.status === 'extra') {
            extraLetters++;
          } else if (letter.status === 'none' && wIdx < currentWordIndex) {
            // Count untyped letters in words that were skipped/passed
            missedLetters++;
          }
        });
      }
    });

    const durationInMinutes = (testMode === 'time' ? testConfig : (endTime - startTime) / 1000) / 60;

    // Standard WPM: (Correct Chars + Spaces) / 5 / minutes
    const calculatedWpm = Math.round(((correctLetters + spaces) / 5) / durationInMinutes);

    // Raw WPM: (All typed chars + extra + spaces) / 5 / minutes
    const totalTypedIncludingErrors = correctLetters + incorrectLetters + extraLetters + spaces;
    const calculatedRawWpm = Math.round((totalTypedIncludingErrors / 5) / durationInMinutes);

    // Realistic Accuracy: Correct / (Correct + Incorrect + Extra + Missed)
    // Spaces are assumed correct as they are required to move to the next word
    const totalPossible = correctLetters + incorrectLetters + extraLetters + missedLetters + spaces;
    const calculatedAccuracy = totalPossible > 0
      ? Math.round(((correctLetters + spaces) / totalPossible) * 100)
      : 0;

    setWpm(calculatedWpm);
    setRawWpm(calculatedRawWpm);
    setAccuracy(calculatedAccuracy);

    // Save to session immediately
    saveSessionScore({
      wpm: calculatedWpm,
      rawWpm: calculatedRawWpm,
      accuracy: calculatedAccuracy
    });
  }, [words, startTime, endTime, currentWordIndex, testMode, testConfig, saveSessionScore]);

  useEffect(() => {
    if (isFinished) {
      calculateStats();
    }
  }, [isFinished, calculateStats]);


  const updateCaretPosition = useCallback(() => {
    if (!caretRef.current || !wordsWrapperRef.current) return;

    const activeWord = wordsWrapperRef.current.querySelector('.word.active') as HTMLElement;
    if (!activeWord) return;

    const letters = activeWord.querySelectorAll('.letter');

    if (currentLetterIndex < letters.length) {
      const activeLetter = letters[currentLetterIndex] as HTMLElement;
      caretRef.current.style.display = 'block';
      caretRef.current.style.top = `${activeWord.offsetTop + activeLetter.offsetTop}px`;

      const pos = activeLetter.offsetLeft + activeLetter.offsetWidth;
      caretRef.current.style.left = `${activeWord.offsetLeft + pos}px`;
    } else {
      const lastLetter = letters[letters.length - 1] as HTMLElement;
      caretRef.current.style.display = 'block';
      caretRef.current.style.top = `${activeWord.offsetTop + lastLetter.offsetTop}px`;

      const pos = lastLetter.offsetLeft;
      caretRef.current.style.left = `${activeWord.offsetLeft + pos - 2}px`;
    }
  }, [currentLetterIndex, currentWordIndex]);

  useEffect(() => {
    if (currentView === 'typing') {
      updateCaretPosition();
      window.addEventListener('resize', updateCaretPosition);
    }
    return () => window.removeEventListener('resize', updateCaretPosition);
  }, [updateCaretPosition, currentView]);


  const handleCharInput = (char: string) => {
    if (isFinished || !startTime) {
      if (!isFinished) setStartTime(Date.now());
    }

    const mappedChar = phoneticMap[char] || char;
    const newWords = [...words];
    const currentWord = newWords[currentWordIndex];
    const typedIdx = inputValue.length;

    if (typedIdx < currentWord.original.length) {
      const expected = currentWord.original[typedIdx];
      currentWord.letters[typedIdx].status = mappedChar === expected ? 'correct' : 'incorrect';
    } else {
      currentWord.letters.push({ char: mappedChar, status: 'extra' });
    }

    setWords(newWords);
    const newValue = inputValue + mappedChar;
    setInputValue(newValue);
    setCurrentLetterIndex(newValue.length);

    // Auto-end test if last character of last word is reached (in words mode)
    if (testMode === 'words' &&
      currentWordIndex === testConfig - 1 &&
      newValue === currentWord.original) {
      endTest();
    }
  };

  const handleSpaceInput = () => {
    if (inputValue.length > 0) {
      if (testMode === 'words' && currentWordIndex === testConfig - 1) {
        endTest();
      } else {
        if (testMode === 'time' && currentWordIndex > words.length - 20) {
          setWords((prev: WordState[]) => [...prev, ...getNewWords(50)]);
        }

        setCurrentWordIndex((prev: number) => prev + 1);
        setCurrentLetterIndex(0);
        setInputValue('');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isFinished) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      resetTest();
      return;
    }

    if (!isFocused) return;

    if (e.key === ' ') {
      e.preventDefault();
      handleSpaceInput();
      return;
    }

    if (e.key === 'Backspace') {
      if (inputValue.length > 0) {
        setInputValue((prev: string) => prev.slice(0, -1));
        const newWords = [...words];
        const currentWord = newWords[currentWordIndex];

        if (inputValue.length > currentWord.original.length) {
          currentWord.letters.pop();
        } else {
          currentWord.letters[inputValue.length - 1].status = 'none';
        }
        setWords(newWords);
        setCurrentLetterIndex((prev: number) => prev - 1);
      }
      return;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFinished) return;

    const val = e.target.value;
    if (val.length > 0) {
      const char = val.slice(-1);
      if (char === ' ') {
        handleSpaceInput();
      } else {
        handleCharInput(char);
      }
      // Clear the input so it's ready for the next character
      e.target.value = '';
    }
  };

  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter') {
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const mappedChar = phoneticMap[e.key] || e.key;
      const target = e.target as HTMLInputElement;
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      const val = target.value;

      const newVal = val.substring(0, start) + mappedChar + val.substring(end);
      setPlayerName(newVal);

      // Reset cursor position after state update
      setTimeout(() => {
        target.setSelectionRange(start + mappedChar.length, start + mappedChar.length);
      }, 0);
    }
  };

  useEffect(() => {
    const onBlur = () => setIsFocused(false);
    const onFocus = () => setIsFocused(true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const focusInput = () => {
    if (isFinished || currentView !== 'typing') return;
    inputRef.current?.focus();
    setIsFocused(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <>
      <header>
        <div className="logo" onClick={() => setCurrentView('typing')}>
          <div className="icon"><img src="/logo.png" alt="Logo" width={40} /></div>
          <div className="text">މަކުނު ޓައިޕް</div>
        </div>

        <div className="header-actions">
          {(!startTime && !isFinished) || currentView === 'leaderboard' ? (
            <div className="settings-bar">
              <div className="setting-group">
                <button
                  className={`mode-btn ${testMode === 'time' ? 'active' : ''}`}
                  onClick={() => { setTestMode('time'); setTestConfig(30); }}
                >
                  ވަގުތު
                </button>
                <button
                  className={`mode-btn ${testMode === 'words' ? 'active' : ''}`}
                  onClick={() => { setTestMode('words'); setTestConfig(10); }}
                >
                  ބަސްތައް
                </button>
              </div>
              <div className="divider"></div>
              <div className="setting-group">
                {(testMode === 'time' ? TIME_MODES : WORD_MODES).map(val => (
                  <button
                    key={val}
                    className={`config-btn ${testConfig === val ? 'active' : ''}`}
                    onClick={() => setTestConfig(val)}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <div className="divider"></div>
              <div className="setting-group">
                <button
                  className={`mode-btn ${showHelper ? 'active' : ''}`}
                  onClick={() => {
                    const newVal = !showHelper;
                    setShowHelper(newVal);
                    localStorage.setItem('makunu_show_helper', String(newVal));
                  }}
                  title="Show English keys helper"
                >
                  އެހީ
                </button>
              </div>
            </div>
          ) : null}

          <button
            className={`leaderboard-btn ${currentView === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('leaderboard')}
            title="Leaderboard"
          >
            🏆
          </button>
        </div>
      </header>

      <main onClick={focusInput}>
        {currentView === 'typing' ? (
          <>
            {!isFinished && testMode === 'time' && startTime && (
              <div className="live-timer">
                {timeLeft}
              </div>
            )}

            {!isFocused && !isFinished && (
              <div className="focus-overlay">
                ކިޔަން ފަށަން މިތަނަށް ފިތާލާ
              </div>
            )}

            {!isFinished ? (
              <>
                <div className={`typing-container ${!isFocused ? 'blurred' : ''}`}>
                  <input
                    ref={inputRef}
                    type="text"
                    className="input-field"
                    onKeyDown={handleKeyDown}
                    onChange={handleInputChange}
                    autoFocus
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  <div className="words-wrapper" ref={wordsWrapperRef}>
                    <div className="caret blink" ref={caretRef}></div>
                    {words.map((word: WordState, wIdx: number) => (
                      <div
                        key={wIdx}
                        className={`word ${wIdx === currentWordIndex ? 'active' : ''}`}
                      >
                        {word.letters.map((letter: LetterState, lIdx: number) => (
                          <span
                            key={lIdx}
                            className={`letter ${letter.status}`}
                          >
                            {letter.char}
                            {showHelper && letter.status === 'none' && (
                              <span className="letter-trans">
                                {reversePhoneticMap[letter.char] || ''}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <button className="restart-btn" onClick={resetTest} title="Restart (Tab)">
                  ↻
                </button>
              </>
            ) : (
              <div className="results-container">
                <div className="results-summary">
                  <div className="stat-main">
                    <div className="label">WPM</div>
                    <div className="value">{wpm}</div>
                  </div>
                  <div className="stat-main">
                    <div className="label">Accuracy</div>
                    <div className="value">{accuracy}%</div>
                  </div>
                  <div className="stat-secondary">
                    <div className="stat-item">
                      <span className="label">Raw WPM</span>
                      <span className="value">{rawWpm}</span>
                    </div>
                    <div className="stat-item">
                      <span className="label">Mode</span>
                      <span className="value" style={{ fontFamily: 'var(--thaana-font)' }}>{testMode === 'time' ? 'ވަގުތު' : 'ބަސްތައް'} {testConfig} {testMode === 'time' ? 'ސިކުންތު' : 'ބަސް'}</span>
                    </div>
                  </div>
                </div>

                {!hasSaved ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="save-score-container">
                      <input
                        type="text"
                        placeholder="ނަން ޖައްސަވާ..."
                        className="name-input"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveScore();
                          } else {
                            handleNameInputKeyDown(e);
                          }
                        }}
                        maxLength={15}
                      />
                    </div>

                    {import.meta.env.VITE_RECAPTCHA_SITE_KEY && (
                      <div style={{ marginTop: '1rem' }}>
                        <ReCAPTCHA
                          sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                          onChange={(token: string | null) => setRecaptchaToken(token)}
                          ref={recaptchaRef}
                        />
                      </div>
                    )}

                    <button className="save-btn" onClick={handleSaveScore} style={{ marginTop: '1rem' }}>
                      ސްކޯ ސޭވް ކުރަން
                    </button>
                  </div>
                ) : (
                  <div className="score-saved">ސްކޯ ސޭވް ކުރެވިއްޖެ! ✨</div>
                )}

                <button className="restart-btn" onClick={resetTest}>
                  ↻ އަލުން ފަށަން
                </button>

                <div className="leaderboard">
                  <h2 className="leaderboard-title">
                    {testMode === 'time' ? 'ވަގުތު' : 'ބަސްތައް'} {testConfig} - އެންމެ މަތީ ސްކޯތައް
                  </h2>
                  <div className="leaderboard-list">
                    {isLoadingLeaderboard ? (
                      <div className="leaderboard-empty">ލީޑަރބޯޑު ލޯޑުވަނީ...</div>
                    ) : leaderboardError ? (
                      <div className="leaderboard-empty" style={{ color: '#ff4b2b' }}>{leaderboardError}</div>
                    ) : leaderboard.length === 0 ? (
                      <div className="leaderboard-empty">އަދި މި ކެޓަގަރީއިން އެއްވެސް ސްކޯއެއް ނެތް</div>
                    ) : (
                      leaderboard.map((entry: LeaderboardEntry, idx: number) => (
                        <div key={idx} className="leaderboard-item">
                          <span className="rank">#{idx + 1}</span>
                          <span className="l-name">{entry.name}</span>
                          <span className="l-wpm">{entry.wpm} WPM</span>
                          <span className="l-raw">({entry.raw_wpm})</span>
                          <span className="l-acc">{entry.accuracy}%</span>
                          <span className="l-date">{formatDate(entry.created_at)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="results-container">
            <div className="leaderboard" style={{ marginTop: 0 }}>
              <h2 className="leaderboard-title" style={{ fontSize: '2rem', marginBottom: '2rem' }}>
                {testMode === 'time' ? 'ވަގުތު' : 'ބަސްތައް'} {testConfig} - ގްލޯބަލް ލީޑަރބޯޑު
              </h2>
              <div className="leaderboard-list">
                {isLoadingLeaderboard ? (
                  <div className="leaderboard-empty">ލީޑަރބޯޑު ލޯޑުވަނީ...</div>
                ) : leaderboardError ? (
                  <div className="leaderboard-empty" style={{ color: '#ff4b2b' }}>{leaderboardError}</div>
                ) : leaderboard.length === 0 ? (
                  <div className="leaderboard-empty">އަދި މި ކެޓަގަރީއިން އެއްވެސް ސްކޯއެއް ނެތް</div>
                ) : (
                  leaderboard.map((entry: LeaderboardEntry, idx: number) => (
                    <div key={idx} className="leaderboard-item">
                      <span className="rank">#{idx + 1}</span>
                      <span className="l-name">{entry.name}</span>
                      <span className="l-wpm">{entry.wpm} WPM</span>
                      <span className="l-raw">({entry.raw_wpm})</span>
                      <span className="l-acc">{entry.accuracy}%</span>
                      <span className="l-date">{formatDate(entry.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
              <button className="restart-btn" style={{ fontSize: '1.2rem', marginTop: '3rem' }} onClick={() => setCurrentView('typing')}>
                ← އަނބުރާ ޓައިޕިންގް އަށް
              </button>
            </div>
          </div>
        )}
      </main>

      <footer>
        ކީބޯޑު ބޭނުންކޮށްގެން ޓައިޕް ކުރަން ފަށާ (Tab އަށް ފިތާލުމުން އަލުން ފެށޭނެ)
        <br />
        <span style={{ opacity: 0.5, fontSize: '1rem', color: 'var(--main-color)' }}>
          A CSR Project of <a href="https://javaabu.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}><img src="/javaabu-logo-white.svg" alt="Javaabu" style={{ width: '1rem', height: '1rem' }} /> Javaabu</a> {new Date().getFullYear()}
        </span>
      </footer>
    </>
  );
};

export default App;
