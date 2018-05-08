
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var handlebars  = require('express-handlebars');
var querystring = require('querystring');
var request_library = require('request'); // "Request" library

var session = require('./sessionmanager.js');
var db = require('./database.js');

//SPOTIFY AUTH:
var SpotifyWebApi = require('spotify-web-api-node');
var clientID = '58ac68b2b95c4c55957c2a54c8f1ed90';
var clientSecret = '660a8dd1ead9413a933d2e82924ef5b4';
var redirectUri = 'http://localhost:8080/callback';
var spotifyApi = new SpotifyWebApi({
  clientId : clientID,
  clientSecret : clientSecret,
  redirectUri : redirectUri
});

var loggedIn = false;
var userID = '';
var spotifyID = '';
var global_access_token = '';
var search_user_global = '';

//to get GET/POST requests
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

//use handlebars to display
app.set('views', __dirname);
app.set('view engine', 'html');
app.engine('html', handlebars(
));
app.use(express.static(__dirname)); // directory

//SOURCE CITED:
//POST request code based on Express 4 docs
//and handlebars display based on express-handlebars docs
//link: https://github.com/ericf/express-handlebars


//redirect to login page upon load
app.get('/', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.redirect('/home');
});
//home page
app.get('/home', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.render('./home.html', {"root": __dirname});
});
//login page
app.get('/login', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.render('./login.html', {"root": __dirname, "display":"none"});
});
//register page
app.get('/register', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.render('./register.html', {"root": __dirname, "display":"none"});
});
//profile page
app.post('/new_profile', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  //TODO - verify user input and sanitize

  session.saveUser(request, response, logIn);

});
//profile page
app.post('/returning_profile', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  //TODO - access their data + validate w/ database
  session.authenticateUser(request, response, logIn, toProfile);
});
function logIn(id) {
  loggedIn = true;
  userID = id;
}
function createAlbumArt(doc) {
  let tracks = doc.trackInfo;
  let links = [];
  for (let z = 0; z < tracks.length; z++) {
    links.push(tracks[z].albumcover);
  }
  return links;
}
function toProfile(response, username) {
  db.User.findOne({"username": username}, function(err, doc){
    if(err){
      console.error(err);
    } else {
      let links = createAlbumArt(doc);
      response.render('./profile.html', {"root": __dirname, "User":username, "image":doc.image, "albumCovers":links });
    }
  });
}
//already logged in/access profile page directly: go back to profile page or tell them not authorized:
app.get('/profile', function(request, response){
  console.log(loggedIn + " wooooot");
  console.log('-- Request received:', request.method, request.url);
  if(loggedIn){
    toProfile(response, userID);
  }
  else{
    response.sendFile('./error.html', {"root": __dirname});
  }
});
app.get('/find_friend', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  if(loggedIn){
    response.render('./find_friend.html', {"root": __dirname, "User":userID, 'display':'none'});
  } else {
    response.sendFile('./error.html', {"root": __dirname});
  }
});

app.get('/look_up_user', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  if(loggedIn){
    var search_user = request.query.user; // the user that we are looking for
    db.User.findOne({username:search_user}, function(err, doc) {
      if (err) {
        console.error(err);
        response.render('./find_friend.html', {"root": __dirname, "User":userID, 'display':'none', 'Message':'There was an error when searching for this user. Try Again?'});
      } else {
        if (doc === null) {
          console.error("No user found.");
          response.render('./find_friend.html', {"root": __dirname, "User":userID, 'display':'none', 'Message':'Could not find this user. Try Again?'});
        } else {
          search_user_global = search_user;
          response.render('./find_friend.html', {"root": __dirname, "User":userID, 'display':'unset',
          'Message':'Is this the user you would like to connect with?', 'friend_image':doc.image, 'friend_username':search_user});
        }
      }
    });
  } else {
    response.sendFile('./error.html', {"root": __dirname});
  }
});

