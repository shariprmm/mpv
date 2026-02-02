export type QuizQuestionType = "radio" | "checkbox" | "input";

export interface QuizQuestion {
  id: string;
  title: string;
  type: QuizQuestionType;
  options?: string[];
}

export interface QuizConfig {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

export const QUIZZES: Record<string, QuizConfig> = {
  general: {
    id: "general",
    title: "Рассчитать стоимость работ",
    questions: [
      {
        id: "plan",
        title: "Что планируете делать?",
        type: "checkbox",
        options: ["Септик", "Водоснабжение", "Отопление", "Электрика"],
      },
      {
        id: "object",
        title: "Тип объекта?",
        type: "radio",
        options: ["Дом ПМЖ", "Дача", "Коммерческий"],
      },
      {
        id: "timeline",
        title: "Когда приступить?",
        type: "radio",
        options: ["Срочно", "В этом месяце", "Пока прицениваюсь"],
      },
    ],
  },
  septic: {
    id: "septic",
    title: "Подбор септика",
    questions: [
      {
        id: "residents",
        title: "Количество проживающих?",
        type: "radio",
        options: ["1-3", "4-6", "7+"],
      },
      {
        id: "groundwater",
        title: "Уровень грунтовых вод?",
        type: "radio",
        options: ["Низкий", "Высокий", "Не знаю"],
      },
      {
        id: "drain",
        title: "Куда отводить воду?",
        type: "radio",
        options: ["Канава", "Дренажный колодец", "На грунт"],
      },
    ],
  },
};
