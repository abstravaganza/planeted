export const storyCards = [
  { id: 0, text: "Сначала мы пришли в музей." },
  { id: 1, text: "Потом мы посмотрели выставку." },
  { id: 2, text: "После этого мы пообедали в кафе." },
];
export function checkStory(order: number[], connector: string, detail: string) {
  if (
    order.length !== 3 ||
    new Set(order).size !== 3 ||
    order.some((n, i) => n !== i)
  )
    return {
      correct: false,
      message:
        "Follow the event clues: arrive before seeing the exhibition, then have lunch.",
    };
  if (connector !== "После этого")
    return {
      correct: false,
      message:
        "The next event happens later. Choose a sequence connector; a cause or contrast would change the relationship.",
    };
  if (detail !== "with-brother")
    return {
      correct: false,
      message:
        "The supplied plan says you went with your brother. Keep that detail and use с + instrumental.",
    };
  return {
    correct: true,
    message:
      "The sequence, connector and company detail fit the supplied plan.",
  };
}
export const expansionQuestions = [
  { id: "Connect", ru: "Ещё одна мысль", en: "Connect an idea" },
  { id: "example", ru: "Например?", en: "For example?" },
  { id: "therefore", ru: "И что?", en: "What follows?" },
  { id: "contrast", ru: "А что иначе?", en: "What is different?" },
  { id: "when", ru: "Когда?", en: "When?" },
  { id: "where", ru: "Где?", en: "Where?" },
  { id: "company", ru: "С кем?", en: "With whom?" },
  { id: "why", ru: "Почему?", en: "Why?" },
  { id: "frequency", ru: "Как часто?", en: "How often?" },
  { id: "next", ru: "Что случилось потом?", en: "What happened next?" },
];