app.get('/make_commonlist', function(request, response) {
  console.log('-- Request received:', request.method, request.url);
  if (loggedIn) {
    getUserPlaylists(search_user_global, function(vals) {
      console.log(vals)
      if (vals === false) { // if vals is false, the user was not found
        console.log("CAN'T FIND USER");
        response.render('./export.html', {"root": __dirname, "Message":"Search Failed."}); // why was err returned as tracks?
      }
      else {
        console.log("FOUND USER");
        console.log(vals);

        let commonlist = [];
        for (let i = 0; i < vals.length; i++) {
          console.log(vals[i].albumcover);
          commonlist.push(vals[i].albumcover);
        }
        response.render('./export.html', {"root": __dirname, "Message":"Search Success! Combining your music tastes with user ", "User":userID, "friend_username":search_user_global, "Tracks":vals});
        // search_user_global = search_user;
      }
    });
  } else {
    response.sendFile('./error.html', {"root": __dirname});
  }
});

//importing spotify data:
app.get('/spotify_import', function(request, response){
  console.log('-- Request received: spotify import');
  var scope = 'user-read-private user-read-email user-library-read playlist-modify-public playlist-modify-private';
  response.redirect('https://accounts.spotify.com/authorize?' +
  querystring.stringify({
    response_type: 'code',
    client_id: clientID,
    scope: scope,
    redirect_uri: redirectUri
  }));
});

//callback from spotify auth:
app.get('/callback', function(request, response){
  console.log('-- Request received: spotify callback');
  var code = request.query.code || null; //auth code from spotify!
  if (code===null){
    console.log('error retrieving spotify auth code');
    response.redirect('/error')
  }
  else{
    //got code succesfully, now init spotify web API connection
    console.log(code);

    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(clientID + ':' + clientSecret).toString('base64'))
      },
      json: true
    };
    request_library.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
        refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request_library.get(options, function(error, response, body) {
          console.log('weeee' + JSON.stringify(body));
          spotifyID = body.id;
          console.log("set spotify ID to " +spotifyID);
        });
        console.log('access_token is ' + access_token);
        global_access_token = access_token;
        spotifyApi.setAccessToken(access_token);

      }
    });
  }
  response.redirect('/import');
});

app.get('/import', function(request, response){
  console.log('-- Request received:');

  response.render('./import.html', {"root": __dirname});
});

app.get('/import_playlists', function(request, response){
  console.log('-- Request received:');
  // saving the user's pro pic
  spotifyApi.getMe()
  .then(function(data) {
    let propic = data.body.images[0].url;
    if (propic !== null) {
      db.User.findOneAndUpdate({"username":userID} , {"image" : propic}, function(err, doc){
        if(err){
          console.error(err);
        }
      });
    }
  }, function(err) {
    console.error(err);
  });
  // Get a user's playlists
  // spotifyApi.getUserPlaylists(spotifyID)
  // .then(function(data) {
  //   console.log('Retrieved playlists', data.body);
  // },function(err) {
  //   console.log('Something went wrong!', err);
  // });

  var ct = 0;
  let os = 0;
  var intervalID = setInterval(function () {
    var itemsLength = 50;
    spotifyApi.getMySavedTracks({
      limit : 50,
      offset: os
    })
    .then(function(data) {
      os += 50;
      var songInfo = [];
      itemsLength =  data.body.items.length;
      console.log("LENGTH " + itemsLength + " OFFSET " + os);
      for(let i = 0; i < data.body.items.length; i++){
        // song.name = data.body.items[i].track.name;
        spotifyApi.getAudioFeaturesForTrack(data.body.items[i].track.id)
        .then(function(data1) {
          var song = {};
          song.albumcover = data.body.items[i].track.album.images[1].url;
          song.album = data.body.items[i].track.album.name;
          song.name = data.body.items[i].track.name;
          song.artist = data.body.items[i].track.album.artists[0].name;
          song.id =  data.body.items[i].track.id;
          song.dance = data1.body.danceability;
          song.loud = data1.body.loudness;
          song.instrum = data1.body.instrumentalness;
          songInfo.push(song);
          if(songInfo.length===data.body.items.length - 1){
            db.User.findOneAndUpdate({"username": userID}, {"$addToSet": { "trackInfo": { "$each": songInfo }}}, function(err, doc){
              if(err){
                console.error(err);
              }
              console.log(doc);
            });
            // { "$addToSet": { "trackInfo": { "$each": songInfo } }});
            // console.log(JSON.stringify?)
          }
        }, function(err) {
          console.error(err);
        });
      }

    }, function(err) {
      console.log('Something went wrong!', err);
    });
    if (++ct === 10) {
      console.log("STOPPED at " + ct);
      clearInterval(intervalID);
    }
  }, 10000);

  //TODO: GET SONGS FROM PLAYLISTS : spotifyApi.getPlaylistTracks()

  //TODO : STORE PLAYLIST DATA / SONG DATA IN DATABASE

  response.render('./profile.html', {"root": __dirname, "User":userID, "Message":"Import success! Now search to find your friend's songs and combine your music tastes."});

});


