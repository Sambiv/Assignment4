/*
CSC3916 HW4
File: Server.js
Description: Web API scaffolding for Movie API
 */

var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();
const mongoose = require('mongoose');


function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

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
        res.json({ success: true, token: 'JWT ' + token });
      } else {
        res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' }); // 401 Unauthorized
      }
    } catch (err) {
      console.error(err); // Log the error
      res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
    }
  });

// ===== Movies Endpoints =====

// GET /movies - Retrieve all movies
router.get('/movies', authJwtController.isAuthenticated, async (req, res) => {
    //first check for req.query.reviews === "true", e.g. /movies?reviews=true
    if (req.query.reviews === 'true') {
        const movies = await Movie.aggregate([
          {
            $lookup: {
              from: "reviews",         // Name of the Reviews collection
              localField: "_id",       // Field in Movies collection
              foreignField: "movieId", // Field in Reviews collection
              as: "reviews"            // Output array field for the joined reviews
            }
          },
          {
            $addFields: {
              avgRating: {
                $cond: {
                  if: { $gt: [{ $size: "$reviews" }, 0] },
                  then: { $avg: "$reviews.rating" },
                  else: null
                }
              }
            }
          },
          {
            $sort: {
              avgRating: -1,
              title: 1
            }
          }
        ])
        return res.json(movies);
      } else {
        // Otherwise, simply return all movies without aggregation.
        try {
          const movies = await Movie.find();
          res.status(200).json({ success: true, movies });
        } catch (err) {
          res.status(500).json({ success: false, message: 'Server error retrieving movies' });
        }
      } 
  });
  
  
  // POST /movies - Create a new movie
  router.post('/movies', authJwtController.isAuthenticated, async (req, res) => {
    try {
      const { title, releaseDate, genre, actors, imageUrl } = req.body;
  
      // Validate required fields, including imageUrl
      if (
        !title ||
        !releaseDate ||
        !genre ||
        !actors ||
        !Array.isArray(actors) ||
        actors.length === 0 ||
        !imageUrl
      ) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields, actors array is empty, or imageUrl is missing'
        });
      }
  
      // Validate actors entries
      for (const actor of actors) {
        if (!actor.actorName || !actor.characterName) {
          return res.status(400).json({
            success: false,
            message: 'Each actor must have both actorName and characterName'
          });
        }
      }
  
      // Create the movie with imageUrl
      const newMovie = new Movie({ title, releaseDate, genre, actors, imageUrl });
      await newMovie.save();
  
      res.status(201).json({
        success: true,
        message: 'Movie created successfully',
        movie: newMovie
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server error creating movie' });
    }
  });
  
  // GET /movies/:movieId - Retrieve a specific movie
router.get('/movies/:movieId', authJwtController.isAuthenticated, async (req, res) => {
    const id = req.params.movieId;
    
    if (req.query.reviews === 'true') {
      try {
        const movies = await Movie.aggregate([
          { $match: { _id: new mongoose.Types.ObjectId(id) } },
          {
            $lookup: {
              from: "reviews",         // Reviews collection name (must match exactly)
              localField: "_id",
              foreignField: "movieId",
              as: "reviews"
            }
          },
          {
            $addFields: {
              avgRating: {
                $cond: {
                  if: { $gt: [{ $size: "$reviews" }, 0] },
                  then: { $avg: "$reviews.rating" },
                  else: null
                }
              }
            }
          },
          {
            $sort: {
              avgRating: -1,
              title: 1
            }
          }
        ]);
        if (!movies || movies.length === 0) {
          return res.status(404).json({ success: false, message: "Movie not found" });
        }
        return res.status(200).json({ success: true, movie: movies[0] });
      } catch (err) {
        console.error("Aggregation error:", err);
        return res.status(500).json({ success: false, message: "Error aggregating reviews" });
      }
    } else {
      try {
        const movie = await Movie.findById(id);
        if (!movie) {
          return res.status(404).json({ success: false, message: 'Movie not found' });
        }
        return res.status(200).json({ success: true, movie });
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error retrieving movie' });
      }
    }
  });
  
  
  // PUT /movies/:movieId - Update an existing movie
  router.put('/movies/:movieId', authJwtController.isAuthenticated, async (req, res) => {
    try {
      const { title, releaseDate, genre, actors } = req.body;
  
      // If actors is provided, validate it
      if (actors && (!Array.isArray(actors) || actors.length === 0)) {
        return res.status(400).json({ success: false, message: 'Actors array must not be empty if provided' });
      }
      if (actors) {
        for (const actor of actors) {
          if (!actor.actorName || !actor.characterName) {
            return res.status(400).json({ success: false, message: 'Each actor must have both actorName and characterName' });
          }
        }
      }
  
      const updatedMovie = await Movie.findByIdAndUpdate(
        req.params.movieId,
        { title, releaseDate, genre, actors },
        { new: true, runValidators: true }
      );
      if (!updatedMovie) {
        return res.status(404).json({ success: false, message: 'Movie not found' });
      }
      res.status(200).json({ success: true, message: 'Movie updated successfully', movie: updatedMovie });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error updating movie' });
    }
  });
  
  // DELETE /movies/:movieId - Delete a movie
  router.delete('/movies/:movieId', authJwtController.isAuthenticated, async (req, res) => {
    try {
      const deletedMovie = await Movie.findByIdAndDelete(req.params.movieId);
      if (!deletedMovie) {
        return res.status(404).json({ success: false, message: 'Movie not found' });
      }
      res.status(200).json({ success: true, message: 'Movie deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error deleting movie' });
    }
  });
  
  // If any unsupported HTTP method is used on /movies or /movies/:movieId
  router.all('/movies', (req, res) => {
    res.status(405).json({ success: false, message: 'Method not allowed' });
  });
  router.all('/movies/:movieId', (req, res) => {
    res.status(405).json({ success: false, message: 'Method not allowed' });
  });

// ===== Reviews Endpoints =====

// GET /reviews - Retrieve all reviews (now JWT‑protected)
  router.get(
    '/reviews',
    authJwtController.isAuthenticated,    // ← add this
    async (req, res) => {
      try {
        const reviews = await Review.find();
        res.status(200).json({ success: true, reviews });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error retrieving reviews.' });
      }
    }
  );
  
  // POST /reviews - Create a new review (secured with JWT)
  router.post('/reviews', authJwtController.isAuthenticated, async (req, res) => {
    try {
      const { movieId, review, rating } = req.body;
      const username = req.user.name;             // ← grab from JWT payload
  
      if (!movieId || !review || rating === undefined) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
      }
      // verify movie exists…
      const movieExists = await Movie.findById(movieId);
      if (!movieExists) {
        return res.status(404).json({ success: false, message: 'Movie not found' });
      }
  
      const newReview = new Review({ movieId, username, review, rating });
      await newReview.save();
      return res.status(201).json({ message: 'Review created!' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Error creating review' });
    }
  });
  
  // (Optional) DELETE /reviews/:reviewId - Delete a review (secured with JWT)
  router.delete('/reviews/:reviewId', authJwtController.isAuthenticated, async (req, res) => {
    try {
      const deletedReview = await Review.findByIdAndDelete(req.params.reviewId);
      if (!deletedReview) {
        return res.status(404).json({ success: false, message: 'Review not found.' });
      }
      res.status(200).json({ success: true, message: 'Review deleted successfully.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Error deleting review.' });
    }
  });

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only
