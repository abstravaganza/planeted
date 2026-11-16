import { normalizeAnswer } from "./learning-engine";
export type PatternId = "with" | "after" | "because";
export type Bubble = {
  id: string;
  label: string;
  correct: boolean;
  why: string;
};
export type BubbleItem = {
  id: string;
  prompt: string;
  hint: string;
  options: Bubble[];
};
const option = (id: string, label: string, correct: boolean, why: string) => ({
  id,
  label,
  correct,
  why,
});
export const grammarLessons: Record<
  PatternId,
  {
    title: string;
    rule: string;
    chart: { label: string; before: string; after: string }[];
    items: BubbleItem[];
    transfer: string;
    reviewed: string[];
  }
> = {
  with: {
    title: "С means WITH",
    rule: "When с means WITH, both the describing word and the noun usually take instrumental endings. Match gender and number.",
    chart: [
      { label: "Masculine", before: "мой друг", after: "с моим другом" },
      { label: "Feminine", before: "моя подруга", after: "с моей подругой" },
      { label: "Plural", before: "мои друзья", after: "с моими друзьями" },
    ],
    items: [
      {
        id: "fem",
        prompt: "Я гуляю с ___ подругой.",
        hint: "Подругой is feminine singular. Choose the matching feminine instrumental form.",
        options: [
          option(
            "masc",
            "моим",
            false,
            "That is masculine singular; подругой is feminine.",
          ),
          option(
            "fem",
            "моей",
            true,
            "Моя → моей; подруга → подругой. Both words agree in the instrumental.",
          ),
          option(
            "plural",
            "моими",
            false,
            "That is plural, but here there is one female friend.",
          ),
        ],
      },
      {
        id: "plural",
        prompt: "Я играю в теннис с ___ друзьями.",
        hint: "Друзьями means more than one friend. Both words need plural instrumental endings.",
        options: [
          option(
            "basic",
            "мой",
            false,
            "This is a basic singular form, not plural instrumental.",
          ),
          option(
            "plural",
            "моими",
            true,
            "Мои друзья → с моими друзьями. Both words are plural instrumental.",
          ),
          option(
            "fem",
            "моей",
            false,
            "That describes one feminine person; друзьями is plural.",
          ),
        ],
      },
      {
        id: "both-masc",
        prompt: "Я гуляю ___.",
        hint: "Change both words: the describing word AND the masculine noun after с.",
        options: [
          option(
            "unchanged",
            "с мой друг",
            false,
            "Both words are still in their basic form.",
          ),
          option(
            "both",
            "с моим другом",
            true,
            "Мой → моим AND друг → другом. Both changes are needed.",
          ),
          option(
            "noun",
            "с моим друг",
            false,
            "The describing word changed, but the noun still needs its ending.",
          ),
        ],
      },
      {
        id: "both-fem",
        prompt: "Я разговариваю ___.",
        hint: "Use feminine instrumental for both words after с.",
        options: [
          option(
            "noun",
            "с моей подруга",
            false,
            "The noun is still in its basic form.",
          ),
          option(
            "both",
            "с моей подругой",
            true,
            "Моя → моей AND подруга → подругой.",
          ),
          option(
            "agreement",
            "с моим подругой",
            false,
            "The noun is feminine but the describing word is masculine.",
          ),
        ],
      },
    ],
    transfer: "Write a new sentence with с + a person.",
    reviewed: [
      "Я гуляю с моей подругой.",
      "Я гуляю с моим другом.",
      "Я гуляю с моими друзьями.",
    ],
  },
  after: {
    title: "После means AFTER",
    rule: "After после, use the genitive case to name the event or time you are following.",
    chart: [
      { label: "School", before: "школа", after: "после школы" },
      { label: "Lessons", before: "уроки", after: "после уроков" },
      { label: "Lunch", before: "обед", after: "после обеда" },
    ],
    items: [
      {
        id: "school",
        prompt: "Я гуляю после ___.",
        hint: "A noun ending in -а often changes to -ы after после.",
        options: [
          option(
            "base",
            "школа",
            false,
            "This is the basic form; после requires a different case.",
          ),
          option("gen", "школы", true, "Школа → школы: после школы."),
          option(
            "instr",
            "школой",
            false,
            "That is instrumental; после needs genitive.",
          ),
        ],
      },
      {
        id: "lessons",
        prompt: "Мы встречаемся после ___.",
        hint: "Use the plural genitive form of уроки.",
        options: [
          option("base", "уроки", false, "This is the basic plural form."),
          option("gen", "уроков", true, "Уроки → уроков: после уроков."),
          option(
            "instr",
            "уроками",
            false,
            "This is instrumental, not genitive.",
          ),
        ],
      },
      {
        id: "lunch",
        prompt: "Я читаю ___.",
        hint: "Include после and the genitive of обед.",
        options: [
          option(
            "basic",
            "после обед",
            false,
            "Обед still needs its genitive ending.",
          ),
          option(
            "gen",
            "после обеда",
            true,
            "После обеда names the time after lunch.",
          ),
          option(
            "wrong",
            "после обедом",
            false,
            "The noun is instrumental here, not genitive.",
          ),
        ],
      },
    ],
    transfer: "Write a new sentence with после + an event.",
    reviewed: [
      "После школы я гуляю с друзьями.",
      "После уроков я читаю.",
      "После обеда я гуляю.",
    ],
  },
  because: {
    title: "Give a complete reason",
    rule: "Потому что introduces a complete reason: include what happens or how someone feels.",
    chart: [
      {
        label: "Activity",
        before: "Я гуляю.",
        after: "Я гуляю, потому что мне нравится свежий воздух.",
      },
      {
        label: "Preference",
        before: "Я люблю музыку.",
        after: "Я люблю музыку, потому что она помогает мне отдыхать.",
      },
    ],
    items: [
      {
        id: "connector",
        prompt: "Я люблю читать, ___ это интересно.",
        hint: "Choose the connector that answers WHY, not THEN or a result.",
        options: [
          option(
            "reason",
            "потому что",
            true,
            "Потому что это интересно is a complete reason.",
          ),
          option(
            "sequence",
            "после этого",
            false,
            "This expresses sequence, not a reason.",
          ),
          option(
            "result",
            "поэтому",
            false,
            "This expresses a result, not the reason for liking reading.",
          ),
        ],
      },
      {
        id: "clause",
        prompt: "Я гуляю, потому что ___.",
        hint: "Finish the reason with a complete thought, not an isolated adjective.",
        options: [
          option(
            "fragment",
            "весёлый",
            false,
            "An adjective alone does not state a complete reason here.",
          ),
          option(
            "complete",
            "мне нравится свежий воздух",
            true,
            "This explains how you feel and gives a complete reason.",
          ),
          option(
            "fragment2",
            "мои друзья",
            false,
            "Naming people alone does not explain what happens.",
          ),
        ],
      },
      {
        id: "full",
        prompt: "Выбери полную причину.",
        hint: "Look for a connector plus a complete thought.",
        options: [
          option(
            "complete",
            "Я читаю, потому что это интересно.",
            true,
            "The reason contains a complete thought: это интересно.",
          ),
          option(
            "fragment",
            "Я читаю, потому что книга.",
            false,
            "A noun alone does not complete the reason.",
          ),
          option(
            "spelling",
            "Я читаю потомучто интересно.",
            false,
            "Потому что is written as two words, with a comma before it.",
          ),
        ],
      },
    ],
    transfer: "Write a new sentence with a complete reason using потому что.",
    reviewed: [
      "Я гуляю, потому что мне нравится свежий воздух.",
      "Я люблю читать, потому что это интересно.",
    ],
  },
};
export function checkBubble(
  pattern: PatternId,
  index: number,
  answerId: string,
) {
  return (
    grammarLessons[pattern].items[index]?.options.find(
      (o) => o.id === answerId,
    ) ?? null
  );
}
export function reviewedGrammarTransfer(pattern: PatternId, text: string) {
  return grammarLessons[pattern].reviewed.some(
    (s) => normalizeAnswer(s) === normalizeAnswer(text),
  );
}
export const emptyGrammar = () => ({
  taught: false,
  example: 0,
  index: 0,
  answers: [] as string[],
  attempts: 0,
  message: "",
  hint: false,
  done: false,
  skipped: false,
  transfer: "",
  transferReview: "draft" as "draft" | "curated" | "ai",
  transferAccepted: false,
  supportUsed: false,
});

export function endingPair(before: string, after: string) {
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i++;
  return {
    prefix: before.slice(0, i),
    before: before.slice(i),
    after: after.slice(i),
  };
}
