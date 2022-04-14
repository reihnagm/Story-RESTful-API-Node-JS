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
const { json } = require("express/lib/response")

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    if(file.mimetype == "image/jpeg") {
    callback(null, "./public/images")
    } else {
    callback(null, "./public/videos")
    }
  },
  filename: (req, file, callback) => {
      callback(null, file.originalname)
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
  database: 'story'
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
        "fullname": fullname,
        "phone": phone,
        "pic": pic
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
    let itemsAssign = []
    for (const k in stories) {
      itemsAssign.push({
        "uid": stories[k].uid,
        "caption": stories[k].caption, 
        "media": stories[k].media,
        "type": stories[k].type
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
  } catch(e) {
    console.log(e)
  }
})

app.get("/story/count/:user_id", async (req, res) => {
  let userId = req.params.user_id
  let stories = await getStoriesCount(userId)
  return res.json({
    "status": res.statusCode,
    "data": stories
  })
})

app.post("/story/store", async (req, res) => {
  let type

  let userStoryUid = req.body.user_story_uid
  let storyUid = req.body.uid
  let caption = req.body.caption
  let fileType = req.body.type
  let media = req.body.media
  let userId = req.body.user_id

  switch (fileType) {
    case "image":
      type = "1"
    break;
    case "video":
      type = "2"
    break;
    default:
    break;
  }

  try {
    await userStoryStore(userStoryUid, userId, storyUid)
  } catch(e) {
    console.log(e)
  }

  try {
    await storyStore(storyUid, caption, media, type)
    return res.json({
      "status": res.statusCode,
      "data": {
        "uid": storyUid,
        "caption": caption,
        "media": media,
        "type": fileType,
      }
    })
  } catch(e) {
    console.log(e)
  }
})

// MEDIA

app.post("/upload", upload.single("media"), (req, res) => {
  // let url = "";
  let file = req.file.filename
  // let mimetype = req.file.mimetype
  // if(mimetype == "image/jpeg") {
  //   url = ""
  // } else {
  //   url = ""
  // }
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
      b.name AS type, d.fullname, d.pic, d.uid AS user_id, 
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



function getStoriesCount(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) as total FROM stories WHERE user_id = '${userId}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
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

function userStoryStore(uid, userId, storyId) {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO user_stories (uid, user_id, story_uid) 
    VALUES ('${uid}', '${userId}', '${storyId}')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function storyStore(uid, caption, media, fileType) {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO stories (uid, caption, media, type) 
    VALUES ('${uid}', '${caption}', '${media}', '${fileType}')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
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