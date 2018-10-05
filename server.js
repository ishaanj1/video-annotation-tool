const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const _ = require('lodash');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const passportJWT = require('passport-jwt');
const ExtractJwt = passportJWT.ExtractJwt;
const JwtStrategy = passportJWT.Strategy;

const bcrypt = require('bcrypt');
const psql = require('./db/simpleConnect');
const AWS = require('aws-sdk');

AWS.config.update(
  {
    accessKeyId: "AKIAIJRSQPH2BGGCEFOA",
    secretAccessKey: "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",
  }
);

var jwtOptions = {};
jwtOptions.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
jwtOptions.secretOrKey = 'Bernie wouldve won';

async function findUser(userId) {
  queryPass = 'select id, username, password, admin from users where users.id=$1';
  const user = await psql.query(queryPass,[userId]);
  if (user.rows.length == 1) {
    return user.rows[0];
  } else {
    return false;
  }
}

var strategy = new JwtStrategy(jwtOptions, async function(jwt_payload, next) {
  console.log('payload received', jwt_payload);

  var user = await findUser(jwt_payload.id);
  if (user) {
    next(null, user);
  } else {
    next(null, false);
  }
});

passport.use(strategy);

const app = express();

app.use(passport.initialize());

// parse application/x-www-form-urlencoded
// for easier testing with Postman or plain HTML forms
app.use(bodyParser.urlencoded({
  extended: true
}));
// parse application/json
app.use(bodyParser.json())

async function userLogin(username, password) {
  queryPass = 'select id, password, admin from users where users.username=$1';

  const user = await psql.query(queryPass,[username]);
  if (user.rows.length > 1) {
    return -1;
  }
  if (user.rows.length == 0) {
    return 1;
  }
  const res = await bcrypt.compare(password,user.rows[0].password);
  if (res) {
    return user.rows[0];
  } else {
    return 2;
  }
}

app.post("/login", async function(req, res) {
  if (!req.body.username || !req.body.password) {
    res.json({
      message: "Invalid parameters: username and password required"
    });
    return;
  }
  var username = req.body.username;
  var password = req.body.password;
  var choice = await userLogin(username, password);
  switch(choice) {
    case -1:
      res.json({message: "sorry, something went wrong"});
      break;
    case 1:
      res.json({message:"username not found"});
      break;
    case 2:
      res.json({message:"wrong password"});
      break;
    default:
      var payload = {id: choice.id};
      var token = jwt.sign(payload, jwtOptions.secretOrKey);
      res.json({message: "welcome", token: token, admin: choice.admin});
      break;
  }
});

//Code for profile modification
app.post('/changePassword', passport.authenticate('jwt', {session: false}),
  async (req, res) => {
    if (req.body.password1 != req.body.password2) {
      res.json({message: "New passwords not matching"});
      res.end();
    }
    queryPass = 'select password from users where users.username=$1';
    try {
      const currentPass = await psql.query(queryPass,[req.user.username]);
      try {
        const match = await bcrypt.compare(req.body.password, currentPass.rows[0].password);
        if (match) {
          const saltRounds = 10;
          const hash = await bcrypt.hash(req.body.password1, saltRounds);
          queryUpdate = 'UPDATE users SET password=$1 WHERE username=$2';
          try {
            const update = await psql.query(queryUpdate,[hash,req.user.username]);
            res.json({message: 'Changed'});
            res.end();
          } catch (error) {
            res.json({message: "error: " + error.message});
            res.end();
          }
        } else {
          res.json({message: "Wrong Password!"});
          res.end();
        }
      } catch (error) {
        res.json({message: "error: " + error.message});
        res.end();
      }
    } catch (error) {
      res.json({message: "error: " + error.message});
      res.end();
    }
  }
)

//Code for create users
app.post('/createUser', passport.authenticate('jwt', {session: false}),
  async (req, res) => {
    if(req.user.admin) {
      queryText = "INSERT INTO users(username, password, admin) VALUES($1, $2, $3) RETURNING *"
      const saltRounds = 10;
      try {
        var hash = await bcrypt.hash(req.body.password, saltRounds);
      } catch (error) {
        res.json({message: "error hashing" + error.message})
        res.end()
      }
      try {
        const insertUser = await psql.query(queryText,[req.body.username, hash, req.body.admin]);
        res.json({message: "user created", user: insertUser.rows[0]});
      } catch (error) {
        res.json({message: "error inserting: " + error.message})
        res.end();
      }
    } else {
      res.status(401).json({message: "Must be admin to create new user!"})
      res.end();
    }
});

app.get('/api/concepts', passport.authenticate('jwt', {session: false}),
  async (req, res) => {
    queryText = 'select id, name from concepts where concepts.parent=$1';
    try {
      const concepts = await psql.query(queryText, [req.query.id]);
      res.json(concepts.rows);

    } catch (error) {
      res.status(400).json(error);
    }
  }
);

