import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["starter", "main", "dessert", "beverage"],
    },
    description: { type: String, default: "" },
    ingredients: [{ type: String }],
    price: { type: Number, required: true, min: 0 },
    dietaryInfo: [
      {
        type: String,
        enum: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
      },
    ],
    imageUrl: { type: String, default: "" },
    isAvailable: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
  },
  { timestamps: true }
);

menuItemSchema.index({ name: "text", description: "text" });

export default mongoose.model("MenuItem", menuItemSchema);