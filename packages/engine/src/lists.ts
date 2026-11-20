export const FREE_MAIL = ["gmail.com", "googlemail.com", "yahoo.com", "yahoo.in", "outlook.com", "hotmail.com", "rediffmail.com", "proton.me", "protonmail.com", "icloud.com"];

/** Domains of the sign-in providers a creator is normally asked to use. */
export const PROVIDER_DOMAINS = ["google.com", "gmail.com", "instagram.com", "facebook.com", "youtube.com", "linkedin.com", "microsoft.com", "live.com", "apple.com", "whatsapp.com", "x.com", "twitter.com"];

export const BRAND_RE = /\b(?:nykaa|mamaearth|boat|myntra|amazon|flipkart|lenskart|sugar cosmetics|mcaffeine|zomato|swiggy|meesho|tata|samsung|apple|google|nike|adidas)\b/i;

/** Brands with their own domains. Used to spot look-alike domains. */
export const BRANDS: { name: string; label: string; domains: string[] }[] = [
  { name: "Nike", label: "nike", domains: ["nike.com", "nike.in"] },
  { name: "Nykaa", label: "nykaa", domains: ["nykaa.com"] },
  { name: "Mamaearth", label: "mamaearth", domains: ["mamaearth.in"] },
  { name: "Myntra", label: "myntra", domains: ["myntra.com"] },
  { name: "Amazon", label: "amazon", domains: ["amazon.in", "amazon.com"] },
  { name: "Flipkart", label: "flipkart", domains: ["flipkart.com"] },
  { name: "Meesho", label: "meesho", domains: ["meesho.com"] },
  { name: "Spotify", label: "spotify", domains: ["spotify.com"] },
  { name: "Samsung", label: "samsung", domains: ["samsung.com"] },
  { name: "Puma", label: "puma", domains: ["puma.com"] },
  { name: "Adidas", label: "adidas", domains: ["adidas.com"] },
  { name: "Lenskart", label: "lenskart", domains: ["lenskart.com"] },
  { name: "boAt", label: "boat", domains: ["boat-lifestyle.com"] },
];

/** Second-level labels that make a two-part public suffix, such as co.in. */
export const SECOND_LEVEL = ["co", "com", "org", "net", "ac", "gov"];