app.get('/api/conceptsSelected', passport.authenticate('jwt', {session: false}),
  async (req, res) => {
    queryText = 'select conceptid from profile where profile.userid=$1';
    try {
      let concepts = await psql.query(queryText, [req.user.id]);
      res.json(concepts.rows);
    } catch (error) {
      res.status(400).json(error);
    }
  }
);

//Will add concept by name to user's selected concepts.
app.post('/api/selectConcept', passport.authenticate('jwt', {session: false}),
  async (req, res) => {
    let concepts = null
    queryText = "SELECT id FROM concepts WHERE name=$1";
    try {
      concepts = await psql.query(queryText, [req.body.name]);
    } catch (error) {
      res.status(400).json(error);
    }
    if(concepts.rows.length > 0){
      queryText = 'INSERT INTO profile(userid, conceptid) VALUES($1, $2) RETURNING *';
      try {
        let insert = await psql.query(queryText, [req.user.id, concepts.rows[0]['id']]);
        res.json({message: "Changed", value: JSON.stringify(insert.rows)});
      } catch (error) {
        res.status(400).json(error);
      }
    }else{
      res.json({message: "Not Changed"});
    }
  }
);

app.post('/api/conceptSelected', passport.authenticate('jwt', {session: false}),
  async (req, res) => {
    queryText = 'DELETE FROM profile WHERE profile.userid=$1 AND profile.conceptid=$2 RETURNING *';
    if (req.body.checked) {
      queryText = 'INSERT INTO profile(userid, conceptid) VALUES($1, $2) RETURNING *';
    }
    try {
      let insert = await psql.query(queryText, [req.user.id, req.body.id]);
      res.json({message: "Changed", value: JSON.stringify(insert.rows)});
    } catch (error) {
      res.status(400).json(error);
    }
  }
);

app.get('/api/conceptImages/:id',
  async (req, res) => {
    let s3 = new AWS.S3();
    queryText = 'select picture from concepts where concepts.id=$1';
    try {
      const response = await psql.query(queryText, [req.params.id]);
      const picture = response.rows[0].picture;
      const params = {
        Bucket: 'lubomirstanchev',
        Key: `concept_images/${picture}`
      }
      s3.getObject(params).createReadStream().pipe(res);
    } catch (error) {
      res.status(400).json(error);
    }
  }
);

app.get('/api/videoNames', passport.authenticate('jwt', {session: false}),
  async (req, res) => {
    queryPass = 'select id, filename from videos;'
    try {
      const videoData = await psql.query(queryPass);
      res.json(videoData);
    } catch (error) {
      res.json(error);
    }
  }
);

app.get('/api/videosWatched', passport.authenticate('jwt', {session: false}),
  async (req, res) => {
    let queryPass = 'SELECT DISTINCT ON (videos.filename) videos.filename, videos.id FROM videos, annotations WHERE videos.id = annotations.videoid AND annotations.userid = $1';
    let userId = req.user.id;
    try {
      const videoData = await psql.query(queryPass, [userId]);
      res.json(videoData.rows);
    } catch (error) {
      res.json(error);
    }
  }
);

app.get('/api/annotations/:videoid', passport.authenticate('jwt', {session: false}),
  async (req, res) => {
    let videoId = req.params.videoid;
    let queryPass = 'SELECT annotations.id, annotations.timeinvideo, annotations.x1, annotations.y1, annotations.x2, annotations.y2, annotations.videoWidth, annotations.videoHeight, annotations.imagewithbox, concepts.name, videos.filename FROM annotations, concepts, videos WHERE annotations.conceptid=concepts.id AND annotations.userid=$1 AND annotations.videoid=$2 AND videos.id=annotations.videoid ORDER BY annotations.timeinvideo';
    let userId = req.user.id;
    try {
      const videoData = await psql.query(queryPass, [userId, videoId]);
      res.json(videoData.rows);
    } catch (error) {
      res.json(error);
    }
  }
);

app.get('/api/annotationImage/:name', (req, res) => {
  let s3 = new AWS.S3();
  let key = 'test/' + req.params.name;
  var params = {
    Key: key,
    Bucket: 'lubomirstanchev',
  };
  s3.getObject(params, async (err, data) => {
    if (err) {
      res.json(err);
    }
    else {
      res.json({image: data.Body});
    }
  })
});

