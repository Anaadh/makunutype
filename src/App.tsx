import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dhivehiWords } from './data/words';
import { phoneticMap } from './data/keymap';
import { supabase } from './lib/supabase';
import './App.css';

const WORD_MODES = [10, 25, 50, 100];
const TIME_MODES = [15, 30, 60, 120];

type TestMode = 'time' | 'words';

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
  // Config state
  const [testMode, setTestMode] = useState<TestMode>('words');
  const [testConfig, setTestConfig] = useState<number>(25);

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

  const inputRef = useRef<HTMLInputElement>(null);
  const wordsWrapperRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<number | null>(null);

  const getNewWords = useCallback((count: number): WordState[] => {
    const shuffled = [...dhivehiWords].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(word => ({
      original: word,
      letters: word.split('').map(char => ({ char, status: 'none' as const }))
    }));
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoadingLeaderboard(true);
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('mode', testMode)
        .eq('config', testConfig)
        .order('wpm', { ascending: false })
        .limit(10);

      if (error) throw error;
      if (data) setLeaderboard(data);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      const saved = localStorage.getItem(`makunu_leaderboard_v3_${testMode}_${testConfig}`);
      if (saved) setLeaderboard(JSON.parse(saved));
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

    if (wordsWrapperRef.current) {
      wordsWrapperRef.current.style.transform = 'translateY(0)';
    }
    inputRef.current?.focus();
    fetchLeaderboard();
  }, [testMode, testConfig, getNewWords, fetchLeaderboard]);

  useEffect(() => {
    resetTest();
  }, [resetTest]);

  const handleSaveScore = async () => {
    if (!playerName.trim() || hasSaved) return;

    const newEntry: Omit<LeaderboardEntry, 'id' | 'created_at'> = {
      name: playerName.trim(),
      wpm,
      raw_wpm: rawWpm,
      accuracy,
      mode: testMode,
      config: testConfig
    };

    try {
      const { error } = await supabase
        .from('leaderboard')
        .insert([newEntry]);

      if (error) throw error;

      setHasSaved(true);
      localStorage.setItem('makunu_player_name', playerName.trim());
      fetchLeaderboard();
    } catch (err) {
      console.error('Error saving score:', err);
      const localKey = `makunu_leaderboard_v3_${testMode}_${testConfig}`;
      const saved = localStorage.getItem(localKey);
      const localLeaderboard = saved ? JSON.parse(saved) : [];
      const updated = [...localLeaderboard, { ...newEntry, created_at: new Date().toISOString() }]
        .sort((a, b) => b.wpm - a.wpm)
        .slice(0, 10);
      localStorage.setItem(localKey, JSON.stringify(updated));
      setLeaderboard(updated);
      setHasSaved(true);
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
    let totalTypedLetters = 0;
    let mistakes = 0;

    const relevantWords = words.slice(0, currentWordIndex + 1);

    relevantWords.forEach((word: WordState) => {
      word.letters.forEach((letter: LetterState) => {
        if (letter.status === 'correct') {
          correctLetters++;
        } else if (letter.status === 'incorrect' || letter.status === 'extra') {
          mistakes++;
        }

        if (letter.status !== 'none') {
          totalTypedLetters++;
        }
      });
    });

    const durationInMinutes = (testMode === 'time' ? testConfig : (endTime - startTime) / 1000) / 60;

    const calculatedWpm = Math.round((correctLetters / 5) / durationInMinutes);
    const calculatedRawWpm = Math.round(((correctLetters + mistakes) / 5) / durationInMinutes);
    const calculatedAccuracy = totalTypedLetters > 0 ? Math.round((correctLetters / totalTypedLetters) * 100) : 0;

    setWpm(calculatedWpm);
    setRawWpm(calculatedRawWpm);
    setAccuracy(calculatedAccuracy);
  }, [words, startTime, endTime, currentWordIndex, testMode, testConfig]);

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
    updateCaretPosition();
    window.addEventListener('resize', updateCaretPosition);
    return () => window.removeEventListener('resize', updateCaretPosition);
  }, [updateCaretPosition]);

  useEffect(() => {
    if (!wordsWrapperRef.current) return;
    const activeWord = wordsWrapperRef.current.querySelector('.word.active') as HTMLElement;
    if (activeWord) {
      const wordTop = activeWord.offsetTop;
      const lineHeight = 64;
      if (wordTop > lineHeight) {
        wordsWrapperRef.current.style.transform = `translateY(-${wordTop - lineHeight}px)`;
      } else {
        wordsWrapperRef.current.style.transform = `translateY(0)`;
      }
    }
  }, [currentWordIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isFinished) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      resetTest();
      return;
    }

    if (!isFocused) return;

    if (!startTime && e.key.length === 1 && e.key !== ' ') {
      setStartTime(Date.now());
    }

    if (e.key === ' ') {
      e.preventDefault();
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

    if (e.key.length === 1) {
      e.preventDefault();
      const mappedChar = phoneticMap[e.key] || e.key;
      const newValue = inputValue + mappedChar;
      setInputValue(newValue);

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
      setCurrentLetterIndex(newValue.length);
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
    if (isFinished) return;
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
        <div className="logo" onClick={() => window.location.reload()}>
          <div className="icon">🕷️</div>
          <div className="text">މަކުނު ޓައިޕް</div>
        </div>

        {!startTime && !isFinished && (
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
                onClick={() => { setTestMode('words'); setTestConfig(25); }}
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
          </div>
        )}
      </header>

      <main onClick={focusInput}>
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
                  <span className="value">{testMode === 'time' ? 'ވަގުތު' : 'ބަސްތައް'} {testConfig} {testMode === 'time' ? 'ސިކުންތު' : 'ބަސް'}</span>
                </div>
              </div>
            </div>

            {!hasSaved ? (
              <div className="save-score-container">
                <input
                  type="text"
                  placeholder="ނަން ޖައްސަވާ..."
                  className="name-input"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveScore()}
                  maxLength={15}
                />
                <button className="save-btn" onClick={handleSaveScore}>
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
      </main>

      <footer>
        ކީބޯޑު ބޭނުންކޮށްގެން ޓައިޕް ކުރަން ފަށާ (Tab އަށް ފިތާލުމުން އަލުން ފެށޭނެ)
        <br />
        <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>MakunuType v2.0 - Built with love for Dhivehi</span>
      </footer>
    </>
  );
};

export default App;
