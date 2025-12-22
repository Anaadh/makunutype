import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dhivehiWords } from './data/words';
import { phoneticMap } from './data/keymap';
import './App.css';

const WORD_COUNT = 50;

interface LetterState {
  char: string;
  status: 'correct' | 'incorrect' | 'extra' | 'none';
}

interface WordState {
  letters: LetterState[];
  original: string;
}

interface LeaderboardEntry {
  wpm: number;
  accuracy: number;
  date: string;
}

const App: React.FC = () => {
  const [words, setWords] = useState<WordState[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isFocused, setIsFocused] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const wordsWrapperRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);

  const generateWords = useCallback(() => {
    const shuffled = [...dhivehiWords].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, WORD_COUNT);
    const wordStates: WordState[] = selected.map(word => ({
      original: word,
      letters: word.split('').map(char => ({ char, status: 'none' }))
    }));
    setWords(wordStates);
    setCurrentWordIndex(0);
    setCurrentLetterIndex(0);
    setInputValue('');
    setStartTime(null);
    setEndTime(null);
    setIsFinished(false);
    setWpm(0);
    setAccuracy(0);
    if (wordsWrapperRef.current) {
      wordsWrapperRef.current.style.transform = 'translateY(0)';
    }
  }, []);

  useEffect(() => {
    generateWords();
    const saved = localStorage.getItem('makunu_leaderboard');
    if (saved) setLeaderboard(JSON.parse(saved));
  }, [generateWords]);

  const saveToLeaderboard = (newWpm: number, newAccuracy: number) => {
    const newEntry: LeaderboardEntry = {
      wpm: newWpm,
      accuracy: newAccuracy,
      date: new Date().toLocaleDateString()
    };
    const updated = [...leaderboard, newEntry].sort((a, b) => b.wpm - a.wpm).slice(0, 5);
    setLeaderboard(updated);
    localStorage.setItem('makunu_leaderboard', JSON.stringify(updated));
  };

  const calculateStats = useCallback(() => {
    if (!startTime || !endTime) return;

    let correctLetters = 0;
    let totalTyped = 0;

    words.forEach(word => {
      word.letters.forEach(letter => {
        if (letter.status === 'correct') correctLetters++;
        if (letter.status !== 'none' && letter.status !== 'extra') totalTyped++;
        if (letter.status === 'extra') totalTyped++;
      });
    });

    const durationInMinutes = (endTime - startTime) / 60000;
    const calculatedWpm = Math.round((correctLetters / 5) / durationInMinutes);
    const calculatedAccuracy = Math.round((correctLetters / totalTyped) * 100) || 0;

    setWpm(calculatedWpm);
    setAccuracy(calculatedAccuracy);
    saveToLeaderboard(calculatedWpm, calculatedAccuracy);
  }, [words, startTime, endTime, leaderboard]);

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
    const activeLetter = letters[currentLetterIndex] as HTMLElement;

    if (activeLetter) {
      caretRef.current.style.display = 'block';
      caretRef.current.style.top = `${activeWord.offsetTop + activeLetter.offsetTop}px`;
      caretRef.current.style.left = `${activeWord.offsetLeft + activeLetter.offsetLeft + activeLetter.offsetWidth}px`;
    } else if (letters.length > 0) {
      const lastLetter = letters[letters.length - 1] as HTMLElement;
      caretRef.current.style.display = 'block';
      caretRef.current.style.top = `${activeWord.offsetTop + lastLetter.offsetTop}px`;
      caretRef.current.style.left = `${activeWord.offsetLeft + lastLetter.offsetLeft}px`;
    } else {
      caretRef.current.style.display = 'block';
      caretRef.current.style.top = `${activeWord.offsetTop}px`;
      caretRef.current.style.left = `${activeWord.offsetLeft + activeWord.offsetWidth}px`;
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

    if (!startTime && e.key.length === 1) setStartTime(Date.now());

    if (e.key === 'Tab') {
      e.preventDefault();
      generateWords();
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (inputValue.length > 0 || currentWordIndex < words.length - 1) {
        if (currentWordIndex === words.length - 1) {
          setEndTime(Date.now());
          setIsFinished(true);
        } else {
          setCurrentWordIndex(prev => prev + 1);
          setCurrentLetterIndex(0);
          setInputValue('');
        }
      }
      return;
    }

    if (e.key === 'Backspace') {
      if (inputValue.length > 0) {
        setInputValue(prev => prev.slice(0, -1));

        const newWords = [...words];
        const currentWord = newWords[currentWordIndex];

        if (inputValue.length > currentWord.original.length) {
          currentWord.letters.pop();
        } else {
          currentWord.letters[inputValue.length - 1].status = 'none';
        }
        setWords(newWords);
        setCurrentLetterIndex(prev => prev - 1);
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
    inputRef.current?.focus();
    setIsFocused(true);
  };

  return (
    <>
      <header>
        <div className="logo" onClick={() => window.location.reload()}>
          <div className="icon">🕷️</div>
          <div className="text">މަކުނު ޓައިޕް</div>
        </div>
      </header>

      <main onClick={focusInput}>
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
                {words.map((word, wIdx) => (
                  <div
                    key={wIdx}
                    className={`word ${wIdx === currentWordIndex ? 'active' : ''}`}
                  >
                    {word.letters.map((letter, lIdx) => (
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
            <button className="restart-btn" onClick={generateWords}>
              ↻
            </button>
          </>
        ) : (
          <div className="results-container">
            <div className="results">
              <div className="main-stats">
                <div className="stat-box">
                  <span className="label">ޑަބްލިއު.ޕީ.އެމް</span>
                  <span className="value">{wpm}</span>
                </div>
                <div className="stat-box">
                  <span className="label">ޞައްޙަކަން</span>
                  <span className="value">{accuracy}%</span>
                </div>
              </div>
              <button className="restart-btn" onClick={generateWords}>
                ↻ އަލުން ފަށަން
              </button>
            </div>

            <div className="leaderboard">
              <h2 className="leaderboard-title">އެންމެ މަތީ ސްކޯތައް</h2>
              <div className="leaderboard-list">
                {leaderboard.length === 0 ? (
                  <div className="leaderboard-empty">އަދި އެއްވެސް ސްކޯއެއް ނެތް</div>
                ) : (
                  leaderboard.map((entry, idx) => (
                    <div key={idx} className="leaderboard-item">
                      <span>#{idx + 1}</span>
                      <span className="l-wpm">{entry.wpm} WPM</span>
                      <span className="l-acc">{entry.accuracy}%</span>
                      <span className="l-date">{entry.date}</span>
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
      </footer>
    </>
  );
};

export default App;
