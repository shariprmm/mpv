"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./QuizModal.module.css";
import { QUIZZES, QuizQuestion } from "@/config/quizConfig";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  configId: string;
};

type ContactFormState = {
  name: string;
  phone: string;
};

const DEFAULT_CONTACT_FORM: ContactFormState = {
  name: "",
  phone: "",
};

export default function QuizModal({ isOpen, onClose, configId }: Props) {
  const config = QUIZZES[configId];
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [contactForm, setContactForm] = useState(DEFAULT_CONTACT_FORM);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setAnswers({});
      setContactForm(DEFAULT_CONTACT_FORM);
      setSent(false);
      setError("");
      setSending(false);
    }
  }, [isOpen, configId]);

  const questions = config?.questions ?? [];
  const currentQuestion = questions[step];
  const isFinalStep = step >= questions.length;

  const progress = useMemo(() => {
    if (questions.length === 0) {
      return 100;
    }

    const value = (step / questions.length) * 100;
    return Math.min(100, Math.max(0, value));
  }, [questions.length, step]);

  const getAnswerValue = (question: QuizQuestion) => answers[question.id];

  const onOptionClick = (question: QuizQuestion, option: string) => {
    if (question.type === "checkbox") {
      setAnswers((prev) => {
        const current = Array.isArray(prev[question.id]) ? (prev[question.id] as string[]) : [];
        const exists = current.includes(option);
        const next = exists ? current.filter((item) => item !== option) : [...current, option];
        return { ...prev, [question.id]: next };
      });
      return;
    }

    setAnswers((prev) => ({ ...prev, [question.id]: option }));
  };

  const onInputChange = (questionId: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setAnswers((prev) => ({ ...prev, [questionId]: event.target.value }));
  };

  const canProceed = useMemo(() => {
    if (!currentQuestion) {
      return false;
    }

    const value = answers[currentQuestion.id];
    if (currentQuestion.type === "checkbox") {
      return Array.isArray(value) && value.length > 0;
    }

    if (currentQuestion.type === "input") {
      return typeof value === "string" && value.trim().length > 0;
    }

    return typeof value === "string" && value.trim().length > 0;
  }, [answers, currentQuestion]);

  const canSubmit = useMemo(() => contactForm.phone.trim().length > 0, [contactForm.phone]);

  const handleBack = () => {
    if (step === 0) {
      return;
    }
    setStep((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    if (!canProceed) {
      return;
    }
    setStep((prev) => Math.min(questions.length, prev + 1));
  };

  const formatAnswers = () =>
    questions
      .map((question) => {
        const value = answers[question.id];
        const normalized = Array.isArray(value) ? value.join(", ") : value || "";
        return `${question.title}: ${normalized}`;
      })
      .join("\n");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Укажите номер телефона.");
      return;
    }

    setSending(true);
    try {
      const payload = {
        kind: "quiz",
        custom_title: `Квиз: ${config?.title ?? ""}`,
        contact_name: contactForm.name.trim() || undefined,
        phone: contactForm.phone.trim() || undefined,
        message: formatAnswers(),
      };

      const response = await fetch(`${API}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Не удалось отправить заявку");
      }

      setSent(true);
    } catch (submitError: any) {
      setError(submitError?.message || "Не удалось отправить заявку");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !config) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.progress}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <header className={styles.header}>
          <div>
            <p className={styles.label}>Квиз</p>
            <h2 className={styles.title}>{config.title}</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>

        {sent ? (
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <h3>Заявка отправлена!</h3>
            <p>Мы свяжемся с вами и подготовим расчет.</p>
            <button type="button" className={styles.primaryButton} onClick={onClose}>
              Закрыть
            </button>
          </div>
        ) : isFinalStep ? (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Имя</span>
                <input
                  type="text"
                  placeholder="Как к вам обращаться"
                  value={contactForm.name}
                  onChange={(event) =>
                    setContactForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Телефон</span>
                <input
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  value={contactForm.phone}
                  onChange={(event) =>
                    setContactForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  required
                />
              </label>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              {step > 0 ? (
                <button type="button" className={styles.ghostButton} onClick={handleBack}>
                  Назад
                </button>
              ) : null}
              <button type="submit" className={styles.primaryButton} disabled={sending || !canSubmit}>
                {sending ? "Отправка..." : "Get Calculation"}
              </button>
            </div>
          </form>
        ) : currentQuestion ? (
          <div className={styles.questionBlock}>
            <p className={styles.questionTitle}>{currentQuestion.title}</p>
            {currentQuestion.type === "input" ? (
              <input
                className={styles.textInput}
                type="text"
                value={String(getAnswerValue(currentQuestion) ?? "")}
                onChange={onInputChange(currentQuestion.id)}
                placeholder="Введите ответ"
              />
            ) : (
              <div className={styles.options}>
                {(currentQuestion.options ?? []).map((option) => {
                  const value = getAnswerValue(currentQuestion);
                  const isActive =
                    currentQuestion.type === "checkbox"
                      ? Array.isArray(value) && value.includes(option)
                      : value === option;

                  return (
                    <button
                      type="button"
                      key={option}
                      className={`${styles.optionButton} ${isActive ? styles.optionActive : ""}`}
                      onClick={() => onOptionClick(currentQuestion, option)}
                      aria-pressed={isActive}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}
            <div className={styles.actions}>
              {step > 0 ? (
                <button type="button" className={styles.ghostButton} onClick={handleBack}>
                  Назад
                </button>
              ) : null}
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleNext}
                disabled={!canProceed}
              >
                Далее
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
