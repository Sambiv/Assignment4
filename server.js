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

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

router.route('/movies')
    .post(authJwtController.isAuthenticated, function (req, res) {
        if(req.body.actors.length < 3){
            res.status(400).json({message: "Need at least 3 actors"});
        }else {
            Movie.find({title: req.body.title}, function (err, data) {
                if (err) {
                    res.status(400).json({message: "Invalid query"});
                } else if (data.length == 0) {
                    let mov = new Movie({
                        title: req.body.title,
                        year_released: req.body.year_released,
                        genre: req.body.genre,
                        actors: req.body.actors,
                        ImageUrl: req.body.ImageUrl
                    });

                    console.log(req.body);


                    mov.save(function (err) {
                        if (err) {
                            res.json({message: err});
                        } else {
                            res.json({msg: "Successfully saved"});
                        }

                    });
                } else {
                    res.json({message: "Movie already exists"});
                }

            });
        }
    })

    .get(authJwtController.isAuthenticated, function (req, res) {
        if(req.query.movieId != null){
            Movie.find({_id: mongoose.Types.ObjectId(req.query.movieId)}, function(err, data){
                if(err){
                    res.status(400).json({message: "Invalid query"});
                }else if(data.length == 0) {
                    res.status(400).json({message: "No entry found"});
                }else{
                    if(req.query.reviews == "True"){
                        Movie.aggregate([
                            {
                                $match: {'_id': mongoose.Types.ObjectId(req.query.movieId)}
                            },
                            {
                                $lookup:{
                                    from: 'reviews',
                                    localField: '_id',
                                    foreignField: 'Movie_ID',
                                    as: 'reviews'
                                }
                            }],function(err, doc) {
                            if(err){
                                console.log("hi");
                                res.send(err);
                            }else{
                                console.log(doc);
                                res.json(doc);
                            }
                        });
                    }else{
                        res.json(data);
                    }
                }
            });
        }else{
            Movie.find({}, function(err, doc){
                if(err){
                    res.json({error: err});
                }else{
                    if(req.query.reviews == "True"){
                        Movie.aggregate([
                            {
                                $lookup:{
                                    from: 'reviews',
                                    localField: '_id',
                                    foreignField: 'Movie_ID',
                                    as: 'reviews'
                                }
                            }],function(err, data) {
                            if(err){
                                res.send(err);
                            }else{
                                res.json(data);
                            }
                        });
                    }else{
                        res.json(doc);
                    }
                }
            })
        }

    })

    .put(authJwtController.isAuthenticated, function(req,res) {
        if(req.body.title != null && req.body.year_released != null && req.body.genre != null && req.body.actors != null && req.body.actors.length >= 3){
            Movie.findOneAndUpdate({title:req.body.Search},
                {
                    title: req.body.title,
                    year_released: req.body.year_released,
                    genre: req.body.genre,
                    actors: req.body.actors

                },function(err, doc){
                    if(err){
                        res.json({message: err});
                    }
                    else if (doc == null){
                        res.json({message:"Movie Not Found"})
                    }else{
                        res.json({data: doc, message:"Movie Updated"})
                    }
                });
        }else
        {
            res.status(400).json({message: "Please no null values"});
        }
    })

    .delete(authJwtController.isAuthenticated, function(req,res){
        Movie.findOneAndDelete({title: req.body.title}, function(err, doc){
            if(err){
                res.status(400).json({message:err});
            }
            else if (doc == null){
                res.json({message: "Movie not found"});
            }
            else{
                res.json({message: "Movie deleted"});
            }

        });
    });

var mongoose = require('mongoose');

router.route('/movies/:movieId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var id = mongoose.Types.ObjectId(req.query.movieId);
        if (req.query.reviews == "true") {
            // If reviews query parameter is "true", include movie information and reviews
            Movie.aggregate([
                { $match: { '_id': mongoose.Types.ObjectId(req.query.movieId)} },
                { $lookup: { from: "reviews", localField: "_id", foreignField: "Movie_ID", as: "reviews" } },
                { $sort: { "reviews.createdAt": -1 } }
            ], function (err, movie) {
                if (err) {
                    return res.status(400).json({ success: false, message: "Error retrieving movie and reviews." });
                } else {
                    return res.status(200).json({ success: true, movie: movie[0] });
                }
            });
        } else {
            // If reviews query parameter is not provided or is not "true", only include movie information
            Movie.findById(id, function (err, movie) {
                if (err) {
                    return res.status(400).json({ success: false, message: "Error retrieving movie." });
                } else {
                    return res.status(200).json({ success: true, movie: movie });
                }
            });
        }
    });


router.route('/reviews')
    .post(authJwtController.isAuthenticated, function(req,res){

        const usertoken = req.headers.authorization;
        const token = usertoken.split(' ');
        const decoded = jwt.verify(token[1], process.env.SECRET_KEY);

        Movie.find({_id: req.body.Movie_ID}, function(err, data){
            if(err){
                res.status(400).json({message: "Invalid query"});
            }else if (data != null){
                let rev = new Review({
                    username: decoded.username,
                    review: req.body.review,
                    rating: req.body.rating,
                    movie_ID: req.body.movie_ID
                });

                console.log(req.body);

                rev.save(function(err){
                    if(err) {
                        res.json({message: err});
                    }else{
                        Review.find({Movie_ID: req.body.Movie_ID}, function (err, allReviews) {
                            if(err){
                                res.status(400).json({message: "It's broken!"});
                            }else{
                                var avg = 0;

                                allReviews.forEach(function (review) {
                                    avg += review.rating;
                                    console.log(review);
                                });
                                avg = avg / allReviews.length;


                                Movie.update(
                                    { _id: req.body.Movie_ID},
                                    { $set: { averageRating: avg} }, function (err, doc){
                                        if (err){
                                            res.json({error: err});
                                        }else if(doc != null){
                                            res.json({msg: "Review successfully saved"});
                                        }
                                    });

                            }
                        });

                    }

                });
            }else{
                res.json({failure: "Movie does not exist"});
            }
        });
    });

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only
