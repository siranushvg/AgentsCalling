import React, { useState } from 'react';
import { QuizQuestion } from '@/data/trainingModules';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizSectionProps {
  questions: QuizQuestion[];
  passThreshold: number;
  onPass: (score: number) => void;
  moduleTitle: string;
  isFinalExam?: boolean;
}

export function QuizSection({ questions, passThreshold, onPass, moduleTitle, isFinalExam }: QuizSectionProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(questions.length).fill(null));

  const question = questions[currentQ];
  const isCorrect = selected === question.correctIndex;
  const requiredCorrect = Math.ceil(questions.length * passThreshold);
  const passed = correctCount >= requiredCorrect;

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelected(index);
  };

  const handleSubmit = () => {
    if (selected === null) return;
    setAnswered(true);
    const newAnswers = [...answers];
    newAnswers[currentQ] = selected;
    setAnswers(newAnswers);
    if (selected === question.correctIndex) {
      setCorrectCount(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentQ + 1 >= questions.length) {
      setShowResults(true);
    } else {
      setCurrentQ(prev => prev + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  const handleRetry = () => {
    setCurrentQ(0);
    setSelected(null);
    setAnswered(false);
    setCorrectCount(0);
    setShowResults(false);
    setAnswers(new Array(questions.length).fill(null));
  };

  if (showResults) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center space-y-4">
        <div className={cn(
          'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
          passed ? 'bg-success/15' : 'bg-destructive/15'
        )}>
          {passed ? <CheckCircle className="h-8 w-8 text-success" /> : <XCircle className="h-8 w-8 text-destructive" />}
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            {passed ? (isFinalExam ? '🎉 Certification Passed!' : '✅ Quiz Passed!') : '❌ Not Passed'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            You got {correctCount} out of {questions.length} correct ({Math.round((correctCount / questions.length) * 100)}%)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Required: {requiredCorrect}/{questions.length} ({Math.round(passThreshold * 100)}%)
          </p>
        </div>
        {passed ? (
          <Button onClick={() => onPass(Math.round((correctCount / questions.length) * 100))} className="w-full">
            {isFinalExam ? 'Complete Certification' : 'Continue to Next Module'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Review the module content and try again.</p>
            <Button onClick={handleRetry} variant="outline" className="w-full">Retry Quiz</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isFinalExam ? 'Final Assessment' : 'Module Quiz'} — Question {currentQ + 1}/{questions.length}
        </h4>
        <span className="text-xs text-muted-foreground">
          Pass: {requiredCorrect}/{questions.length}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5">
        {questions.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i < currentQ ? (answers[i] === questions[i].correctIndex ? 'bg-success' : 'bg-destructive') :
              i === currentQ ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <p className="text-sm font-medium leading-relaxed">{question.question}</p>
        <div className="space-y-2">
          {question.options.map((option, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={answered}
              className={cn(
                'w-full text-left rounded-lg border p-3 text-sm transition-all',
                !answered && selected === i && 'border-primary bg-primary/5 ring-1 ring-primary/20',
                !answered && selected !== i && 'hover:border-muted-foreground/30',
                answered && i === question.correctIndex && 'border-success bg-success/10 text-success',
                answered && selected === i && i !== question.correctIndex && 'border-destructive bg-destructive/10 text-destructive',
                answered && i !== question.correctIndex && selected !== i && 'opacity-50'
              )}
            >
              <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
              {option}
            </button>
          ))}
        </div>

        {answered && (
          <div className={cn(
            'rounded-lg p-3 text-sm',
            isCorrect ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          )}>
            <p className="font-medium">{isCorrect ? '✓ Correct!' : '✗ Incorrect'}</p>
            <p className="mt-1 opacity-80">{question.explanation}</p>
          </div>
        )}

        <div className="flex justify-end">
          {!answered ? (
            <Button onClick={handleSubmit} disabled={selected === null} size="sm">
              Submit Answer
            </Button>
          ) : (
            <Button onClick={handleNext} size="sm">
              {currentQ + 1 >= questions.length ? 'See Results' : 'Next Question'}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
