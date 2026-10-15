// Simulated AI dataset for the customer chat assistant (SODV2201 Assignment 1, option 2).
// Each entry has trigger keywords and a response. The matcher in chatbotRoutes.js
// scores keyword overlap so questions don't need to match verbatim.
export const chatbotDataset = [
  {
    keywords: ["special", "specials", "today"],
    response: "Today's special is Chicken Alfredo for $18.99.",
  },
  {
    keywords: ["vegetarian", "veggie", "veg"],
    response: "We offer Vegetable Pasta, Margherita Pizza, and Garden Salad.",
  },
  {
    keywords: ["recommend", "recommendation", "suggest", "popular", "best"],
    response: "Based on popular orders, we recommend our Chicken Alfredo.",
  },
  {
    keywords: ["gluten", "gluten-free", "glutenfree"],
    response: "Yes. We offer gluten-free pasta and selected salads.",
  },
  {
    keywords: ["dessert", "sweet", "cake"],
    response: "Our Chocolate Lava Cake is our most popular dessert.",
  },
  {
    keywords: ["last", "previous", "before", "history"],
    response: "Your previous order was Chicken Alfredo and Chocolate Lava Cake.",
  },
  {
    keywords: ["hour", "hours", "open", "close", "closing"],
    response: "We're open daily from 11:00 AM to 10:00 PM.",
  },
  {
    keywords: ["reservation", "book", "table", "reserve"],
    response: "You can book a table from the Reservations page — just pick a date, time, and party size.",
  },
  {
    keywords: ["delivery", "deliver"],
    response: "We offer delivery and pickup on every order — choose your option at checkout.",
  },
  {
    keywords: ["hello", "hi", "hey"],
    response: "Hi there! Ask me about today's specials, dietary options, or recommendations.",
  },
];

const FALLBACK_RESPONSE =
  "I'm not sure about that one yet, but I can help with specials, dietary options, recommendations, or your order history.";

// Very small bag-of-words matcher: scores each dataset entry by how many of its
// keywords appear in the customer's message, and returns the best match above
// a minimal threshold. This "simulates" an AI without calling a real model.
export function matchChatbotResponse(message, { lastOrderSummary } = {}) {
  const normalized = message.toLowerCase();

  let bestEntry = null;
  let bestScore = 0;

  for (const entry of chatbotDataset) {
    const score = entry.keywords.reduce(
      (acc, kw) => acc + (normalized.includes(kw) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (!bestEntry) {
    return FALLBACK_RESPONSE;
  }

  // Personalize the "last order" response with the customer's real history if available
  if (bestEntry.keywords.includes("history") && lastOrderSummary) {
    return `Your previous order was ${lastOrderSummary}.`;
  }

  return bestEntry.response;
}