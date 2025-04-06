var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

mongoose.Promise = global.Promise;

//mongoose.connect(process.env.DB, { useNewUrlParser: true });
try {
    mongoose.connect( process.env.DB, {useNewUrlParser: true, useUnifiedTopology: true}, () =>
        console.log("connected"));
}catch (error) {
    console.log("could not connect");
}
mongoose.set('useCreateIndex', true);

//reviews schema
var ReviewSchema = new Schema({
    user_id: {type: Schema.Types.ObjectID, ref: "UserSchema", required: true},
    movie_id: { type: mongoose.Types.ObjectId, required: true},
    username: { type: String, required: true},
    review: { type: String, required: true},
    rating: { type: Number, min: 1, max: 5, required: true}
});

ReviewSchema.pre('save', function(next) {
    next();
});

//return the model to server
module.exports = mongoose.model('Review', ReviewSchema);
