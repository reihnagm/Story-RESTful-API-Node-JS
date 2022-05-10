const express = require("express")
const cors = require("cors")
const app = express()
const logger = require("morgan")
const moment = require("moment")
const { v4: uuidv4 } = require('uuid')
moment.locale('id')
const mysql = require("mysql")
const helmet = require("helmet")
const compression = require("compression")
const multer = require("multer")

// WHERE s.created_at IN (SELECT MAX(us.created_at) FROM user_stories us)

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    if(file.mimetype == "image/jpeg" || file.mimetype == "image/png" || file.mimetype == "image/gif") {
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
  console.log('Connected to the MySQL Server Story');
});

let conHog = mysql.createConnection({
  host:'167.99.76.66',
  user:'root',
  port: '3307',
  password:'cx2021!',
  database: 'community_hog',
})

conHog.connect(function(e) {
  if (e) {
    return console.log(e.message);
  }
  console.log('Connected to the MySQL Server HOG');
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

app.get("/story/inbox/:user_id", async (req, res) => {
  try {
    let userId = req.params.user_id
    let inboxes = await getInboxStories(userId)
    return res.json({
      "status": res.statusCode,
      "data": inboxes
    })
  } catch(e) {
    console.log(e)
  }
})

app.put("/story/inbox/:user_id", async (req, res) => {
  try {
    let userId = req.params.user_id
    await updateInboxStories(userId)
    return res.json({
      "status": res.statusCode,
      "data": {}
    })
  } catch(e) {
    console.log(e)
  }
})

app.get("/story/self/:user_id", async (req, res) => {
  try {
    let userId = req.params.user_id
    let selfStories = await getSelfStories(userId)
    let users = {}
    let itemsDataAssign = []
    let stories = await getStories(selfStories.user_id)
    for (const z in stories) {
      itemsDataAssign.push({
        "uid": stories[z].uid,
        "backgroundColor": stories[z].backgroundColor,
        "textColor": stories[z].textColor,
        "caption": stories[z].caption, 
        "media": stories[z].media,
        "type": stories[z].type,
        "duration": stories[z].duration,
        "user": {
          "uid": selfStories.uid,
          "fullname": selfStories.fullname,
          "pic": selfStories.profile_pic,
          "created": moment(stories[z].created).format('LT')
        },
      }) 
    }
    users = {
      "user": {
        "uid": selfStories.user_id,
        "fullname": selfStories.fullname,
        "pic": selfStories.profile_pic,
        "created": moment(selfStories.created).format('LT')
      },
      "item_count": stories.length,
      "items": itemsDataAssign
    }
    return res.json({
      "status": res.statusCode,
      "data": users
    })
  } catch(e) {
    console.log(e)
  }
})

app.get("/story", async (req, res) => {
  try {
    let storiesUser = await getStoriesUser()
    if(storiesUser.length != 0) {
      let users = {}
      let itemsUserAssign = []
      for (const k in storiesUser) {
        let stories = await getStories(storiesUser[k].user_id)
        let itemsDataAssign = []
        for (const z in stories) {
          itemsDataAssign.push({
            "uid": stories[z].uid,
            "backgroundColor": stories[z].backgroundColor,
            "textColor": stories[z].textColor,
            "caption": stories[z].caption, 
            "media": stories[z].media,
            "type": stories[z].type,
            "duration": stories[z].duration,
            "user": {
              "uid": storiesUser[k].uid,
              "fullname": storiesUser[k].fullname,
              "pic": storiesUser[k].profile_pic,
              "created": moment(stories[z].created).format('LT')
            },
          })
        }
        itemsUserAssign.push({
          "uid": storiesUser[k].uid,
          "fullname": storiesUser[k].fullname,
          "pic": storiesUser[k].profile_pic,
          "created": moment(storiesUser[k].created).format('LT'),
          "item_count": stories.length,
          "items": itemsDataAssign
        })
      } 
      users = itemsUserAssign
      return res.json({
        "status": res.statusCode,
        "data": users
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

app.get("/story/expire", async (req, res) => {
  await userStoryExpire()
  return res.json({
    "status": res.statusCode,
    "data": "success"
  })
})

app.post("/story/store", async (req, res) => {
  let type

  let userStoryUid = req.body.user_story_uid
  let storyUid = req.body.uid
  let backgroundColor = req.body.backgroundColor
  let textColor = req.body.textColor
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
    await userStoryStore(userStoryUid, userId, storyUid, backgroundColor, textColor, caption, media, type, duration)
    return res.json({
      "status": res.statusCode,
      "data": {
        "uid": storyUid,
        "backgroundColor": backgroundColor,
        "textColor": textColor,
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

app.post("/story/store/inbox", async (req, res) => {
  let storyUid = req.body.uid
  let userId = req.body.user_id

  try {
    let users = await getUsersHog(userId)
    for (const k in users) {
      let userId = users[k].user_id
      await storeInboxStories(uuidv4(), userId, storyUid)
    }
    return res.json({
      "status": res.statusCode,
      "data": {}
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

function getUsersHog(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT user_id FROM users WHERE user_id != '${userId}'`
    conHog.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function getInboxStories(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT a.read FROM inbox_stories a WHERE a.user_id = '${userId}' AND a.read = 0`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  }) 
}

function updateInboxStories(userId) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE inbox_stories s SET s.read = 1 WHERE s.user_id = '${userId}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
} 

function storeInboxStories(uid, userId, storyUid) {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO inbox_stories (uid, user_id, story_uid) VALUES ('${uid}', '${userId}', '${storyUid}')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function getSelfStories(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT DISTINCT p.user_id, p.fullname, p.profile_pic, MAX(s.created_at) AS created
    FROM community_hog.profiles p 
    INNER JOIN user_stories s ON s.user_id  = p.user_id
    WHERE s.user_id  = '${userId}'
    GROUP BY p.user_id
    ORDER BY MAX(s.created_at) DESC`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0])
      }
    })
  })
}

function getStories(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT DISTINCT a.uid, a.backgroundColor, a.textColor, a.caption, a.media, 
    b.name AS type, a.duration, p.fullname, p.address, p.profile_pic, p.user_id, 
    c.created_at AS created  
    FROM stories a 
    INNER JOIN story_types b ON a.type = b.id
    INNER JOIN user_stories c ON a.uid = c.story_uid
    INNER JOIN community_hog.profiles p ON p.user_id = c.user_id 
    WHERE p.user_id = '${userId}'
    GROUP BY c.uid
    ORDER BY c.created_at ASC`
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
    const query = `SELECT DISTINCT p.user_id, p.fullname, p.profile_pic, MAX(s.created_at) AS created
    FROM community_hog.profiles p 
    INNER JOIN user_stories s ON s.user_id  = p.user_id
    GROUP BY p.user_id
    ORDER BY MAX(s.created_at) DESC`
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

function userStoryStore(uid, userId, storyId, backgroundColor, textColor, caption, media, fileType, duration) {
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
        conn.query(`INSERT INTO stories (uid, backgroundColor, textColor, caption, media, type, duration) 
        VALUES ('${storyId}', '${backgroundColor}', '${textColor}', '${caption}', '${media}', '${fileType}', '${duration}')`, function (e, res) {
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

function userStoryExpire() {
  return new Promise((resolve, reject) => {
    conn.beginTransaction((e) => {
      if (e) { reject(new Error(e)) }
      conn.query(`DELETE FROM stories WHERE created_at<=DATE_SUB(NOW(), INTERVAL 1 DAY)`, (e, res) => {
        if(e) {
          return conn.rollback(function() {
            reject(new Error(e))
          })
        }
        conn.query(`DELETE FROM user_stories WHERE created_at<=DATE_SUB(NOW(), INTERVAL 1 DAY)`, function (e, res) {
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