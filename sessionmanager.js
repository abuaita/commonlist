var db = require('./database.js');

function saveUser(request, response, logIn) {
  var info = request.body; // the form data
  var user = db.makeUser(info.user, info.email);
  if (info.pw1 !== info.pw2) { // if the passwords do not match, alert the user
    response.render('./register', {"root": __dirname, "display":"unset", "alert":"Passwords do not match."});
  } else {
    user.setPassword(info.pw1); // will hash / salt the password
    // user.generateJWT(); -> returns a jwt
    // user.toAuthJSON(); -> returns a JSON representation
    user.save(function(err, data) { // save the user doc to the model
      if (!err){ // if there are no errors, load the profile
        logIn(info.user);
        response.render('./profile.html', {"root": __dirname, "User":info.user});
      } else {
        if (err.name === "ValidationError") { // if it is a validation error,
          // check for what it is and then send the appropriate alert to the user
          var alert_message = "";
          if (err.errors.email) {
            if (err.errors.email.message === "can't be blank") {
              alert_message += "Email cannot be blank.\n";
            } else if (err.errors.email.message === "is already taken.") {
              alert_message += "That email is already in use. \n";
            } else if (err.errors.email.message === "is invalid") {
              alert_message += "That email is invalid. ";
            } else {
              console.error(err);
            }
          }
          if (err.errors.username) {
            if (err.errors.username.message === "can't be blank") {
              alert_message += "Username cannot be blank.\n";
            } else if (err.errors.username.message === "is already taken.") {
              alert_message += "That username is already taken. \n";
            } else if (err.errors.username.message === "is invalid") {
              alert_message += "That username is invalid. ";
            } else {
              console.error(err);
            }
          }
          console.log("error: "+ err);
          console.log("message: " + alert_message);
          response.render('./register.html', {"root": __dirname, "alert":alert_message});
        }
      }
    });
  }
}

function authenticateUser(request, response, logIn, toProfile) {
  var info = request.body;
  db.User.findOne({username:info.user}, function (err, user) {
    if (user === null) {
      response.render('./login.html', {"root": __dirname, "display":"unset", "alert":"Username or password do not match"});
      console.log("password doesn't match");
    } else {
      if (err) return console.error(err);
      if (user.validPassword(info.ret_pw1)) {
        logIn(info.user);
        toProfile(response, info.user);
        console.log("password matches");
      } else {
        response.render('./login', {"root": __dirname, "display":"unset", "alert":"Username or password do not match"});
        console.log("password doesn't match");
      }
    }
  });
}

exports.saveUser = saveUser;
exports.authenticateUser = authenticateUser;
