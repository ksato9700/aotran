var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

var SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
var TOKEN_PATH = "./.token.json";

function authorize() {
  var auth = new googleAuth();
  var oauth2client = new auth.OAuth2(
    process.env.AOTRAN_CLIENT_ID,
    process.env.AOTRAN_CLIENT_SECRET,
    process.env.AOTRAN_REDIRECT_URI
  );
  
  return new Promise (function(resolve, reject) {
    fs.readFile(TOKEN_PATH, function(err, token) {
      if (err) {
        resolve(get_new_token(oauth2client))
      } else {
        oauth2client.credentials = JSON.parse(token);
        resolve(oauth2client);
      }
    });
  });
}

function get_new_token(oauth2client) {
  var auth_url = oauth2client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log("Authorize this app by visiting this url: ", auth_url);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(function(resolve, reject) {
    rl.question("Enter the code from that page here: ", function(code) {
      rl.close();
      oauth2client.getToken(code, function(err, token) {
        if (err) {
          reject("Error while trying to retrieve access token: " + err);
          return;
        }
        oauth2client.credentials = token;
        store_token(token);
        resolve(oauth2client);
      });
    });
  });
}

function store_token(token) {
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log("Token stored to " + TOKEN_PATH);
}

GClient = function(auth) {
  this.service = google.drive({
    version: 'v3',
    auth: auth,
  });
};

GClient.prototype.findFile = function(name) {
  var files = this.service.files;
  return new Promise(function(resolve, reject) {
    files.list({
      q: "name='" + name + "'",
    　fields: "files(id, name)"
    }, function(err, resp) {
      if (err) {
        reject("The API returned an error: " + err);
      }
      var files = resp.files;
      if (files.length != 1) {
        reject("Unexpected number of files: ", files.length);
      } else {
        resolve(files[0]);
      }
    });
  });
}

authorize()
.then(function(auth) {
  gclient = new GClient(auth);
  return gclient.findFile("秘密");
})
.then(function(file) {
  console.log("%s (%s)", file.name, file.id);
})
.catch(function(err) {
  console.log("Error: ", err)
});
