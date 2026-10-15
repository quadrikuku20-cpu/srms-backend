// Populates the database with a demo admin, a demo customer, and a starter menu.
// Run with: npm run seed
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import mongoose from "mongoose";
import User from "./models/User.js";
import MenuItem from "./models/MenuItem.js";

dotenv.config();

const menuSeed = [
  { name: "Garden Salad", category: "starter", price: 8.5, description: "Mixed greens, cherry tomatoes, cucumber, house vinaigrette.", ingredients: ["lettuce", "tomato", "cucumber"], dietaryInfo: ["vegetarian", "vegan", "gluten-free"] },
  { name: "Bruschetta", category: "starter", price: 9.0, description: "Toasted baguette, tomato, basil, garlic.", ingredients: ["bread", "tomato", "basil", "garlic"], dietaryInfo: ["vegetarian"] },
  { name: "Chicken Alfredo", category: "main", price: 18.99, description: "Fettuccine in creamy parmesan sauce with grilled chicken.", ingredients: ["pasta", "chicken", "cream", "parmesan"], dietaryInfo: [], isPopular: true },
  { name: "Vegetable Pasta", category: "main", price: 15.5, description: "Penne with seasonal roasted vegetables in a light tomato sauce.", ingredients: ["pasta", "zucchini", "peppers", "tomato"], dietaryInfo: ["vegetarian"] },
  { name: "Margherita Pizza", category: "main", price: 14.0, description: "San Marzano tomato, fresh mozzarella, basil.", ingredients: ["dough", "tomato", "mozzarella", "basil"], dietaryInfo: ["vegetarian"] },
  { name: "Gluten-Free Pasta Primavera", category: "main", price: 16.5, description: "Gluten-free penne with spring vegetables.", ingredients: ["gf pasta", "vegetables"], dietaryInfo: ["gluten-free", "vegetarian"] },
  { name: "Chocolate Lava Cake", category: "dessert", price: 7.5, description: "Warm chocolate cake with a molten center, vanilla ice cream.", ingredients: ["chocolate", "flour", "egg", "sugar"], dietaryInfo: ["vegetarian"], isPopular: true },
  { name: "Tiramisu", category: "dessert", price: 7.0, description: "Espresso-soaked ladyfingers, mascarpone cream.", ingredients: ["mascarpone", "coffee", "ladyfingers"], dietaryInfo: ["vegetarian"] },
  { name: "Sparkling Lemonade", category: "beverage", price: 4.0, description: "House-made lemonade with soda water.", ingredients: ["lemon", "sugar", "soda water"], dietaryInfo: ["vegan", "gluten-free"] },
  { name: "Iced Latte", category: "beverage", price: 4.5, description: "Espresso over ice with cold milk.", ingredients: ["espresso", "milk"], dietaryInfo: ["vegetarian"] },
];

async function run() {
  await connectDB();

  await User.deleteMany({ email: { $in: ["admin@srms.local", "customer@srms.local"] } });
  await MenuItem.deleteMany({});

  await User.create({ name: "Restaurant Admin", email: "admin@srms.local", password: "admin123", role: "admin" });
  await User.create({ name: "Demo Customer", email: "customer@srms.local", password: "customer123", role: "customer" });
  await MenuItem.insertMany(menuSeed);

  console.log("Seed complete:");
  console.log("  Admin login:    admin@srms.local / admin123");
  console.log("  Customer login: customer@srms.local / customer123");
  console.log(`  ${menuSeed.length} menu items created`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});