// search for users
app.get('/search', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  var search_user = request.query.user; // the user that we are looking for
  getUserPlaylists(search_user, function(vals) {
    console.log(vals)
    if (vals === false) { // if vals is false, the user was not found
      console.log("CAN'T FIND USER");
      response.render('./export.html', {"root": __dirname, "Message":"Search Failed"}); // why was err returned as tracks?
    }
    else {
      console.log("FOUND USER");
      response.render('./export.html', {"root": __dirname,
      "Message":"Search Success! Combining your music tastes with user ",
      "User":search_user, "Tracks":vals});
      search_user_global = search_user;
    }
  });
});

//logout redirect to login
app.get('/logout', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.status(200).type('html');
  loggedIn = false; //global auth variable (now logged out)
  userID = '';
  response.redirect('/login');
});

app.get('/error', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.render('./error.html', {"root": __dirname});
});


//stylesheet
app.get('/styles.css', function(request, response){
  console.log('-- Request received:');
  response.sendFile('./styles.css', {"root": __dirname});
});


app.get('/spotify_export', function(request, response){
  console.log('-- Request received: export playlist');
  let res = exportPlaylist(search_user_global);
  // response.render('./export.html', {"root": __dirname, "Message":"Playlist successfully exported! Check spotify.", "User":userID});

  if (res===0){
    response.render('./postexport.html', {"root": __dirname, "User":userID, "Message":"Playlist successfully exported! Check spotify."});
  } else {
    response.render('./postexport.html', {"root": __dirname, "User":userID, "Message":"There was an error exporting to Spotify. You might need to re-authorize Commonlist's access to Spotify by re-importing your music tastes."});
  }
});

function exportPlaylist(id) {

  //PLAYLIST FROM USER SEARCHED FOR AND LOGGED IN USER

  var query = db.User.findOne({username: id}, function(err, obj) {

    var toExportUser1 = [];
    var toExportUser2 = [];
    var listofAllIDs = [];

    if (obj === null) {
      console.log("Could not find user");
      return 1;
    } else {
      for(let i=0; i<obj.trackInfo.length; i++){
        toExportUser1.push('spotify:track:' + obj.trackInfo[i].id);
        listofAllIDs.push(obj.trackInfo[i].id);
      }
    }

    var query2 = db.User.findOne({username: userID}, function(err, obj) {
      if (obj === null) {
        console.log("Could not find user");
        return 1;
      } else {
        for(let i=0; i<obj.trackInfo.length; i++){
          toExportUser2.push('spotify:track:' + obj.trackInfo[i].id);
          listofAllIDs.push(obj.trackInfo[i].id);
        }
      }

      //console.log(toExportUser1, toExportUser2, listofAllIDs);


      combinedPlaylist = mixMusicTastesAlgorithm(toExportUser1, toExportUser2, listofAllIDs, id, userID);


    });


  });
  return 0;
}

function mixMusicTastesAlgorithm(user1Music, user2Music, listofAllIDs, id, userID){

  getSongsInCommon(user1Music, user2Music, listofAllIDs, id, userID); //finishes then calls generateSongsincommon

}

