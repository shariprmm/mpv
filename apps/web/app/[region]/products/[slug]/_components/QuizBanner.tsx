"use client";

import React, { useMemo, useState } from "react";
import QuizModal from "@/components/QuizModal/QuizModal";
import { QUIZZES } from "@/config/quizConfig";
import styles from "../page.module.css";

type Props = {
  configId: string;
};

export default function QuizBanner({ configId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const quiz = useMemo(() => QUIZZES[configId] ?? QUIZZES.general, [configId]);

  return (
    <div className={styles.quizBannerWrap}>
      <button type="button" className={styles.quizBanner} onClick={() => setIsOpen(true)}>
        <span className={styles.quizBannerLabel}>Квиз</span>
        <h3 className={styles.quizBannerTitle}>{quiz.title}</h3>
        <p className={styles.quizBannerText}>Ответьте на несколько вопросов и получите расчет.</p>
        <span className={styles.quizBannerCta}>Пройти квиз →</span>
      </button>
      <QuizModal isOpen={isOpen} onClose={() => setIsOpen(false)} configId={quiz.id} />
    </div>
  );
}
