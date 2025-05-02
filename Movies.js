const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1); // Exit the process if the connection fails (optional)
  }
};

connectDB();

// nested Actor schema
const ActorSchema = new Schema({
  actorName: { type: String, required: true },
  characterName: { type: String, required: true }
});

// Updated Movie schema including imageUrl
const MovieSchema = new Schema({
  title:  { type: String, required: true, index: true },
  releaseDate: {
    type: Number,
    min: [1900, 'Must be greater than 1899'],
    max: [2100, 'Must be less than 2100']
  },
  genre: {
    type: String,
    enum: [
      'Action','Adventure','Comedy','Drama','Fantasy',
      'Horror','Mystery','Thriller','Western','Science Fiction'
    ],
    required: true
  },
  actors: { type: [ActorSchema], required: true },
  imageUrl: { type: String, required: true },         // <-- new field
});

module.exports = mongoose.model('Movie', MovieSchema);
