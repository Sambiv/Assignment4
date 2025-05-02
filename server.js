const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authJwtController = require('./auth_jwt'); // You're not using authController, consider removing it
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./Users');
const Movie = require('./Movies'); // You're not using Movie, consider removing it
const Review = require('./Reviews');
const mongoose = require('mongoose');


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

const router = express.Router();

// Removed getJSONObjectForMovieRequirement as it's not used

router.post('/signup', async (req, res) => { // Use async/await
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ success: false, msg: 'Please include both username and password to signup.' }); // 400 Bad Request
  }

  try {
    const user = new User({ // Create user directly with the data
      name: req.body.name,
      username: req.body.username,
      password: req.body.password,
    });

    await user.save(); // Use await with user.save()

    res.status(201).json({ success: true, msg: 'Successfully created new user.' }); // 201 Created
  } catch (err) {
    if (err.code === 11000) { // Strict equality check (===)
      return res.status(409).json({ success: false, message: 'A user with that username already exists.' }); // 409 Conflict
    } else {
      console.error(err); // Log the error for debugging
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
    }
  }
});


router.post('/signin', async (req, res) => { // Use async/await
  try {
    const user = await User.findOne({ username: req.body.username }).select('name username password');

    if (!user) {
      return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' }); // 401 Unauthorized
    }

    const isMatch = await user.comparePassword(req.body.password); // Use await

    if (isMatch) {
      const userToken = { id: user._id, username: user.username }; // Use user._id (standard Mongoose)
      const token = jwt.sign(userToken, process.env.SECRET_KEY, { expiresIn: '1h' }); // Add expiry to the token (e.g., 1 hour)
      res.json({ success: true, token: 'jwt ' + token });
    } else {
      res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' }); // 401 Unauthorized
    }
  } catch (err) {
    console.error(err); // Log the error
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
  }
});

router.use(authJwtController.isAuthenticated);

// Define endpoints for '/movies'
router.route('/movies')
  // GET all movies
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      if (req.query.reviews === 'true') {
        const movies = await Movie.aggregate([
          {
            $lookup: {
            from: 'reviews',
            localField: '_id',
            foreignField: 'movieId',
            as: 'reviews'
            }
          },
          { $addFields: { avgRating: { $avg: '$reviews.rating' } } },
          { $sort: { avgRating: -1 }}
        ]);
        return res.json(movies);
        }
        const movies = await Movie.find().sort({ title: 1 });
        return res.json(movies);
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  })
  // POST a new movie
  .post(authJwtController.isAuthenticated, async (req, res) => {
    try {
      if (!req.body.title || !req.body.releaseDate || !req.body.genre || !req.body.actors) {
        return res.status(400).json({ success: false, message: 'Missing required movie information.' });
      }
      const newMovie = new Movie(req.body);
      const savedMovie = await newMovie.save();
      res.status(201).json({ movie: savedMovie });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.route('/movies/:id')
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      if (req.query.reviews === 'true') {
        const movieWithReviews = await Movie.aggregate([
          { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
          { 
            $lookup: {
              from: "reviews", 
              localField: "_id",
              foreignField: "movieId",
              as: "reviews"
            }
          },
          { $addFields: {avgRating: {$avg: '$reviews.rating'}}}
        ]);
        if (!movieWithReviews.length) {
          return res.status(404).json({ success: false, message: 'Movie not found.' });
        }
        res.json(movieWithReviews[0]);
      } else {
        // If no reviews query, return just the movie data
        const movie = await Movie.findById(req.params.id);
        if (!movie) return res.status(404).json({ success: false, message: 'Movie not found.' });
        res.json(movie);
      }
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  })
  .put(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const updatedMovie = await Movie.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      if (!updatedMovie) return res.status(404).json({ success: false, message: 'Movie not found.' });
      res.json(updatedMovie);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  })
  .delete(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const deletedMovie = await Movie.findByIdAndDelete(req.params.id);
      if (!deletedMovie) return res.status(404).json({ success: false, message: 'Movie not found.' });
      res.json({ success: true, message: 'Movie deleted successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  function getUsername(req) {
    const hdr   = req.headers.authorization || '';
    const token = hdr.startsWith('jwt ') ? hdr.slice(4) : hdr;
    try {
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      return decoded.username;
    } catch {
      return null;
    }
  }

  router.post('/reviews', authJwtController.isAuthenticated, async (req, res) => {
    try {
      const { movieId, rating, review } = req.body;
      if (!movieId || rating == null || !review)
        return res.status(400).json({ message: 'movieId, rating and review are required.' });
      if (rating < 0 || rating > 5)
        return res.status(400).json({ message: 'rating must be between 0 and 5.' });
  
      const username = getUsername(req);
      if (!username) return res.status(401).json({ message: 'Invalid token.' });
  
      const movie = await Movie.findById(movieId);
      if (!movie) return res.status(404).json({ message: 'Movie not found.' });
  
      await Review.findOneAndUpdate(
        { movieId, username },
        { review, rating },
        { new: true, upsert: true, runValidators: true }
      );
  
      const [{ avgRating = null } = {}] = await Review.aggregate([
        { $match: { movieId: movie._id } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]);
  
      const msg = avgRating != null ? 'Review saved!' : 'Review saved, no rating yet.';
      return res.status(201).json({ message: msg, avgRating });
    } catch (err) {
      if (err.code === 11000)
        return res.status(400).json({ message: 'You already reviewed this movie.' });
      console.error(err);
      return res.status(500).json({ message: err.message });
    }
  });
  
  
  router.get('/reviews', async (req, res) => {
    try {
      const reviews = await Review.find();
      res.json(reviews);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });


  // EXTRA CREDIT
  router.post('/movies/search', async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ message: 'query is required.' });
  
      const regex = new RegExp(query, 'i');
      const docs  = await Movie.aggregate([
        {
          $match: {
            $or: [
              { title: regex },
              { 'actors.actorName': regex }
            ]
          }
        },
        {
          $lookup: {
            from: 'reviews',
            localField: '_id',
            foreignField: 'movieId',
            as: 'movieReviews'
          }
        },
        { $addFields: { avgRating: { $avg: '$movieReviews.rating' } } },
        { $sort: { avgRating: -1 } }
      ]);
  
      return res.json(docs);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: err.message });
    }
  });


app.use('/', router);

const PORT = process.env.PORT || 8080; // Define PORT before using it
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // for testing only