// Shared contracts. All modules import from here. Do not change without coordinating.

export type Lang = 'ja' | 'en';

export type IngredientCategory =
  | 'vegetable'
  | 'mushroom'
  | 'meat'
  | 'seafood'
  | 'egg_dairy'
  | 'tofu_soy'
  | 'grain_noodle'
  | 'seasoning'
  | 'other';

export interface Ingredient {
  id: string; // snake_case ascii, e.g. "moyashi", "chicken_breast"
  ja: string; // もやし
  en: string; // Bean sprouts
  category: IngredientCategory;
  priceYen: number; // typical supermarket price for one pack
  packAmount: number; // amount in one pack, in `unit`
  unit: 'g' | 'ml' | 'piece';
  pantry?: boolean; // staple seasoning assumed at home (soy sauce, salt...)
}

export interface RecipeIngredient {
  id: string; // Ingredient.id
  amount: number;
  unit: 'g' | 'ml' | 'piece' | 'pinch'; // pinch = 少々 / to taste (cost 0)
}

/** Exactly what the LLM produces (validated). */
export interface GeneratedRecipe {
  title: string;
  /** One short sentence describing the dish (taste/texture/why it's cheap). */
  description?: string;
  servings: number;
  totalMinutes: number;
  ingredients: RecipeIngredient[];
  /** One action per step. Ingredients appear as {ingredient_id} tokens, rendered by the app. */
  steps: string[];
  tip?: string;
}

/** Stored in IndexedDB. */
export interface SavedRecipe extends GeneratedRecipe {
  id?: number; // auto-increment
  lang: Lang;
  prompt: string;
  costYen: number; // total estimated cost
  favorite: boolean;
  createdAt: number; // epoch ms
}

export interface GenerateRequest {
  prompt: string;
  lang: Lang;
  fridge: string[]; // Ingredient ids user has / wants to use
  maxMinutes: number; // 10 | 15 | 30 | 60
  budgetPerServingYen?: number;
  servings: number;
}
