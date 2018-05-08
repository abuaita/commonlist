// mongoDB stuff
// SOURCE CITED:
// https://thinkster.io/tutorials/node-json-api/creating-the-user-model
var mongoose = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');
var db = mongoose.connection;

db.on('error', console.error); // log any errors that occur
db.once('open', function() { // bind a function to perform when database has been opened
  console.log("Connected to DB"); // perform any queries here
});

process.on('SIGINT', function(){
  console.log('DB connnection closed by Node process ending');
  process.exit(0);
});

mongoose.connect('mongodb://commonlist_admin:brunonian18@ds141889.mlab.com:41889/commonlist');

//var secret = require('../config').secret;
var userSchema = new mongoose.Schema({
  username: {type:String, lowercase:true, unique:true, required:[true, "can't be blank"], match:[/^[a-zA-Z0-9]+$/, 'is invalid'], index:true},
  email: {type:String, lowercase:true, unique:true, required:[true, "can't be blank"], match:[/\S+@\S+\.\S+/,'is invalid'], index:true},
  image: String,
  hash: String,
  salt: String,
  trackInfo: [{name: String, album: String, artist: String, id: String, dance: Number, loud: Number, instrum: Number, albumcover: String}]
});

// hashes the pw
userSchema.methods.setPassword = function(password){
  this.salt = crypto.randomBytes(16).toString('hex');
  this.hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
};
// validates the pw
userSchema.methods.validPassword = function(password) {
  var hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
  return this.hash === hash;
};
// make a method on user model that makes a JWT
userSchema.methods.generateJWT = function() {
  var today = new Date();
  var exp = new Date(today);
  exp.setDate(today.getDate() + 60);

  return jwt.sign({
    id: this._id,
    username: this.username,
    exp: parseInt(exp.getTime() / 1000),
  }, secret);
};
// gets JSON object of user to front end for authentication
userSchema.methods.toAuthJSON = function(){
  return {
    username: this.username,
    email: this.email,
    token: this.generateJWT(),
    image: this.image
  };
};
userSchema.plugin(uniqueValidator, {message: 'is already taken.'});
// register schema w/ mongoose
var User = mongoose.model('User', userSchema);
// end mongoDB stuff

function makeUser(username, email) {
  var user = new User({
    username: username,
    email: email
  });
  return user;
}

exports.User = User;
exports.makeUser = makeUser;
