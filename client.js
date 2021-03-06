var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var Iconv = require('iconv').Iconv;

var SCOPES = [
  // 'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];
var TOKEN_PATH = "./.token.json";

//
// class GAuth
//
var GAuth = function (client_id, client_secret, redirect_uri) {
  var auth = new googleAuth();
  this.oauth2client = new auth.OAuth2(
    client_id,
    client_secret,
    redirect_uri);
};

GAuth.prototype.set_credentials = function (token) {
  this.oauth2client.credentials = token;
  return Promise.resolve(this.oauth2client);
}

GAuth.prototype.authorize = function() {
  var self = this;
  return new Promise(function(resolve, reject){
    fs.readFile(TOKEN_PATH, function(err, token) {
      if (err) {
        resolve(self.getNewToken())
      } else {
        resolve(JSON.parse(token))
      }
    });
  }).then(function(token) {
    return self.set_credentials(token);
  });
}

GAuth.prototype.getNewToken = function() {
  var self = this;
  var auth_url = self.oauth2client.generateAuthUrl({
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
      self.oauth2client.getToken(code, function(err, token) {
        if (err) {
          reject("Error while trying to retrieve access token: " + err);
          return;
        }
        fs.writeFile(TOKEN_PATH, JSON.stringify(token));
        console.log("Token stored to " + TOKEN_PATH);
        resolve(token);
      });
    });
  });
}


//
// class GClient
//
var GClient = function(auth) {
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
      console.log(files);
      if (files.length != 1) {
        reject("Unexpected number of files: " + files.length.toString());
        return;
      }
      resolve(files[0]);
    });
  });
}

GClient.prototype.getText = function(fileId) {
  var files = this.service.files;
  return new Promise(function(resolve, reject) {
    files.export({
      fileId: fileId,
      mimeType: "text/plain"
    }, function(err, body, resp) {
      if (err) {
        reject("The API returned an error: " + err);
        return;
      }
      resolve(resp);
    });
  });
}

//
// main
//
console.log(process.argv);
if (process.argv.length < 3) {
  console.log("Usage: aotran <download-filename> [<output-filename>]")
  process.exit(-1);
}

var filename = process.argv[2];
var outfile = process.argv[3] || filename
console.log(filename, outfile);

var gclient;
var gauth = new GAuth(
  process.env.AOTRAN_CLIENT_ID,
  process.env.AOTRAN_CLIENT_SECRET,
  process.env.AOTRAN_REDIRECT_URI
);

gauth.authorize()
.then(function(auth) {
  gclient = new GClient(auth);
  return new Promise(function(resolve, reject) {
    fs.readFile("downloads/" + filename+".json", function(err, data) {
      if(err) {
        resolve(gclient.findFile(filename));
      } else {
        resolve(JSON.parse(data));
      }
    });
  });
})
.then(function(file) {
  console.log("%s (%s)", file.name, file.id);
  return gclient.getText(file.id);
})
.then(function(resp) {
  var writable = fs.createWriteStream("downloads/" + outfile);
  var iconv = new Iconv('UTF-8', 'cp932//TRANSLIT//IGNORE');
  writable.write(iconv.convert(resp.body))
  writable.write("\r\n");
  writable.end();
})
.catch(function(err) {
  console.log("Error: ", err)
});