app.get('/api/videos/Y7Ek6tndnA/:name', (req, res) => {
  var s3 = new AWS.S3();
  const mimetype = 'video/mp4';
  const file = 'videos/' + req.params.name;
  const cache = 0;
  s3.listObjectsV2({Bucket: 'lubomirstanchev', MaxKeys: 1, Prefix: file}, function(err, data) {
    if (err) {
      return res.sendStatus(404);
    }
    if (req != null && req.headers.range != null) {
      var range = req.headers.range;
      var bytes = range.replace(/bytes=/, '').split('-');
      var start = parseInt(bytes[0], 10);
      var total = data.Contents[0].Size;
      var end = bytes[1] ? parseInt(bytes[1], 10) : total - 1;
      var chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range'  : 'bytes ' + start + '-' + end + '/' + total,
        'Accept-Ranges'  : 'bytes',
        'Content-Length' : chunksize,
        'Last-Modified'  : data.Contents[0].LastModified,
        'Content-Type'   : mimetype
      });
      s3.getObject({Bucket: 'lubomirstanchev', Key: file, Range: range}).createReadStream().pipe(res);
    }
    else
    {
      res.writeHead(200,
      {
        'Cache-Control' : 'max-age=' + cache + ', private',
        'Content-Length': data.Contents[0].Size,
        'Last-Modified' : data.Contents[0].LastModified,
        'Content-Type'  : mimetype
      });
      s3.getObject({Bucket: 'lubomirstanchev', Key: file}).createReadStream().pipe(res);
    }
  });
});

async function getVideoId(value) {
  queryPass = 'select id from videos where videos.filename=$1';
  try {
    const user = await psql.query(queryPass,[value]);
    return user.rows[0].id;
  } catch (error) {
    console.log(error);
  }
}

async function getConceptId(value) {
  //Not yet supported
  queryPass = 'select id from concepts where concepts.name=$1';
  try {
    const queryRes = await psql.query(queryPass,[value]);
    return queryRes.rows[0].id;
  } catch (error) {
    console.log(error);
  }
}

app.post("/annotate", passport.authenticate('jwt', {session: false}),
  async (req, res) => {
  let videoId = await getVideoId(req.body.videoId);
  let userId = req.user.id;
  let conceptId = await getConceptId(req.body.conceptId);
  queryText = 'INSERT INTO annotations(videoid, userid, conceptid, timeinvideo, x1, y1, x2, y2, videoWidth, videoHeight, image, imagewithbox, dateannotated) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, current_timestamp) RETURNING *';
  try {
    let insertRes = await psql.query(queryText, [videoId, userId, conceptId, req.body.timeinvideo, req.body.x1, req.body.y1, req.body.x2, req.body.y2, req.body.videoWidth, req.body.videoHeight, req.body.image, req.body.imagewithbox]);
    res.json({message: "Annotated", value: JSON.stringify(insertRes.rows[0])});
  } catch(error) {
    console.log(error)
    res.json({message: "error: " + error})
  }
});

app.post('/commentedAnnotate', passport.authenticate('jwt', {session: false}),
  async (req, res) => {
  let videoId = await getVideoId(req.body.videoId);
  let userId = req.user.id;
  let conceptId = await getConceptId(req.body.conceptId);
  queryText = 'INSERT INTO annotations3(videoid, userid, conceptid, timeinvideo, x1, y1, x2, y2, videoWidth, videoHeight, image, imagewithbox, comment, dateannotated) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, current_timestamp) RETURNING *';
  try {
    let insertRes = await psql.query(queryText, [videoId, userId, conceptId, req.body.timeinvideo, req.body.x1, req.body.y1, req.body.x2, req.body.y2, req.body.videoWidth, req.body.videoHeight, req.body.image, req.body.imagewithbox, req.body.comment, req.body.unsure]);
    res.json({message: "Annotated", value: JSON.stringify(insertRes.rows[0])});
  } catch(error) {
    console.log(error)
    res.json({message: "error: " + error})
  }
});

app.post("/api/listConcepts", passport.authenticate('jwt', {session: false}),
  async (req, res) => {
    var params = [];
    for (var i = 1; i<=req.body.conceptList.length; i++) {
      params.push('$' + i);
    }
    queryText = 'SELECT * FROM concepts WHERE concepts.id IN(' + params.join(',') + ')';
    try {
      var conceptInfo = await psql.query(queryText, req.body.conceptList);
      res.json(conceptInfo.rows);
    } catch (error) {
      console.log(error);
    }
  }
);

app.post('/api/delete', passport.authenticate('jwt', {session: false}),
  async (req, res) => {
    queryText = 'DELETE FROM annotations WHERE annotations.id=$1 RETURNING *';
    try {
      var deleteRes = await psql.query(queryText, [req.body.id]);
      res.json(deleteRes.rows);
    } catch (error) {
      console.log(error);
    }
  }
);

// Express only serves static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client', 'build')));
  app.get('/*', (req, res) =>  {
    res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
  });
}

app.set('port', (process.env.PORT || 3001));

app.listen(app.get('port'), () => {
  console.log(`Find the server at: http://localhost:${app.get('port')}/`); // eslint-disable-line no-console
});