function generateSongsInCommon(user1Music, user2Music, numberToGen, listofAllIDs, songsInCommon, user1, user2){
  //TODO using Matt's algorithm: https://docs.google.com/document/d/1ISwg8G6iC-S01ga0BEv9PeduSrMQsPs8OXbtxAS-wCs/edit
  console.log("We are generating songs in common now");

  let len = listofAllIDs.length;
  if (len>100){
    len=100;
  }
  var options = {
    url: 'https://api.spotify.com/v1/audio-features/?ids=',
    headers: { 'Authorization': 'Bearer ' + global_access_token },
    json: true
  };

  for(let i=0; i<len; i++){
    let cur = listofAllIDs[i] + ','
    options.url += cur
  }
  // use the access token to access the Spotify API and get song data
  //then get averages of danceability, energy, tempo, valence
  request_library.get(options, function(error, response, body) {
    let avg_danceability = 0, avg_energy = 0, avg_tempo = 0, avg_valence = 0;
    for(let i=0; i<body.audio_features.length; i++){
      avg_danceability += body.audio_features[i].danceability;
      avg_energy += body.audio_features[i].energy;
      avg_tempo += body.audio_features[i].tempo;
      avg_valence += body.audio_features[i].valence;
    }
    avg_danceability = avg_danceability/(body.audio_features.length)
    avg_energy = avg_energy/(body.audio_features.length)
    avg_tempo = avg_tempo/(body.audio_features.length)
    avg_valence = avg_valence/(body.audio_features.length)

    //now pick a few random songs as SEED VALUES
    songid1 = listofAllIDs[Math.floor(Math.random()*listofAllIDs.length)]
    songid2 = listofAllIDs[Math.floor(Math.random()*listofAllIDs.length)]
    songid3 = listofAllIDs[Math.floor(Math.random()*listofAllIDs.length)]
    songid4 = listofAllIDs[Math.floor(Math.random()*listofAllIDs.length)]
    songid5 = listofAllIDs[Math.floor(Math.random()*listofAllIDs.length)]


    var rec_options = {
      url: 'https://api.spotify.com/v1/recommendations?',
      headers: { 'Authorization': 'Bearer ' + global_access_token },
      json: true    };

      rec_options.url += 'seed_tracks=' + songid1 + ',' + songid2 + ',' + songid3 + ',' +songid4 + ',' +songid5;
      rec_options.url += '&min_popularity=50&market=US';
      rec_options.url += '&target_energy=' + avg_energy;
      rec_options.url += '&target_valence=' + avg_valence;
      rec_options.url += '&target_tempo=' + avg_tempo;
      rec_options.url += '&target_danceability=' + avg_danceability;
      rec_options.url += '&limit=' + numberToGen;

      request_library.get(rec_options, function(error, response, body) {
        generatedIDs = []
        for(let h=0; h<body.tracks.length; h++){
          generatedIDs.push('spotify:track:' + body.tracks[h].id);
        }

        combined = songsInCommon.concat(generatedIDs); //should be 50 songs now (songs in common + from pref algo)
        console.log("combined: " +combined);

        //NOW CREATE PLAYLIST:

 spotifyApi.createPlaylist(spotifyID, ('Commonlist: ' + user1 + ' & ' + user2 + ' #' + Math.floor(Math.random() * (100 - 30 + 1)) + 30), { 'public' : false })        .then(function(data) {
          spotifyApi.addTracksToPlaylist(spotifyID, data.body.id, combined)
          .then(function(data) {
            console.log('Added tracks to playlist!');
            return 0;
          }, function(err) {
            console.log('Something went wrong!', err);
            return 1;
          });
        }, function(err) {
          console.log('Something went wrong!', err);
        });
        //NOW CREATE PLAYLIST:

      });

    });

  }

  function getSongsInCommon(user1Music, user2Music, listofAllIDs, id, userID){
    combined = [];

    for(let i=0; i<user1Music.length; i++){
      for(let j=0; j<user2Music.length; j++){
        if(user1Music[i] == user2Music[j]){
          combined.push(user1Music[i]);
        }
      }
    }
      let toGenerate = 50 - combined.length

      return generateSongsInCommon(user1Music, user2Music, toGenerate, listofAllIDs, combined, id, userID);
    }

    //404!
    app.get('*', function(request, response){
      console.log('-- Request received: 404');
      response.sendFile('./error.html', {"root": __dirname});
    });


    app.listen(8080, function(){
      console.log('-- Server listening on port 8080');
    });

    function getUserPlaylists(id, callback) {
      var query = db.User.findOne({username: id}, function(err, obj) {
        if (obj === null) {
          console.log("returning false");
          callback(false);
        } else {
          if (err) {
            console.error(err);
            console.log("returning false");
            callback(false);
          } else {
            console.log("returning object");
            var tracks = obj.trackInfo;
            callback(tracks);
          }
        }
        return;
      });
    }
