const router = require('express').Router();
const passport = require("passport");
const psql = require("../../db/simpleConnect");
const AWS = require("aws-sdk");

router.use('/checkpoints', require('./checkpoints'))
router.use('/aivideos', require('./ai_videos'))

router.get("/", passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    let userId = req.user.id;
    //These need to be updated using joins to become optimal
    let queryUserStartedVideos = `
      SELECT 
        videos.id,
        videos.filename,
        checkpoints.finished,
        checkpoints.timeinvideo,
        count.count
      FROM
        checkpoints
      LEFT JOIN 
        (
          SELECT videoid, count(*) FROM checkpoints GROUP BY videoid
        ) AS count ON count.videoid=checkpoints.videoid
      LEFT JOIN
        videos ON videos.id=checkpoints.videoid
      WHERE
        checkpoints.userid=$1 AND checkpoints.finished=false
      ORDER BY
        videos.id
    `;
    let queryGlobalUnwatched = `
      SELECT 
        videos.id, videos.filename, false as finished, 0 as timeinvideo
      FROM 
        videos
      WHERE 
        id NOT IN (SELECT videoid FROM checkpoints)
      ORDER BY
        videos.id
    `;
    let queryGlobalWatched = `
      SELECT DISTINCT
        videos.id,
        videos.filename,
        checkpoints.finished,
        (
          CASE WHEN c.timeinvideo IS NULL THEN 0 ELSE c.timeinvideo END
        ) AS timeinvideo
      FROM
        checkpoints
      LEFT JOIN
        (
          SELECT videoid, timeinvideo FROM checkpoints WHERE userid=$1
        ) AS c ON c.videoid=checkpoints.videoid
      LEFT JOIN
        videos ON videos.id=checkpoints.videoid
      WHERE
        checkpoints.finished=true
      ORDER BY
        videos.id
    `;

    let queryGlobalInProgress = `
      SELECT 
        DISTINCT ON (videos.id) videos.id,
        videos.filename,
        checkpoints.finished,
        (
          CASE WHEN c.timeinvideo IS NULL THEN 0 ELSE c.timeinvideo END
        ) AS timeinvideo
      FROM
        checkpoints
      LEFT JOIN 
        (
          SELECT videoid, timeinvideo FROM checkpoints WHERE userid=$1
        ) AS c ON c.videoid=checkpoints.videoid
      LEFT JOIN
        videos ON videos.id=checkpoints.videoid
      WHERE 
        videos.id NOT IN (SELECT videoid FROM checkpoints WHERE finished=true)
      ORDER BY
        videos.id
    `;
    try {
      const startedVideos = await psql.query(queryUserStartedVideos, [userId]);
      const unwatchedVideos = await psql.query(queryGlobalUnwatched);
      const watchedVideos = await psql.query(queryGlobalWatched, [userId]);
      const inProgressVideos = await psql.query(queryGlobalInProgress, [
        userId
      ]);
      const videoData = [
        startedVideos,
        unwatchedVideos,
        watchedVideos,
        inProgressVideos
      ];
      res.json(videoData);
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  }
);


// summary getter ~KLS
router.get("/summary/:videoid", passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    let queryText = `
    SELECT 
      *
    FROM 
      concepts a 
    JOIN 
      (
        SELECT 
          conceptid, videoid, COUNT(*) 
        FROM 
          annotations 
        GROUP BY conceptid, videoid
      ) AS counts ON counts.conceptid=a.id
    WHERE videoid = $1`;
    try {
      const summary = await psql.query(queryText, [req.params.videoid]);
      res.json(summary.rows);
    } catch (error) {
      console.log("Error in get /api/videos/summary/:videoid");
      console.log(error);
      res.status(500).json(error);
    }
  }
);

router.patch("/:videoid", passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    let queryText = 'UPDATE videos SET description=$1 WHERE id=$2 RETURNING *';
    try {
      const updateRes = await psql.query(queryText, [
        req.body.description,
        req.params.videoid
      ]);
      res.json(updateRes.rows);
    } catch (error) {
      res.status(500).json(error);
    }
  }
);


router.get("/:videoid", passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    let queryText = `
      SELECT 
        usernames.userswatching, usernames.usersfinished, videos.* 
      FROM 
        (
          SELECT 
            videos.id,
            array_agg(users.username) AS userswatching, 
            array_agg(checkpoints.finished) AS usersfinished 
          FROM 
            videos 
          FULL OUTER JOIN 
            checkpoints ON checkpoints.videoid=videos.id 
          LEFT JOIN 
            users ON users.id=checkpoints.userid 
          WHERE 
            videos.id=$1 
          GROUP BY videos.id
        ) AS usernames  
      LEFT JOIN 
        videos ON videos.id=usernames.id
    `;
    try {
      const videoMetadata = await psql.query(queryText, [req.params.videoid]);
      res.json(videoMetadata.rows);
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  }
);

module.exports = router;


// router.get('/api/videos/Y7Ek6tndnA/:name', (req, res) => {
//   var s3 = new AWS.S3();
//   const mimetype = 'video/mp4';
//   const file = process.env.AWS_S3_BUCKET_VIDEOS_FOLDER + req.params.name;
//   const cache = 0;
//   s3.listObjectsV2({
//     Bucket: process.env.AWS_S3_BUCKET_NAME,
//     MaxKeys: 1, Prefix: file
//   }, (err, data) => {
//     if (err) {
//       return res.sendStatus(404);
//     }
//     if (!data.Contents[0]){
//       return res.redirect('/api/videos/Y7Ek6tndnA/error.mp4');
//     }
//     if (req != null && req.headers.range != null) {
//       var range = req.headers.range;
//       var bytes = range.replace(/bytes=/, '').split('-');
//       var start = parseInt(bytes[0], 10);
//       var total = data.Contents[0].Size;
//       var end = bytes[1] ? parseInt(bytes[1], 10) : total - 1;
//       var chunksize = (end - start) + 1;
//
//       res.writeHead(206, {
//         'Content-Range'  : 'bytes ' + start + '-' + end + '/' + total,
//         'Accept-Ranges'  : 'bytes',
//         'Content-Length' : chunksize,
//         'Last-Modified'  : data.Contents[0].LastModified,
//         'Content-Type'   : mimetype
//       });
//       s3.getObject({
//         Bucket: process.env.AWS_S3_BUCKET_NAME,
//         Key: file, Range: range
//       }).createReadStream().pipe(res);
//     }
//     else
//     {
//       res.writeHead(200,
//       {
//         'Cache-Control' : 'max-age=' + cache + ', private',
//         'Content-Length': data.Contents[0].Size,
//         'Last-Modified' : data.Contents[0].LastModified,
//         'Content-Type'  : mimetype
//       });
//       s3.getObject({
//         Bucket: process.env.AWS_S3_BUCKET_NAME,
//         Key: file
//       }).createReadStream().pipe(res);
//     }
//   });
// });