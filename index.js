const express = require("express")
const cors = require("cors")
const app = express()
const logger = require("morgan")
const moment = require("moment")
moment.locale('id')
const mysql = require("mysql")
const helmet = require("helmet")
const compression = require("compression")
const multer = require("multer")

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    if(file.mimetype == "image/jpeg") {
    callback(null, "./public/images")
    } else {
    callback(null, "./public/videos")
    }
  },
  filename: (req, file, callback) => {
    callback(null, file.originalname.replace(file.originalname, Date.now() + `.${file.mimetype.split("/")[1]}`))
  }
})

const upload = multer({
  storage
})

let conn = mysql.createConnection({
  host:'167.99.76.66',
  user:'root',
  port: '3307',
  password:'cx2021!',
  database: 'story',
})

conn.connect(function(e) {
  if (e) {
    return console.log(e.message);
  }
  console.log('Connected to the MySQL Server');
});

app.use(cors())
app.use(helmet())
app.use(compression())
app.use(logger("dev"))
app.use(express.static("public"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.post("/auth/sign-in", async (req, res) => {
  let phone = req.body.phone 
  let pass = req.body.pass
  try {
    let signInD = await signIn(phone, pass)
    if(signInD  == null) {
      return res.status(401).json({
        "status": 401,
        "data": {
          "error": "Invalid Phone or Password"
        }
      })
    }
    return res.json({
      "status": res.statusCode,
      "data": {
        "uid": signInD.uid,
        "fullname": signInD.fullname,
        "pic": signInD.pic,
        "phone": signInD.phone
      }
    })
  } catch(e) {
    console.log(e)
  }
})

app.post("/auth/sign-up", async (req, res) => {
  let uid = req.body.uid
  let fullname = req.body.fullname
  let phone = req.body.phone
  let pass = req.body.pass 
  let pic = req.body.pic
  try {
    await signUp(uid, fullname, phone, pass, pic)
    return res.json({
      "status": res.statusCode,
      "data": {
        "uid": uid,
        "fullname": fullname,
        "pic": pic,
        "phone": phone,
      }
    })
  } catch(e) {
    console.log(e)
  }
})

app.get("/story", async (req, res) => {
  let dataAssign = []
  try {
    let storiesUser = await getStoriesUser()
    let stories = await getStories()
    if(stories.length != 0) {
      let itemsAssign = []
      for (const k in stories) {
        itemsAssign.push({
          "uid": stories[k].uid,
          "caption": stories[k].caption, 
          "media": stories[k].media,
          "type": stories[k].type,
          "duration": stories[k].duration
        })
      } 
      dataAssign.push({
        "user": {
          "uid": storiesUser.uid,
          "fullname": storiesUser.fullname,
          "pic": storiesUser.pic,
          "created": moment(storiesUser.created).format('LT'),
          "item_count": stories.length,
          "items": itemsAssign
        }
      })
      return res.json({
        "status": res.statusCode,
        "data": dataAssign
      })
    } else {
      return res.json({
        "status": res.statusCode,
        "data": []
      })
    }
  } catch(e) {
    console.log(e)
  }
})

app.post("/story/store", async (req, res) => {
  let type

  let userStoryUid = req.body.user_story_uid
  let storyUid = req.body.uid
  let caption = req.body.caption
  let fileType = req.body.type
  let duration = req.body.duration
  let media = req.body.media
  let userId = req.body.user_id

  switch (fileType) {
    case "image":
      type = "1"
    break;
    case "video":
      type = "2"
    break;
    case "text": 
      type = "3"
    default:
    break;
  }

  try {
    await userStoryStore(userStoryUid, userId, storyUid, caption, media, type, duration)
    return res.json({
      "status": res.statusCode,
      "data": {
        "uid": storyUid,
        "caption": caption,
        "media": media,
        "type": fileType,
        "duration": duration,
        "user_id": userId
      }
    })
  } catch(e) {
    console.log(e)
  }
})

// MEDIA

app.post("/upload", upload.single("media"), (req, res) => {
  let file = req.file.filename
  return res.json({
    "status": res.statusCode, 
    "data": {
      "media": file
    }
  })
})

function getStories() {
  return new Promise((resolve, reject) => {
    const query = `SELECT DISTINCT a.uid, a.caption, a.media, 
      b.name AS type, a.duration, d.fullname, d.pic, d.uid AS user_id, 
      c.created_at AS created  
      FROM stories a 
      INNER JOIN story_types b ON a.type = b.id
      INNER JOIN user_stories c ON a.uid = c.story_uid
      INNER JOIN users d ON c.user_id = d.uid`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function getStoriesUser() {
  return new Promise((resolve, reject) => {
    const query = `SELECT a.uid, a.fullname, a.pic, s.created_at AS created
    FROM users a 
    INNER JOIN user_stories s ON a.uid = s.user_id
    WHERE s.created_at IN (SELECT MAX(us.created_at) FROM user_stories us)
    GROUP BY a.uid`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0])
      }
    })
  })
}

function signIn(phone, pass) {
  return new Promise((resolve, reject) => {
    const query = `SELECT uid, fullname, pic, phone FROM users WHERE phone = '${phone}' 
    AND password = '${pass}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0])
      }
    })
  })
}

function signUp(uid, fullname, phone, pass, pic) {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO users (uid, fullname, phone, password, pic) VALUES('${uid}','${fullname}','${phone}', '${pass}', '${pic}')` 
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function userStoryStore(uid, userId, storyId, caption, media, fileType, duration) {
  return new Promise((resolve, reject) => {
    conn.beginTransaction((e) => {
      if (e) { reject(new Error(e)) }
      conn.query(`INSERT INTO user_stories (uid, user_id, story_uid) 
      VALUES ('${uid}', '${userId}', '${storyId}')`, (e, res) => {
        if(e) {
          return conn.rollback(function() {
            reject(new Error(e))
          })
        }
        conn.query(`INSERT INTO stories (uid, caption, media, type, duration) 
        VALUES ('${storyId}', '${caption}', '${media}', '${fileType}', '${duration}')`, function (e, res) {
          if (e) {
            return conn.rollback(function() {
              reject(new Error(e))
            });
          }
          conn.commit(function(e) {
            if (e) {
              return connection.rollback(function() {
                reject(new Error(e))
              });
            }
            resolve("success")
          });
        });
      })
    })
  })
}

app.get("*", (req, res) => {
  res.sendStatus(404)
})

const port = 3001;
app.listen(port, function (e) {
  if (e) throw e
  console.log('Listening on port %d', port);
});