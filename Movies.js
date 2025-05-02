const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1); // Exit if connection fails
  }
};

connectDB();

// Movie schema
const MovieSchema = new Schema({
  title: { 
    type: String, 
    required: true, 
    index: true 
  },
  releaseDate: { 
    type: Number, 
    required: true,
    min: [1900, 'Must be greater than 1899'], 
    max: [2100, 'Must be less than 2100']
  },
  genre: {
    type: String,
    required: true,
    enum: [
      'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
      'Horror', 'Mystery', 'Thriller', 'Western', 'Science Fiction'
    ],
  },
  actors: {
    type: [{
      actorName: { type: String, required: true },
      characterName: { type: String, required: true }
    }],
    required: [true, 'A movie must have at least one actor'],
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: "A movie must have at least one actor"
    }
  },
  imageUrl: { type: String}
});

module.exports = mongoose.model('Movie', MovieSchema);